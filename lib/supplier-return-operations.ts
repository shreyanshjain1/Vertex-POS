import { Prisma, PrismaClient, SupplierCreditMemoStatus } from '@prisma/client';
import { logActivity } from '@/lib/activity';
import { normalizeText } from '@/lib/inventory';

type DbClient = PrismaClient | Prisma.TransactionClient;

export class SupplierReturnOperationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'SupplierReturnOperationError';
    this.status = status;
  }
}

export const supplierReturnDetailInclude = {
  supplier: {
    select: {
      id: true,
      name: true
    }
  },
  createdByUser: {
    select: {
      id: true,
      name: true,
      email: true
    }
  },
  approvedByUser: {
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
          name: true,
          stockQty: true
        }
      }
    },
    orderBy: [{ createdAt: 'asc' }]
  }
} satisfies Prisma.SupplierReturnInclude;

type SupplierReturnDetail = Prisma.SupplierReturnGetPayload<{
  include: typeof supplierReturnDetailInclude;
}>;

export async function getSupplierReturnDetailOrThrow(db: DbClient, supplierReturnId: string, shopId: string) {
  const supplierReturn = await db.supplierReturn.findFirst({
    where: { id: supplierReturnId, shopId },
    include: supplierReturnDetailInclude
  });

  if (!supplierReturn) {
    throw new SupplierReturnOperationError('Supplier return not found.', 404);
  }

  return supplierReturn;
}

export function validateSupplierCreditMemoInput({
  creditMemoNumber,
  creditMemoDate,
  creditAmount,
  creditMemoStatus
}: {
  creditMemoNumber?: string | null;
  creditMemoDate?: Date | null;
  creditAmount: number;
  creditMemoStatus: SupplierCreditMemoStatus;
}) {
  const normalizedMemoNumber = normalizeText(creditMemoNumber);

  if (creditMemoStatus !== 'PENDING') {
    if (!normalizedMemoNumber) {
      throw new SupplierReturnOperationError('Credit memo number is required once a memo is issued or applied.');
    }

    if (!creditMemoDate) {
      throw new SupplierReturnOperationError('Credit memo date is required once a memo is issued or applied.');
    }
  }

  if (creditAmount > 0 && (!normalizedMemoNumber || !creditMemoDate) && creditMemoStatus !== 'PENDING') {
    throw new SupplierReturnOperationError('Issued supplier credits require a memo number and date.');
  }

  if (creditMemoStatus === 'APPLIED' && creditAmount <= 0) {
    throw new SupplierReturnOperationError('Applied supplier credits must have a credit amount greater than zero.');
  }
}

export async function postSupplierReturn({
  tx,
  supplierReturn,
  shopId,
  userId,
  postedAt
}: {
  tx: Prisma.TransactionClient;
  supplierReturn: SupplierReturnDetail;
  shopId: string;
  userId: string;
  postedAt: Date;
}) {
  if (supplierReturn.status === 'POSTED') {
    throw new SupplierReturnOperationError('This supplier return is already posted.');
  }

  if (supplierReturn.status === 'CANCELLED') {
    throw new SupplierReturnOperationError('Cancelled supplier returns cannot be posted.');
  }

  const productIds = [...new Set(supplierReturn.items.map((item) => item.productId))];
  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      stockQty: true
    }
  });
  const productMap = new Map(products.map((product) => [product.id, product]));

  for (const item of supplierReturn.items) {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new SupplierReturnOperationError('One or more products on this supplier return no longer exist.', 404);
    }

    if (item.qty > product.stockQty) {
      throw new SupplierReturnOperationError(
        `Cannot post a return that exceeds available stock for ${item.productNameSnapshot}.`
      );
    }
  }

  for (const item of supplierReturn.items) {
    await tx.product.update({
      where: { id: item.productId },
      data: {
        stockQty: {
          decrement: item.qty
        }
      }
    });

    await tx.inventoryMovement.create({
      data: {
        shopId,
        productId: item.productId,
        type: 'SUPPLIER_RETURN_POSTED',
        qtyChange: -item.qty,
        referenceId: supplierReturn.id,
        userId,
        notes: `Supplier return ${supplierReturn.returnNumber} (${item.qty} unit${item.qty === 1 ? '' : 's'})`
      }
    });
  }

  const postedReturn = await tx.supplierReturn.update({
    where: { id: supplierReturn.id },
    data: {
      status: 'POSTED',
      postedAt,
      approvedByUserId: userId
    }
  });

  await logActivity({
    tx,
    shopId,
    userId,
    action: 'SUPPLIER_RETURN_POSTED',
    entityType: 'SupplierReturn',
    entityId: supplierReturn.id,
    description: `Posted supplier return ${supplierReturn.returnNumber}.`,
    metadata: {
      supplierName: supplierReturn.supplier.name,
      lineCount: supplierReturn.items.length,
      qtyReturned: supplierReturn.items.reduce((sum, item) => sum + item.qty, 0)
    }
  });

  return postedReturn;
}

export async function cancelSupplierReturn({
  tx,
  supplierReturn,
  shopId,
  userId
}: {
  tx: Prisma.TransactionClient;
  supplierReturn: SupplierReturnDetail;
  shopId: string;
  userId: string;
}) {
  if (supplierReturn.status !== 'DRAFT') {
    throw new SupplierReturnOperationError('Only draft supplier returns can be cancelled.');
  }

  const cancelledReturn = await tx.supplierReturn.update({
    where: { id: supplierReturn.id },
    data: {
      status: 'CANCELLED'
    }
  });

  await logActivity({
    tx,
    shopId,
    userId,
    action: 'SUPPLIER_RETURN_CANCELLED',
    entityType: 'SupplierReturn',
    entityId: supplierReturn.id,
    description: `Cancelled supplier return ${supplierReturn.returnNumber}.`
  });

  return cancelledReturn;
}

export async function updateSupplierReturnCredit({
  tx,
  supplierReturn,
  shopId,
  userId,
  creditMemoNumber,
  creditMemoDate,
  creditAmount,
  creditMemoStatus,
  notes
}: {
  tx: Prisma.TransactionClient;
  supplierReturn: SupplierReturnDetail;
  shopId: string;
  userId: string;
  creditMemoNumber?: string | null;
  creditMemoDate?: Date | null;
  creditAmount: number;
  creditMemoStatus: SupplierCreditMemoStatus;
  notes?: string | null;
}) {
  if (supplierReturn.status === 'CANCELLED') {
    throw new SupplierReturnOperationError('Cancelled supplier returns cannot be updated.');
  }

  validateSupplierCreditMemoInput({
    creditMemoNumber,
    creditMemoDate,
    creditAmount,
    creditMemoStatus
  });

  const updatedReturn = await tx.supplierReturn.update({
    where: { id: supplierReturn.id },
    data: {
      creditMemoNumber: normalizeText(creditMemoNumber),
      creditMemoDate: creditMemoDate ?? null,
      creditAmount,
      creditMemoStatus,
      notes: notes === undefined ? supplierReturn.notes : normalizeText(notes)
    }
  });

  await logActivity({
    tx,
    shopId,
    userId,
    action: 'SUPPLIER_RETURN_CREDIT_UPDATED',
    entityType: 'SupplierReturn',
    entityId: supplierReturn.id,
    description: `Updated credit memo details for supplier return ${supplierReturn.returnNumber}.`
  });

  return updatedReturn;
}
