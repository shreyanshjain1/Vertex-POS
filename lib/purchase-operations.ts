import { Prisma, PrismaClient } from '@prisma/client';
import { logActivity } from '@/lib/activity';
import { normalizeText, roundCurrency } from '@/lib/inventory';
import { requiresReferenceNumber } from '@/lib/payments';
import {
  canTransitionPurchaseStatus,
  derivePayableStatus,
  derivePurchaseReceiptStatus,
  getPurchaseRemainingUnitQty
} from '@/lib/purchases';

type DbClient = PrismaClient | Prisma.TransactionClient;

export class PurchaseOperationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'PurchaseOperationError';
    this.status = status;
  }
}

export const purchaseDetailInclude = {
  supplier: true,
  items: {
    orderBy: [{ productName: 'asc' }]
  },
  receipts: {
    include: {
      receivedByUser: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: [{ createdAt: 'asc' }]
      }
    },
    orderBy: [{ receivedAt: 'desc' }, { createdAt: 'desc' }]
  },
  supplierInvoice: {
    include: {
      payments: {
        include: {
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }]
      },
      payableEntry: true
    }
  }
} satisfies Prisma.PurchaseOrderInclude;

type PurchaseDetail = Prisma.PurchaseOrderGetPayload<{
  include: typeof purchaseDetailInclude;
}>;

function getPaidAmount(payments: Array<{ amount: Prisma.Decimal }>) {
  return roundCurrency(
    payments.reduce((sum, payment) => sum + Number(payment.amount.toString()), 0)
  );
}

function getBaseUnitCost(unitCost: Prisma.Decimal, ratioToBase: number) {
  return ratioToBase > 0
    ? roundCurrency(Number(unitCost.toString()) / ratioToBase)
    : roundCurrency(Number(unitCost.toString()));
}

async function refreshInvoiceBalances(
  tx: Prisma.TransactionClient,
  invoiceId: string
) {
  const invoice = await tx.supplierInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      payments: true,
      payableEntry: true
    }
  });

  if (!invoice) {
    throw new PurchaseOperationError('Supplier invoice not found.', 404);
  }

  const totalAmount = Number(invoice.totalAmount.toString());
  const amountPaid = getPaidAmount(invoice.payments);
  const balance = roundCurrency(Math.max(totalAmount - amountPaid, 0));
  const paymentStatus = derivePayableStatus({
    totalAmount,
    amountPaid,
    dueDate: invoice.dueDate
  });

  const updatedInvoice = await tx.supplierInvoice.update({
    where: { id: invoice.id },
    data: {
      paymentStatus
    },
    include: {
      payments: true,
      payableEntry: true
    }
  });

  await tx.accountsPayableEntry.upsert({
    where: { supplierInvoiceId: invoice.id },
    update: {
      amountDue: totalAmount,
      amountPaid,
      balance,
      status: paymentStatus,
      dueDate: invoice.dueDate
    },
    create: {
      shopId: invoice.shopId,
      supplierId: invoice.supplierId,
      supplierInvoiceId: invoice.id,
      amountDue: totalAmount,
      amountPaid,
      balance,
      status: paymentStatus,
      dueDate: invoice.dueDate
    }
  });

  return updatedInvoice;
}

export async function getPurchaseDetailOrThrow(db: DbClient, purchaseId: string, shopId: string) {
  const purchase = await db.purchaseOrder.findFirst({
    where: { id: purchaseId, shopId },
    include: purchaseDetailInclude
  });

  if (!purchase) {
    throw new PurchaseOperationError('Purchase not found.', 404);
  }

  return purchase;
}

export async function updatePurchaseStatus({
  tx,
  purchase,
  shopId,
  userId,
  nextStatus,
  notes
}: {
  tx: Prisma.TransactionClient;
  purchase: PurchaseDetail;
  shopId: string;
  userId: string;
  nextStatus: 'DRAFT' | 'SENT' | 'CANCELLED' | 'CLOSED';
  notes?: string | null;
}) {
  if (purchase.status === 'CANCELLED' || purchase.status === 'CLOSED') {
    throw new PurchaseOperationError('This purchase is already in a final state.');
  }

  if (!canTransitionPurchaseStatus(purchase.status, nextStatus)) {
    throw new PurchaseOperationError(
      `Cannot move a ${purchase.status.replaceAll('_', ' ').toLowerCase()} purchase to ${nextStatus.replaceAll('_', ' ').toLowerCase()}.`
    );
  }

  const updatedPurchase = await tx.purchaseOrder.update({
    where: { id: purchase.id },
    data: {
      status: nextStatus,
      notes: notes === undefined ? purchase.notes : normalizeText(notes)
    }
  });

  await logActivity({
    tx,
    shopId,
    userId,
    action: `PURCHASE_${nextStatus}`,
    entityType: 'PurchaseOrder',
    entityId: purchase.id,
    description: `Marked purchase ${purchase.purchaseNumber} as ${nextStatus.replaceAll('_', ' ').toLowerCase()}.`
  });

  return updatedPurchase;
}

export async function receivePurchaseOrder({
  tx,
  purchase,
  shopId,
  userId,
  receivedAt,
  notes,
  items
}: {
  tx: Prisma.TransactionClient;
  purchase: PurchaseDetail;
  shopId: string;
  userId: string;
  receivedAt: Date;
  notes?: string | null;
  items: Array<{
    purchaseItemId: string;
    qtyReceived: number;
  }>;
}) {
  if (purchase.status === 'CANCELLED' || purchase.status === 'CLOSED') {
    throw new PurchaseOperationError('Finalized purchases cannot receive stock.');
  }

  const purchaseItemMap = new Map(purchase.items.map((item) => [item.id, item]));
  const productIds = [...new Set(purchase.items.map((item) => item.productId))];
  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, cost: true }
  });
  const productMap = new Map(products.map((product) => [product.id, product]));

  const normalizedReceiptItems = items.map((entry) => {
    const purchaseItem = purchaseItemMap.get(entry.purchaseItemId);
    if (!purchaseItem) {
      throw new PurchaseOperationError('One or more received items no longer match this purchase.', 404);
    }

    const remainingUnits = getPurchaseRemainingUnitQty(purchaseItem);
    if (entry.qtyReceived > remainingUnits) {
      throw new PurchaseOperationError(
        `Cannot receive more than the remaining quantity for ${purchaseItem.productName}.`
      );
    }

    return {
      ...entry,
      purchaseItem,
      baseQtyReceived: entry.qtyReceived * purchaseItem.ratioToBase
    };
  });

  if (!normalizedReceiptItems.length) {
    throw new PurchaseOperationError('Add at least one item to receive.');
  }

  const receipt = await tx.purchaseReceipt.create({
    data: {
      shopId,
      purchaseId: purchase.id,
      receivedByUserId: userId,
      receivedAt,
      notes: normalizeText(notes),
      items: {
        create: normalizedReceiptItems.map((item) => ({
          purchaseItemId: item.purchaseItem.id,
          productId: item.purchaseItem.productId,
          qtyReceived: item.qtyReceived
        }))
      }
    }
  });

  const nextItemState = new Map(
    purchase.items.map((item) => [
      item.id,
      {
        ...item,
        receivedBaseQty: item.receivedBaseQty
      }
    ])
  );

  for (const item of normalizedReceiptItems) {
    const product = productMap.get(item.purchaseItem.productId);
    if (!product) {
      throw new PurchaseOperationError('One or more products on this purchase no longer exist.', 404);
    }

    const nextBaseCost = getBaseUnitCost(item.purchaseItem.unitCost, item.purchaseItem.ratioToBase);
    if (Number(product.cost.toString()) !== nextBaseCost) {
      await tx.productCostHistory.create({
        data: {
          productId: item.purchaseItem.productId,
          previousCost: product.cost,
          newCost: nextBaseCost,
          effectiveDate: receivedAt,
          changedByUserId: userId,
          note: `Purchase ${purchase.purchaseNumber}`
        }
      });
    }

    await tx.purchaseItem.update({
      where: { id: item.purchaseItem.id },
      data: {
        receivedBaseQty: {
          increment: item.baseQtyReceived
        }
      }
    });

    await tx.product.update({
      where: { id: item.purchaseItem.productId },
      data: {
        stockQty: {
          increment: item.baseQtyReceived
        },
        cost: nextBaseCost
      }
    });

    await tx.inventoryMovement.create({
      data: {
        shopId,
        productId: item.purchaseItem.productId,
        type: 'PURCHASE_RECEIVED',
        qtyChange: item.baseQtyReceived,
        referenceId: purchase.id,
        userId,
        notes: `Purchase ${purchase.purchaseNumber} receipt (${item.qtyReceived} ${item.purchaseItem.unitName.toLowerCase()}${item.qtyReceived === 1 ? '' : 's'})`
      }
    });

    const current = nextItemState.get(item.purchaseItem.id);
    if (current) {
      current.receivedBaseQty += item.baseQtyReceived;
    }
  }

  const nextStatus =
    derivePurchaseReceiptStatus([...nextItemState.values()]) ?? purchase.status;

  await tx.purchaseOrder.update({
    where: { id: purchase.id },
    data: {
      status: nextStatus,
      receivedAt
    }
  });

  await logActivity({
    tx,
    shopId,
    userId,
    action: nextStatus === 'FULLY_RECEIVED' ? 'PURCHASE_FULLY_RECEIVED' : 'PURCHASE_PARTIALLY_RECEIVED',
    entityType: 'PurchaseOrder',
    entityId: purchase.id,
    description:
      nextStatus === 'FULLY_RECEIVED'
        ? `Fully received purchase ${purchase.purchaseNumber}.`
        : `Recorded a partial delivery for purchase ${purchase.purchaseNumber}.`,
    metadata: {
      receiptId: receipt.id,
      receivedLineCount: normalizedReceiptItems.length,
      receivedBaseQty: normalizedReceiptItems.reduce((sum, item) => sum + item.baseQtyReceived, 0)
    }
  });

  return receipt;
}

export async function upsertPurchaseInvoice({
  tx,
  purchase,
  shopId,
  userId,
  invoiceNumber,
  invoiceDate,
  dueDate,
  totalAmount,
  notes
}: {
  tx: Prisma.TransactionClient;
  purchase: PurchaseDetail;
  shopId: string;
  userId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  totalAmount: number;
  notes?: string | null;
}) {
  if (purchase.status === 'CANCELLED') {
    throw new PurchaseOperationError('Cancelled purchases cannot have supplier invoices.');
  }

  const duplicateInvoice = await tx.supplierInvoice.findFirst({
    where: {
      shopId,
      supplierId: purchase.supplierId,
      invoiceNumber,
      purchaseId: { not: purchase.id }
    },
    select: { id: true }
  });

  if (duplicateInvoice) {
    throw new PurchaseOperationError('This supplier invoice number is already in use.', 409);
  }

  const existingInvoice = await tx.supplierInvoice.findUnique({
    where: { purchaseId: purchase.id },
    include: { payments: true }
  });
  const amountPaid = existingInvoice ? getPaidAmount(existingInvoice.payments) : 0;

  if (roundCurrency(totalAmount) < amountPaid) {
    throw new PurchaseOperationError('Invoice total cannot be lower than the payments already recorded.');
  }

  const paymentStatus = derivePayableStatus({
    totalAmount,
    amountPaid,
    dueDate
  });

  const invoice = await tx.supplierInvoice.upsert({
    where: { purchaseId: purchase.id },
    update: {
      invoiceNumber,
      invoiceDate,
      dueDate,
      totalAmount,
      paymentStatus,
      notes: normalizeText(notes)
    },
    create: {
      shopId,
      supplierId: purchase.supplierId,
      purchaseId: purchase.id,
      invoiceNumber,
      invoiceDate,
      dueDate,
      totalAmount,
      paymentStatus,
      notes: normalizeText(notes)
    }
  });

  await refreshInvoiceBalances(tx, invoice.id);

  await logActivity({
    tx,
    shopId,
    userId,
    action: existingInvoice ? 'SUPPLIER_INVOICE_UPDATED' : 'SUPPLIER_INVOICE_CREATED',
    entityType: 'SupplierInvoice',
    entityId: invoice.id,
    description: `${existingInvoice ? 'Updated' : 'Recorded'} supplier invoice ${invoice.invoiceNumber} for purchase ${purchase.purchaseNumber}.`
  });

  return invoice;
}

export async function recordSupplierPayment({
  tx,
  purchase,
  shopId,
  userId,
  method,
  amount,
  referenceNumber,
  paidAt
}: {
  tx: Prisma.TransactionClient;
  purchase: PurchaseDetail;
  shopId: string;
  userId: string;
  method: string;
  amount: number;
  referenceNumber?: string | null;
  paidAt: Date;
}) {
  const invoice = await tx.supplierInvoice.findUnique({
    where: { purchaseId: purchase.id },
    include: {
      payments: true
    }
  });

  if (!invoice) {
    throw new PurchaseOperationError('Create the supplier invoice before recording a payment.', 400);
  }

  const normalizedReference = normalizeText(referenceNumber);
  if (requiresReferenceNumber(method as never) && !normalizedReference) {
    throw new PurchaseOperationError(`${method} payments require a reference number.`);
  }

  const totalAmount = Number(invoice.totalAmount.toString());
  const amountPaid = getPaidAmount(invoice.payments);
  const balance = roundCurrency(Math.max(totalAmount - amountPaid, 0));

  if (amount > balance) {
    throw new PurchaseOperationError('Payment amount cannot exceed the outstanding balance.');
  }

  const payment = await tx.supplierPayment.create({
    data: {
      shopId,
      supplierInvoiceId: invoice.id,
      method,
      amount,
      referenceNumber: normalizedReference,
      paidAt,
      createdByUserId: userId
    }
  });

  await refreshInvoiceBalances(tx, invoice.id);

  await logActivity({
    tx,
    shopId,
    userId,
    action: 'SUPPLIER_PAYMENT_RECORDED',
    entityType: 'SupplierPayment',
    entityId: payment.id,
    description: `Recorded a ${method.toLowerCase()} payment against invoice ${invoice.invoiceNumber}.`,
    metadata: {
      purchaseId: purchase.id,
      purchaseNumber: purchase.purchaseNumber,
      invoiceNumber: invoice.invoiceNumber,
      amount
    }
  });

  return payment;
}
