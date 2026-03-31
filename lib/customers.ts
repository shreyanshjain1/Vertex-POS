import { roundCurrency } from '@/lib/inventory';

type DecimalLike = { toString(): string };

export const CUSTOMER_TYPE_OPTIONS = ['INDIVIDUAL', 'BUSINESS'] as const;
export const CUSTOMER_LOYALTY_LEDGER_TYPE_OPTIONS = ['EARNED', 'REDEEMED', 'ADJUSTED'] as const;
export const CUSTOMER_CREDIT_STATUS_OPTIONS = ['OPEN', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOIDED'] as const;
export const AGING_BUCKET_KEYS = ['current', 'days_1_30', 'days_31_60', 'days_61_plus'] as const;

export const LOYALTY_EARN_SPEND_STEP = 100;
export const LOYALTY_POINT_VALUE = 1;

export type CustomerTypeValue = (typeof CUSTOMER_TYPE_OPTIONS)[number];
export type CustomerLoyaltyLedgerTypeValue = (typeof CUSTOMER_LOYALTY_LEDGER_TYPE_OPTIONS)[number];
export type CustomerCreditStatusValue = (typeof CUSTOMER_CREDIT_STATUS_OPTIONS)[number];
export type CustomerTone = 'stone' | 'emerald' | 'amber' | 'red' | 'blue';
export type AgingBucketKey = (typeof AGING_BUCKET_KEYS)[number];

const CUSTOMER_TYPE_LABELS: Record<CustomerTypeValue, string> = {
  INDIVIDUAL: 'Individual',
  BUSINESS: 'Business'
};

const CUSTOMER_LOYALTY_TYPE_LABELS: Record<CustomerLoyaltyLedgerTypeValue, string> = {
  EARNED: 'Earned',
  REDEEMED: 'Redeemed',
  ADJUSTED: 'Adjusted'
};

const CUSTOMER_CREDIT_STATUS_LABELS: Record<CustomerCreditStatusValue, string> = {
  OPEN: 'Open',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  VOIDED: 'Voided'
};

export function getCustomerTypeLabel(type: CustomerTypeValue | string) {
  return CUSTOMER_TYPE_LABELS[type as CustomerTypeValue] ?? String(type).replaceAll('_', ' ');
}

export function getCustomerLoyaltyTypeLabel(type: CustomerLoyaltyLedgerTypeValue | string) {
  return CUSTOMER_LOYALTY_TYPE_LABELS[type as CustomerLoyaltyLedgerTypeValue] ?? String(type).replaceAll('_', ' ');
}

export function getCustomerCreditStatusLabel(status: CustomerCreditStatusValue | string) {
  return CUSTOMER_CREDIT_STATUS_LABELS[status as CustomerCreditStatusValue] ?? String(status).replaceAll('_', ' ');
}

export function customerTypeTone(type: CustomerTypeValue | string): CustomerTone {
  return type === 'BUSINESS' ? 'blue' : 'stone';
}

export function customerCreditStatusTone(status: CustomerCreditStatusValue | string): CustomerTone {
  switch (status) {
    case 'PAID':
      return 'emerald';
    case 'OVERDUE':
      return 'red';
    case 'PARTIALLY_PAID':
      return 'amber';
    case 'VOIDED':
      return 'stone';
    default:
      return 'blue';
  }
}

export function getCustomerDisplayName(customer: {
  type?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  businessName?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
}) {
  if (customer.type === 'BUSINESS' && customer.businessName?.trim()) {
    return customer.businessName.trim();
  }

  const fullName = [customer.firstName?.trim(), customer.lastName?.trim()].filter(Boolean).join(' ');
  if (fullName) {
    return fullName;
  }

  if (customer.contactPerson?.trim()) {
    return customer.contactPerson.trim();
  }

  if (customer.businessName?.trim()) {
    return customer.businessName.trim();
  }

  return customer.phone?.trim() || customer.email?.trim() || 'Unnamed customer';
}

export function calculatePointsEarned(netSaleAmount: number) {
  return Math.max(Math.floor(Math.max(netSaleAmount, 0) / LOYALTY_EARN_SPEND_STEP), 0);
}

export function calculateLoyaltyDiscount(pointsToRedeem: number) {
  return roundCurrency(Math.max(pointsToRedeem, 0) * LOYALTY_POINT_VALUE);
}

export function calculateCustomerLoyaltyBalance(
  entries: Array<{ type: string; points: number }>
) {
  return entries.reduce((sum, entry) => {
    if (entry.type === 'REDEEMED') {
      return sum - entry.points;
    }

    return sum + entry.points;
  }, 0);
}

export function normalizeCustomerCreditStatus(
  status: CustomerCreditStatusValue | string,
  dueDate: Date | string,
  balance: number
): CustomerCreditStatusValue {
  if (status === 'VOIDED') {
    return 'VOIDED';
  }

  if (balance <= 0) {
    return 'PAID';
  }

  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const now = new Date();

  if (due < now) {
    return status === 'PARTIALLY_PAID' ? 'OVERDUE' : 'OVERDUE';
  }

  return status === 'PARTIALLY_PAID' ? 'PARTIALLY_PAID' : 'OPEN';
}

export function bucketReceivableAmount(
  bucket: Record<AgingBucketKey, number>,
  dueDate: Date | string,
  balance: number
) {
  if (balance <= 0) {
    return bucket;
  }

  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    bucket.current += balance;
  } else if (diffDays <= 30) {
    bucket.days_1_30 += balance;
  } else if (diffDays <= 60) {
    bucket.days_31_60 += balance;
  } else {
    bucket.days_61_plus += balance;
  }

  return bucket;
}

export function createAgingBucketTotals() {
  return {
    current: 0,
    days_1_30: 0,
    days_31_60: 0,
    days_61_plus: 0
  } satisfies Record<AgingBucketKey, number>;
}

function serializeDecimal(value: DecimalLike | number | null | undefined) {
  if (value === null || value === undefined) {
    return '0';
  }

  if (typeof value === 'number') {
    return value.toString();
  }

  return value.toString();
}

function serializeDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export function serializeReceivablePayment<
  T extends {
    amount: DecimalLike;
    paidAt: Date;
    createdAt: Date;
  }
>(payment: T) {
  return {
    ...payment,
    amount: serializeDecimal(payment.amount),
    paidAt: payment.paidAt.toISOString(),
    createdAt: payment.createdAt.toISOString()
  };
}

export function serializeCustomerCreditLedger<
  T extends {
    originalAmount: DecimalLike;
    balance: DecimalLike;
    dueDate: Date;
    createdAt: Date;
    updatedAt: Date;
    payments?: Array<{
      amount: DecimalLike;
      paidAt: Date;
      createdAt: Date;
    }>;
    sale?: {
      totalAmount: DecimalLike;
      createdAt: Date;
    } | null;
  }
>(ledger: T) {
  return {
    ...ledger,
    originalAmount: serializeDecimal(ledger.originalAmount),
    balance: serializeDecimal(ledger.balance),
    dueDate: ledger.dueDate.toISOString(),
    createdAt: ledger.createdAt.toISOString(),
    updatedAt: ledger.updatedAt.toISOString(),
    sale: ledger.sale
      ? {
          ...ledger.sale,
          totalAmount: serializeDecimal(ledger.sale.totalAmount),
          createdAt: ledger.sale.createdAt.toISOString()
        }
      : ledger.sale,
    payments: ledger.payments?.map(serializeReceivablePayment)
  };
}

export function serializeCustomerLoyaltyLedger<
  T extends {
    createdAt: Date;
    sale?: {
      totalAmount: DecimalLike;
      createdAt: Date;
    } | null;
  }
>(entry: T) {
  return {
    ...entry,
    createdAt: entry.createdAt.toISOString(),
    sale: entry.sale
      ? {
          ...entry.sale,
          totalAmount: serializeDecimal(entry.sale.totalAmount),
          createdAt: entry.sale.createdAt.toISOString()
        }
      : entry.sale
  };
}

export function serializeCustomer<
  T extends {
    createdAt: Date;
    updatedAt: Date;
    sales?: Array<{
      totalAmount: DecimalLike;
      createdAt: Date;
    }>;
    loyaltyLedger?: Array<{
      createdAt: Date;
      sale?: {
        totalAmount: DecimalLike;
        createdAt: Date;
      } | null;
    }>;
    creditLedgers?: Array<{
      originalAmount: DecimalLike;
      balance: DecimalLike;
      dueDate: Date;
      createdAt: Date;
      updatedAt: Date;
      payments?: Array<{
        amount: DecimalLike;
        paidAt: Date;
        createdAt: Date;
      }>;
      sale?: {
        totalAmount: DecimalLike;
        createdAt: Date;
      } | null;
    }>;
  }
>(customer: T) {
  return {
    ...customer,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
    sales: customer.sales?.map((sale) => ({
      ...sale,
      totalAmount: serializeDecimal(sale.totalAmount),
      createdAt: sale.createdAt.toISOString()
    })),
    loyaltyLedger: customer.loyaltyLedger?.map(serializeCustomerLoyaltyLedger),
    creditLedgers: customer.creditLedgers?.map(serializeCustomerCreditLedger)
  };
}
