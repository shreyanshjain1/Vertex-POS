import { Prisma, PrismaClient } from '@prisma/client';
import { logActivity } from '@/lib/activity';
import {
  getCustomerDisplayName,
  normalizeCustomerCreditStatus
} from '@/lib/customers';
import { normalizeText, roundCurrency } from '@/lib/inventory';

type DbClient = PrismaClient | Prisma.TransactionClient;

export class CustomerOperationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'CustomerOperationError';
    this.status = status;
  }
}

export const customerDetailInclude = {
  sales: {
    where: {
      status: 'COMPLETED'
    },
    select: {
      id: true,
      saleNumber: true,
      receiptNumber: true,
      paymentMethod: true,
      isCreditSale: true,
      totalAmount: true,
      createdAt: true
    },
    orderBy: [{ createdAt: 'desc' }]
  },
  loyaltyLedger: {
    include: {
      sale: {
        select: {
          id: true,
          saleNumber: true,
          totalAmount: true,
          createdAt: true
        }
      }
    },
    orderBy: [{ createdAt: 'desc' }]
  },
  creditLedgers: {
    include: {
      sale: {
        select: {
          id: true,
          saleNumber: true,
          receiptNumber: true,
          totalAmount: true,
          createdAt: true
        }
      },
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
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }]
  }
} satisfies Prisma.CustomerInclude;

export type CustomerDetail = Prisma.CustomerGetPayload<{
  include: typeof customerDetailInclude;
}>;

export async function getCustomerDetailOrThrow(db: DbClient, customerId: string, shopId: string) {
  const customer = await db.customer.findFirst({
    where: { id: customerId, shopId },
    include: customerDetailInclude
  });

  if (!customer) {
    throw new CustomerOperationError('Customer not found.', 404);
  }

  return customer;
}

export async function getCustomerLoyaltyBalance(db: DbClient, customerId: string) {
  const latestEntry = await db.customerLoyaltyLedger.findFirst({
    where: { customerId },
    orderBy: [{ createdAt: 'desc' }]
  });

  return latestEntry?.balanceAfter ?? 0;
}

export async function recordReceivablePayment({
  tx,
  shopId,
  customer,
  customerCreditLedgerId,
  amount,
  method,
  referenceNumber,
  paidAt,
  userId
}: {
  tx: Prisma.TransactionClient;
  shopId: string;
  customer: CustomerDetail;
  customerCreditLedgerId: string;
  amount: number;
  method: string;
  referenceNumber?: string | null;
  paidAt: Date;
  userId: string;
}) {
  const ledger = customer.creditLedgers.find((entry) => entry.id === customerCreditLedgerId);

  if (!ledger) {
    throw new CustomerOperationError('Receivable entry not found for this customer.', 404);
  }

  if (ledger.status === 'VOIDED') {
    throw new CustomerOperationError('Voided receivable entries cannot accept payments.');
  }

  const currentBalance = Number(ledger.balance.toString());
  const normalizedAmount = roundCurrency(amount);

  if (normalizedAmount <= 0) {
    throw new CustomerOperationError('Payment amount must be greater than zero.');
  }

  if (normalizedAmount > currentBalance) {
    throw new CustomerOperationError('Payment amount cannot exceed the remaining receivable balance.');
  }

  await tx.receivablePayment.create({
    data: {
      shopId,
      customerCreditLedgerId: ledger.id,
      amount: normalizedAmount,
      method,
      referenceNumber: normalizeText(referenceNumber),
      paidAt,
      createdByUserId: userId
    }
  });

  const nextBalance = roundCurrency(currentBalance - normalizedAmount);
  const nextStatus = normalizeCustomerCreditStatus(
    nextBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID',
    ledger.dueDate,
    nextBalance
  );

  await tx.customerCreditLedger.update({
    where: { id: ledger.id },
    data: {
      balance: nextBalance,
      status: nextStatus
    }
  });

  await logActivity({
    tx,
    shopId,
    userId,
    action: 'RECEIVABLE_PAYMENT_POSTED',
    entityType: 'CustomerCreditLedger',
    entityId: ledger.id,
    description: `Posted receivable payment for ${getCustomerDisplayName(customer)}.`,
    metadata: {
      customerId: customer.id,
      customerName: getCustomerDisplayName(customer),
      saleNumber: ledger.sale?.saleNumber ?? null,
      amount: normalizedAmount,
      method,
      balanceAfter: nextBalance
    }
  });
}
