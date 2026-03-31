import {
  DocumentSequenceType,
  Prisma
} from '@prisma/client';
import { logActivity } from '@/lib/activity';
import { verifyPassword } from '@/lib/auth/password';
import { getCustomerDisplayName } from '@/lib/customers';
import { getNextDocumentNumber } from '@/lib/document-sequence';
import { normalizeText, roundCurrency } from '@/lib/inventory';
import {
  getSalePaymentSummaryLabel,
  normalizePaymentInput,
  requiresReferenceNumber,
  validatePaymentsForSale,
  type PaymentInput
} from '@/lib/payments';
import { prisma } from '@/lib/prisma';
import { CASH_PAYMENT_METHOD, getActiveCashSession } from '@/lib/register';

type ApprovalInput = {
  approverEmail: string;
  approverPassword: string;
};

type ReturnItemInput = {
  saleItemId: string;
  qty: number;
  disposition: 'RESTOCK' | 'DAMAGED';
};

type ReplacementItemInput = {
  productId: string;
  qty: number;
};

type AdjustmentPaymentInput = PaymentInput;

type CreateVoidInput = ApprovalInput & {
  shopId: string;
  saleId: string;
  createdByUserId: string;
  createdByName: string;
  reason: string;
  notes?: string | null;
  refundPayments: AdjustmentPaymentInput[];
};

type CreateRefundInput = ApprovalInput & {
  shopId: string;
  saleId: string;
  createdByUserId: string;
  createdByName: string;
  reason: string;
  notes?: string | null;
  type: 'REFUND' | 'EXCHANGE';
  items: ReturnItemInput[];
  replacementItems: ReplacementItemInput[];
  refundPayments: AdjustmentPaymentInput[];
  exchangePayments: AdjustmentPaymentInput[];
};

export class SaleAdjustmentError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'SaleAdjustmentError';
    this.status = status;
  }
}

export const saleAdjustmentInclude = Prisma.validator<Prisma.SaleAdjustmentInclude>()({
  items: {
    orderBy: [{ itemType: 'asc' }, { createdAt: 'asc' }]
  },
  refundPayments: {
    orderBy: { createdAt: 'asc' }
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
  exchangeSale: {
    select: {
      id: true,
      saleNumber: true,
      receiptNumber: true,
      totalAmount: true,
      paymentMethod: true,
      createdAt: true
    }
  }
});

export const saleDetailInclude = Prisma.validator<Prisma.SaleInclude>()({
  customer: {
    select: {
      id: true,
      type: true,
      firstName: true,
      lastName: true,
      businessName: true,
      contactPerson: true,
      phone: true,
      email: true
    }
  },
  items: true,
  payments: {
    orderBy: { createdAt: 'asc' }
  },
  customerCreditLedger: {
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
      }
    }
  },
  adjustments: {
    include: saleAdjustmentInclude,
    orderBy: { createdAt: 'desc' }
  }
});

export type SaleWithDetail = Prisma.SaleGetPayload<{
  include: typeof saleDetailInclude;
}>;

export type SaleAdjustmentWithDetail = Prisma.SaleAdjustmentGetPayload<{
  include: typeof saleAdjustmentInclude;
}>;

type SaleItemFinancialState = {
  saleItemId: string;
  qty: number;
  refundedQty: number;
  refundableQty: number;
  fullCredit: number;
  refundedCredit: number;
  remainingCredit: number;
};

function toMoney(value: Prisma.Decimal | number | string | null | undefined) {
  return Number(value ?? 0);
}

function serializeUser(
  user: { id: string; name: string | null; email: string } | null | undefined
) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email
  };
}

function serializeRefundPayment(
  payment: Pick<
    SaleAdjustmentWithDetail['refundPayments'][number],
    'id' | 'method' | 'amount' | 'referenceNumber' | 'createdAt'
  >
) {
  return {
    id: payment.id,
    method: payment.method,
    amount: payment.amount.toString(),
    referenceNumber: payment.referenceNumber,
    createdAt: payment.createdAt.toISOString()
  };
}

export function serializeSaleAdjustment(adjustment: SaleAdjustmentWithDetail) {
  return {
    id: adjustment.id,
    shopId: adjustment.shopId,
    saleId: adjustment.saleId,
    exchangeSaleId: adjustment.exchangeSaleId,
    adjustmentNumber: adjustment.adjustmentNumber,
    type: adjustment.type,
    reason: adjustment.reason,
    notes: adjustment.notes,
    subtotal: adjustment.subtotal.toString(),
    totalAmount: adjustment.totalAmount.toString(),
    createdAt: adjustment.createdAt.toISOString(),
    createdByUser: serializeUser(adjustment.createdByUser),
    approvedByUser: serializeUser(adjustment.approvedByUser),
    exchangeSale: adjustment.exchangeSale
      ? {
          id: adjustment.exchangeSale.id,
          saleNumber: adjustment.exchangeSale.saleNumber,
          receiptNumber: adjustment.exchangeSale.receiptNumber,
          totalAmount: adjustment.exchangeSale.totalAmount.toString(),
          paymentMethod: adjustment.exchangeSale.paymentMethod,
          createdAt: adjustment.exchangeSale.createdAt.toISOString()
        }
      : null,
    items: adjustment.items.map((item) => ({
      id: item.id,
      saleItemId: item.saleItemId,
      productId: item.productId,
      itemType: item.itemType,
      productName: item.productName,
      qty: item.qty,
      unitPrice: item.unitPrice.toString(),
      lineTotal: item.lineTotal.toString(),
      disposition: item.disposition,
      createdAt: item.createdAt.toISOString()
    })),
    refundPayments: adjustment.refundPayments.map(serializeRefundPayment)
  };
}

export function serializeSaleDetail(sale: SaleWithDetail) {
  const refundState = getSaleRefundState(sale);

  return {
    id: sale.id,
    saleNumber: sale.saleNumber,
    receiptNumber: sale.receiptNumber,
    status: sale.status,
    customerId: sale.customerId,
    customer: sale.customer
      ? {
          id: sale.customer.id,
          displayName: getCustomerDisplayName(sale.customer),
          phone: sale.customer.phone,
          email: sale.customer.email,
          type: sale.customer.type
        }
      : null,
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    subtotal: sale.subtotal.toString(),
    taxAmount: sale.taxAmount.toString(),
    discountAmount: sale.discountAmount.toString(),
    totalAmount: sale.totalAmount.toString(),
    changeDue: sale.changeDue.toString(),
    paymentMethod: sale.paymentMethod,
    isCreditSale: sale.isCreditSale,
    loyaltyPointsEarned: sale.loyaltyPointsEarned,
    loyaltyPointsRedeemed: sale.loyaltyPointsRedeemed,
    loyaltyDiscountAmount: sale.loyaltyDiscountAmount.toString(),
    notes: sale.notes,
    cashierName: sale.cashierName,
    voidReason: sale.voidReason,
    createdAt: sale.createdAt.toISOString(),
    updatedAt: sale.updatedAt.toISOString(),
    canVoid: refundState.canVoid,
    canRefund: refundState.canRefund,
    refundableAmount: refundState.refundableAmount.toFixed(2),
    items: sale.items.map((item) => {
      const state = refundState.items.find((entry) => entry.saleItemId === item.id)!;
      return {
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        qty: item.qty,
        unitPrice: item.unitPrice.toString(),
        lineTotal: item.lineTotal.toString(),
        fullCreditAmount: state.fullCredit.toFixed(2),
        refundedQty: state.refundedQty,
        refundableQty: state.refundableQty,
        refundableAmount: state.remainingCredit.toFixed(2)
      };
    }),
    payments: sale.payments.map((payment) => ({
      id: payment.id,
      method: payment.method,
      amount: payment.amount.toString(),
      referenceNumber: payment.referenceNumber,
      createdAt: payment.createdAt.toISOString()
    })),
    customerCreditLedger: sale.customerCreditLedger
      ? {
          id: sale.customerCreditLedger.id,
          dueDate: sale.customerCreditLedger.dueDate.toISOString(),
          originalAmount: sale.customerCreditLedger.originalAmount.toString(),
          balance: sale.customerCreditLedger.balance.toString(),
          status: sale.customerCreditLedger.status,
          payments: sale.customerCreditLedger.payments.map((payment) => ({
            id: payment.id,
            amount: payment.amount.toString(),
            method: payment.method,
            referenceNumber: payment.referenceNumber,
            paidAt: payment.paidAt.toISOString(),
            createdAt: payment.createdAt.toISOString(),
            createdByUser: serializeUser(payment.createdByUser)
          }))
        }
      : null,
    adjustments: sale.adjustments.map(serializeSaleAdjustment)
  };
}

function buildSaleItemCreditMap(sale: Pick<SaleWithDetail, 'items' | 'subtotal' | 'taxAmount' | 'discountAmount'>) {
  const subtotal = toMoney(sale.subtotal);
  const totalTax = toMoney(sale.taxAmount);
  const totalDiscount = toMoney(sale.discountAmount);
  let allocatedTax = 0;
  let allocatedDiscount = 0;

  return new Map(
    sale.items.map((item, index) => {
      const lineSubtotal = toMoney(item.lineTotal);
      let lineTax = 0;
      let lineDiscount = 0;

      if (index === sale.items.length - 1) {
        lineTax = roundCurrency(totalTax - allocatedTax);
        lineDiscount = roundCurrency(totalDiscount - allocatedDiscount);
      } else if (subtotal > 0) {
        const ratio = lineSubtotal / subtotal;
        lineTax = roundCurrency(totalTax * ratio);
        lineDiscount = roundCurrency(totalDiscount * ratio);
        allocatedTax = roundCurrency(allocatedTax + lineTax);
        allocatedDiscount = roundCurrency(allocatedDiscount + lineDiscount);
      }

      return [
        item.id,
        {
          lineSubtotal,
          lineTax,
          lineDiscount,
          fullCredit: roundCurrency(lineSubtotal + lineTax - lineDiscount)
        }
      ] as const;
    })
  );
}

export function getSaleRefundState(sale: SaleWithDetail) {
  const creditMap = buildSaleItemCreditMap(sale);
  const refundedQtyMap = new Map<string, number>();
  const refundedCreditMap = new Map<string, number>();

  for (const adjustment of sale.adjustments) {
    for (const item of adjustment.items) {
      if (item.itemType !== 'RETURN' || !item.saleItemId) {
        continue;
      }

      refundedQtyMap.set(item.saleItemId, (refundedQtyMap.get(item.saleItemId) ?? 0) + item.qty);
      refundedCreditMap.set(
        item.saleItemId,
        roundCurrency((refundedCreditMap.get(item.saleItemId) ?? 0) + toMoney(item.lineTotal))
      );
    }
  }

  const items: SaleItemFinancialState[] = sale.items.map((item) => {
    const line = creditMap.get(item.id) ?? {
      lineSubtotal: toMoney(item.lineTotal),
      lineTax: 0,
      lineDiscount: 0,
      fullCredit: toMoney(item.lineTotal)
    };
    const refundedQty = refundedQtyMap.get(item.id) ?? 0;
    const refundedCredit = refundedCreditMap.get(item.id) ?? 0;
    const refundableQty = Math.max(item.qty - refundedQty, 0);
    const remainingCredit = roundCurrency(Math.max(line.fullCredit - refundedCredit, 0));

    return {
      saleItemId: item.id,
      qty: item.qty,
      refundedQty,
      refundableQty,
      fullCredit: line.fullCredit,
      refundedCredit,
      remainingCredit
    };
  });

  const hasVoid = sale.status === 'VOIDED' || sale.adjustments.some((adjustment) => adjustment.type === 'VOID');

  return {
    items,
    hasVoid,
    canVoid: sale.status === 'COMPLETED' && !sale.isCreditSale && sale.adjustments.length === 0,
    canRefund:
      sale.status === 'COMPLETED' &&
      !sale.isCreditSale &&
      !hasVoid &&
      items.some((item) => item.refundableQty > 0 && item.remainingCredit > 0),
    refundableAmount: roundCurrency(items.reduce((sum, item) => sum + item.remainingCredit, 0))
  };
}

async function assertCashSessionForPayments(
  shopId: string,
  userId: string,
  payments: PaymentInput[],
  message: string
) {
  if (!payments.some((payment) => payment.method === CASH_PAYMENT_METHOD)) {
    return;
  }

  const activeCashSession = await getActiveCashSession(prisma, shopId, userId);
  if (!activeCashSession) {
    throw new SaleAdjustmentError(message, 409);
  }
}

function validateRefundPayments(totalAmount: number, payments: PaymentInput[]) {
  const normalizedPayments = payments.map(normalizePaymentInput);

  if (totalAmount <= 0) {
    if (normalizedPayments.length) {
      throw new SaleAdjustmentError('Refund payment lines are not needed when no money is owed back.');
    }

    return [];
  }

  if (!normalizedPayments.length) {
    throw new SaleAdjustmentError('Add at least one refund payment line.');
  }

  for (const payment of normalizedPayments) {
    if (payment.amount <= 0) {
      throw new SaleAdjustmentError('Each refund payment amount must be greater than zero.');
    }

    if (requiresReferenceNumber(payment.method) && !payment.referenceNumber) {
      throw new SaleAdjustmentError(`${payment.method} refund payments require a reference number.`);
    }
  }

  const refundTotal = roundCurrency(
    normalizedPayments.reduce((sum, payment) => sum + payment.amount, 0)
  );

  if (refundTotal !== totalAmount) {
    throw new SaleAdjustmentError('Refund payment lines must equal the exact refund amount.');
  }

  return normalizedPayments;
}

async function verifyManagerApproval({ approverEmail, approverPassword, shopId }: ApprovalInput & { shopId: string }) {
  const email = approverEmail.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      memberships: {
        where: {
          shopId,
          isActive: true,
          role: {
            in: ['MANAGER', 'ADMIN']
          }
        },
        select: {
          role: true
        },
        take: 1
      }
    }
  });

  if (!user || !user.memberships.length) {
    throw new SaleAdjustmentError('Manager or admin approval is required for this action.', 403);
  }

  const passwordValid = await verifyPassword(approverPassword, user.passwordHash);
  if (!passwordValid) {
    throw new SaleAdjustmentError('Approver password is incorrect.', 403);
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.memberships[0].role
  };
}

async function getSaleForAction(tx: Prisma.TransactionClient, shopId: string, saleId: string) {
  const sale = await tx.sale.findFirst({
    where: { id: saleId, shopId },
    include: saleDetailInclude
  });

  if (!sale) {
    throw new SaleAdjustmentError('Sale not found.', 404);
  }

  return sale;
}

function groupReturnItems(items: ReturnItemInput[]) {
  const grouped = new Map<string, ReturnItemInput>();

  for (const item of items) {
    const current = grouped.get(item.saleItemId);
    if (!current) {
      grouped.set(item.saleItemId, { ...item });
      continue;
    }

    if (current.disposition !== item.disposition) {
      throw new SaleAdjustmentError('Use one disposition per returned line item.');
    }

    current.qty += item.qty;
  }

  return [...grouped.values()];
}

function groupReplacementItems(items: ReplacementItemInput[]) {
  const grouped = new Map<string, ReplacementItemInput>();

  for (const item of items) {
    const current = grouped.get(item.productId);
    if (!current) {
      grouped.set(item.productId, { ...item });
      continue;
    }

    current.qty += item.qty;
  }

  return [...grouped.values()];
}

async function createExchangeSale(
  tx: Prisma.TransactionClient,
  {
    shopId,
    createdByUserId,
    createdByName,
    sale,
    settings,
    adjustmentNumber,
    replacementItems,
    appliedCredit,
    exchangePayments
  }: {
    shopId: string;
    createdByUserId: string;
    createdByName: string;
    sale: SaleWithDetail;
    settings: { salePrefix: string; receiptPrefix: string; taxRate: Prisma.Decimal | number | null } | null;
    adjustmentNumber: string;
    replacementItems: Array<{
      productId: string;
      productName: string;
      qty: number;
      unitPrice: number;
      lineTotal: number;
    }>;
    appliedCredit: number;
    exchangePayments: PaymentInput[];
  }
) {
  const subtotal = roundCurrency(
    replacementItems.reduce((sum, item) => sum + item.lineTotal, 0)
  );
  const taxAmount = roundCurrency(subtotal * (toMoney(settings?.taxRate) / 100));
  const grossAmount = roundCurrency(subtotal + taxAmount);
  const discountAmount = roundCurrency(Math.min(appliedCredit, grossAmount));
  const totalAmount = roundCurrency(grossAmount - discountAmount);
  const paymentValidation =
    totalAmount > 0
      ? validatePaymentsForSale(totalAmount, exchangePayments)
      : { ok: true as const, payments: [] as PaymentInput[], summary: { changeDue: 0 } };

  if (!paymentValidation.ok) {
    throw new SaleAdjustmentError(paymentValidation.error);
  }

  const saleNumber = await getNextDocumentNumber(tx, {
    shopId,
    type: DocumentSequenceType.SALE,
    prefix: settings?.salePrefix ?? 'SAL'
  });
  const receiptNumber = await getNextDocumentNumber(tx, {
    shopId,
    type: DocumentSequenceType.RECEIPT,
    prefix: settings?.receiptPrefix ?? 'RCP'
  });

  const exchangeSale = await tx.sale.create({
    data: {
      shopId,
      cashierUserId: createdByUserId,
      saleNumber,
      receiptNumber,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      changeDue: paymentValidation.summary.changeDue,
      paymentMethod:
        totalAmount > 0
          ? getSalePaymentSummaryLabel(paymentValidation.payments)
          : 'Exchange Credit',
      notes: normalizeText(
        `Exchange sale for ${sale.saleNumber}. Adjustment ${adjustmentNumber}.${sale.notes ? ` Original notes: ${sale.notes}` : ''}`
      ),
      cashierName: createdByName,
      items: {
        create: replacementItems.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          qty: item.qty,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal
        }))
      },
      payments: paymentValidation.payments.length
        ? {
            create: paymentValidation.payments.map((payment) => ({
              method: payment.method,
              amount: payment.amount,
              referenceNumber: normalizeText(payment.referenceNumber)
            }))
          }
        : undefined
    },
    include: { items: true }
  });

  await logActivity({
    tx,
    shopId,
    userId: createdByUserId,
    action: 'SALE_COMPLETED',
    entityType: 'Sale',
    entityId: exchangeSale.id,
    description: `Completed exchange sale ${exchangeSale.saleNumber} for original sale ${sale.saleNumber}.`,
    metadata: {
      sourceSaleId: sale.id,
      sourceSaleNumber: sale.saleNumber,
      adjustmentNumber,
      appliedCredit,
      collectedAmount: totalAmount,
      itemCount: replacementItems.reduce((sum, item) => sum + item.qty, 0)
    }
  });

  return {
    exchangeSale,
    subtotal,
    taxAmount,
    grossAmount,
    totalAmount
  };
}

export async function createVoidSaleAdjustment(input: CreateVoidInput): Promise<SaleAdjustmentWithDetail> {
  const approver = await verifyManagerApproval({
    approverEmail: input.approverEmail,
    approverPassword: input.approverPassword,
    shopId: input.shopId
  });

  return prisma.$transaction(async (tx) => {
    const sale = await getSaleForAction(tx, input.shopId, input.saleId);
    const refundState = getSaleRefundState(sale);

    if (!refundState.canVoid) {
      throw new SaleAdjustmentError('This sale can no longer be voided.');
    }

    const totalRefund = roundCurrency(toMoney(sale.totalAmount));
    const refundPayments = validateRefundPayments(totalRefund, input.refundPayments);

    await assertCashSessionForPayments(
      input.shopId,
      input.createdByUserId,
      refundPayments,
      'Open a register session before issuing cash void refunds.'
    );

    const adjustmentNumber = await getNextDocumentNumber(tx, {
      shopId: input.shopId,
      type: DocumentSequenceType.RETURN,
      prefix: 'RTN'
    });

    const creditMap = buildSaleItemCreditMap(sale);
    const adjustment = await tx.saleAdjustment.create({
      data: {
        shopId: input.shopId,
        saleId: sale.id,
        adjustmentNumber,
        type: 'VOID',
        reason: input.reason.trim(),
        notes: normalizeText(input.notes),
        subtotal: totalRefund,
        totalAmount: totalRefund,
        approvedByUserId: approver.id,
        createdByUserId: input.createdByUserId,
        items: {
          create: sale.items.map((item) => {
            const line = creditMap.get(item.id)!;
            return {
              saleItemId: item.id,
              productId: item.productId,
              itemType: 'RETURN' as const,
              productName: item.productName,
              qty: item.qty,
              unitPrice: item.qty > 0 ? roundCurrency(line.fullCredit / item.qty) : line.fullCredit,
              lineTotal: line.fullCredit,
              disposition: 'RESTOCK'
            };
          })
        },
        refundPayments: {
          create: refundPayments.map((payment) => ({
            method: payment.method,
            amount: payment.amount,
            referenceNumber: normalizeText(payment.referenceNumber)
          }))
        }
      },
      include: saleAdjustmentInclude
    });

    await tx.sale.update({
      where: { id: sale.id },
      data: {
        status: 'VOIDED',
        voidReason: input.reason.trim()
      }
    });

    for (const item of sale.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stockQty: {
            increment: item.qty
          }
        }
      });

      await tx.inventoryMovement.create({
        data: {
          shopId: input.shopId,
          productId: item.productId,
          type: 'SALE_VOIDED',
          qtyChange: item.qty,
          referenceId: adjustment.id,
          userId: input.createdByUserId,
          notes: `Void ${adjustment.adjustmentNumber} for ${sale.saleNumber}`
        }
      });
    }

    await logActivity({
      tx,
      shopId: input.shopId,
      userId: input.createdByUserId,
      action: 'SALE_VOIDED',
      entityType: 'SaleAdjustment',
      entityId: adjustment.id,
      description: `Voided sale ${sale.saleNumber}.`,
      metadata: {
        saleId: sale.id,
        saleNumber: sale.saleNumber,
        adjustmentNumber: adjustment.adjustmentNumber,
        approvedByUserId: approver.id,
        totalAmount: totalRefund,
        itemCount: sale.items.reduce((sum, item) => sum + item.qty, 0),
        notes: normalizeText(input.notes)
      }
    });

    return adjustment;
  });
}

export async function createRefundSaleAdjustment(input: CreateRefundInput): Promise<SaleAdjustmentWithDetail> {
  const approver = await verifyManagerApproval({
    approverEmail: input.approverEmail,
    approverPassword: input.approverPassword,
    shopId: input.shopId
  });

  return prisma.$transaction(async (tx) => {
    const [sale, settings] = await Promise.all([
      getSaleForAction(tx, input.shopId, input.saleId),
      tx.shopSetting.findUnique({
        where: { shopId: input.shopId },
        select: {
          taxRate: true,
          salePrefix: true,
          receiptPrefix: true
        }
      })
    ]);

    const refundState = getSaleRefundState(sale);
    if (!refundState.canRefund) {
      throw new SaleAdjustmentError('This sale cannot be refunded anymore.');
    }

    const groupedReturnItems = groupReturnItems(input.items);
    const saleItemMap = new Map(sale.items.map((item) => [item.id, item]));
    const saleItemStateMap = new Map(refundState.items.map((item) => [item.saleItemId, item]));

    const selectedReturns = groupedReturnItems.map((item) => {
      const saleItem = saleItemMap.get(item.saleItemId);
      const state = saleItemStateMap.get(item.saleItemId);

      if (!saleItem || !state) {
        throw new SaleAdjustmentError('One or more returned items no longer match the original sale.');
      }

      if (item.qty > state.refundableQty) {
        throw new SaleAdjustmentError(`Refund quantity for ${saleItem.productName} exceeds what is still refundable.`);
      }

      const lineCredit =
        item.qty === state.refundableQty
          ? state.remainingCredit
          : Math.min(state.remainingCredit, roundCurrency((state.fullCredit / saleItem.qty) * item.qty));

      return {
        ...item,
        saleItem,
        lineCredit: roundCurrency(lineCredit),
        unitCredit: item.qty > 0 ? roundCurrency(lineCredit / item.qty) : lineCredit
      };
    });

    const returnCredit = roundCurrency(
      selectedReturns.reduce((sum, item) => sum + item.lineCredit, 0)
    );

    if (returnCredit <= 0) {
      throw new SaleAdjustmentError('The selected return lines do not produce a valid refund amount.');
    }

    const groupedReplacementItems = groupReplacementItems(input.replacementItems);

    if (input.type === 'REFUND' && groupedReplacementItems.length) {
      throw new SaleAdjustmentError('Replacement items can only be used in the exchange flow.');
    }

    if (input.type === 'EXCHANGE' && !groupedReplacementItems.length) {
      throw new SaleAdjustmentError('Add at least one replacement item to process an exchange.');
    }

    const replacementProducts = groupedReplacementItems.length
      ? await tx.product.findMany({
          where: {
            shopId: input.shopId,
            id: { in: groupedReplacementItems.map((item) => item.productId) }
          }
        })
      : [];
    const replacementProductMap = new Map(replacementProducts.map((product) => [product.id, product]));
    const restockByProductId = new Map<string, number>();

    for (const item of selectedReturns) {
      if (item.disposition !== 'RESTOCK') {
        continue;
      }

      restockByProductId.set(
        item.saleItem.productId,
        (restockByProductId.get(item.saleItem.productId) ?? 0) + item.qty
      );
    }

    const replacementLines = groupedReplacementItems.map((item) => {
      const product = replacementProductMap.get(item.productId);

      if (!product) {
        throw new SaleAdjustmentError('One or more replacement items were not found.');
      }

      if (!product.isActive) {
        throw new SaleAdjustmentError(`${product.name} is archived and cannot be used in an exchange.`);
      }

      const availableStock = product.stockQty + (restockByProductId.get(product.id) ?? 0);
      if (item.qty > availableStock) {
        throw new SaleAdjustmentError(`${product.name} only has ${availableStock} item(s) available for exchange.`);
      }

      const unitPrice = toMoney(product.price);
      return {
        ...item,
        product,
        productName: product.name,
        unitPrice,
        lineTotal: roundCurrency(unitPrice * item.qty)
      };
    });

    const replacementSubtotal = roundCurrency(
      replacementLines.reduce((sum, item) => sum + item.lineTotal, 0)
    );
    const replacementTax = roundCurrency(
      replacementSubtotal * (toMoney(settings?.taxRate) / 100)
    );
    const replacementGross = roundCurrency(replacementSubtotal + replacementTax);
    const appliedCredit = input.type === 'EXCHANGE' ? Math.min(returnCredit, replacementGross) : 0;
    const refundAmount = roundCurrency(returnCredit - appliedCredit);
    const exchangeCharge = roundCurrency(Math.max(replacementGross - appliedCredit, 0));

    const refundPayments = validateRefundPayments(refundAmount, input.refundPayments);
    await assertCashSessionForPayments(
      input.shopId,
      input.createdByUserId,
      refundPayments,
      'Open a register session before issuing cash refunds.'
    );

    if (exchangeCharge > 0) {
      const exchangeValidation = validatePaymentsForSale(exchangeCharge, input.exchangePayments);
      if (!exchangeValidation.ok) {
        throw new SaleAdjustmentError(exchangeValidation.error);
      }

      await assertCashSessionForPayments(
        input.shopId,
        input.createdByUserId,
        exchangeValidation.payments,
        'Open a register session before accepting cash for the exchange difference.'
      );
    } else if (input.exchangePayments.length) {
      throw new SaleAdjustmentError('Extra payment lines are only needed when the exchange still has a balance due.');
    }

    const adjustmentNumber = await getNextDocumentNumber(tx, {
      shopId: input.shopId,
      type: DocumentSequenceType.RETURN,
      prefix: 'RTN'
    });

    const exchangeSaleResult =
      replacementLines.length > 0
        ? await createExchangeSale(tx, {
            shopId: input.shopId,
            createdByUserId: input.createdByUserId,
            createdByName: input.createdByName,
            sale,
            settings,
            adjustmentNumber,
            replacementItems: replacementLines.map((item) => ({
              productId: item.product.id,
              productName: item.productName,
              qty: item.qty,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal
            })),
            appliedCredit,
            exchangePayments: input.exchangePayments
          })
        : null;

    const adjustment = await tx.saleAdjustment.create({
      data: {
        shopId: input.shopId,
        saleId: sale.id,
        exchangeSaleId: exchangeSaleResult?.exchangeSale.id ?? null,
        adjustmentNumber,
        type: input.type,
        reason: input.reason.trim(),
        notes: normalizeText(input.notes),
        subtotal: returnCredit,
        totalAmount: refundAmount,
        approvedByUserId: approver.id,
        createdByUserId: input.createdByUserId,
        items: {
          create: [
            ...selectedReturns.map((item) => ({
              saleItemId: item.saleItem.id,
              productId: item.saleItem.productId,
              itemType: 'RETURN' as const,
              productName: item.saleItem.productName,
              qty: item.qty,
              unitPrice: item.unitCredit,
              lineTotal: item.lineCredit,
              disposition: item.disposition
            })),
            ...replacementLines.map((item) => ({
              saleItemId: null,
              productId: item.product.id,
              itemType: 'REPLACEMENT' as const,
              productName: item.productName,
              qty: item.qty,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
              disposition: 'EXCHANGE' as const
            }))
          ]
        },
        refundPayments: refundPayments.length
          ? {
              create: refundPayments.map((payment) => ({
                method: payment.method,
                amount: payment.amount,
                referenceNumber: normalizeText(payment.referenceNumber)
              }))
            }
          : undefined
      },
      include: saleAdjustmentInclude
    });

    for (const item of selectedReturns) {
      if (item.disposition === 'RESTOCK') {
        await tx.product.update({
          where: { id: item.saleItem.productId },
          data: {
            stockQty: {
              increment: item.qty
            }
          }
        });

        await tx.inventoryMovement.create({
          data: {
            shopId: input.shopId,
            productId: item.saleItem.productId,
            type: 'RETURN_RESTOCKED',
            qtyChange: item.qty,
            referenceId: adjustment.id,
            userId: input.createdByUserId,
            notes: `${input.type} ${adjustment.adjustmentNumber} for ${sale.saleNumber}`
          }
        });
      }
    }

    for (const item of replacementLines) {
      await tx.product.update({
        where: { id: item.product.id },
        data: {
          stockQty: {
            decrement: item.qty
          }
        }
      });

      await tx.inventoryMovement.create({
        data: {
          shopId: input.shopId,
          productId: item.product.id,
          type: 'EXCHANGE_ISSUED',
          qtyChange: item.qty * -1,
          referenceId: exchangeSaleResult?.exchangeSale.id ?? adjustment.id,
          userId: input.createdByUserId,
          notes: `Exchange ${adjustment.adjustmentNumber} for ${sale.saleNumber}`
        }
      });
    }

    await logActivity({
      tx,
      shopId: input.shopId,
      userId: input.createdByUserId,
      action: input.type === 'EXCHANGE' ? 'SALE_EXCHANGED' : 'SALE_REFUNDED',
      entityType: 'SaleAdjustment',
      entityId: adjustment.id,
      description:
        input.type === 'EXCHANGE'
          ? `Processed exchange against sale ${sale.saleNumber}.`
          : `Processed refund against sale ${sale.saleNumber}.`,
      metadata: {
        saleId: sale.id,
        saleNumber: sale.saleNumber,
        adjustmentNumber: adjustment.adjustmentNumber,
        approvedByUserId: approver.id,
        returnCredit,
        refundAmount,
        exchangeCharge,
        returnedItemCount: selectedReturns.reduce((sum, item) => sum + item.qty, 0),
        replacementItemCount: replacementLines.reduce((sum, item) => sum + item.qty, 0),
        notes: normalizeText(input.notes)
      }
    });

    return adjustment;
  });
}
