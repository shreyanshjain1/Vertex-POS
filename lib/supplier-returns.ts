type DecimalLike = { toString(): string };

export const SUPPLIER_RETURN_CREATE_STATUS_OPTIONS = ['DRAFT', 'POSTED'] as const;
export const SUPPLIER_RETURN_STATUS_OPTIONS = ['DRAFT', 'POSTED', 'CANCELLED'] as const;
export const SUPPLIER_RETURN_REASON_OPTIONS = [
  'DAMAGED_FROM_SUPPLIER',
  'WRONG_ITEM',
  'OVER_DELIVERY',
  'EXPIRED_ON_RECEIPT',
  'QUALITY_ISSUE'
] as const;
export const SUPPLIER_RETURN_DISPOSITION_OPTIONS = ['SELLABLE', 'DAMAGED', 'EXPIRED'] as const;
export const SUPPLIER_CREDIT_MEMO_STATUS_OPTIONS = ['PENDING', 'ISSUED', 'APPLIED'] as const;

export type SupplierReturnCreateStatus = (typeof SUPPLIER_RETURN_CREATE_STATUS_OPTIONS)[number];
export type SupplierReturnStatusValue = (typeof SUPPLIER_RETURN_STATUS_OPTIONS)[number];
export type SupplierReturnReasonValue = (typeof SUPPLIER_RETURN_REASON_OPTIONS)[number];
export type SupplierReturnDispositionValue = (typeof SUPPLIER_RETURN_DISPOSITION_OPTIONS)[number];
export type SupplierCreditMemoStatusValue = (typeof SUPPLIER_CREDIT_MEMO_STATUS_OPTIONS)[number];
export type SupplierReturnTone = 'stone' | 'emerald' | 'amber' | 'red' | 'blue';

const SUPPLIER_RETURN_STATUS_LABELS: Record<SupplierReturnStatusValue, string> = {
  DRAFT: 'Draft',
  POSTED: 'Posted',
  CANCELLED: 'Cancelled'
};

const SUPPLIER_RETURN_REASON_LABELS: Record<SupplierReturnReasonValue, string> = {
  DAMAGED_FROM_SUPPLIER: 'Damaged from supplier',
  WRONG_ITEM: 'Wrong item',
  OVER_DELIVERY: 'Over-delivery',
  EXPIRED_ON_RECEIPT: 'Expired on receipt',
  QUALITY_ISSUE: 'Quality issue'
};

const SUPPLIER_RETURN_DISPOSITION_LABELS: Record<SupplierReturnDispositionValue, string> = {
  SELLABLE: 'Sellable',
  DAMAGED: 'Damaged',
  EXPIRED: 'Expired'
};

const SUPPLIER_CREDIT_MEMO_STATUS_LABELS: Record<SupplierCreditMemoStatusValue, string> = {
  PENDING: 'Pending',
  ISSUED: 'Issued',
  APPLIED: 'Applied'
};

export function getSupplierReturnStatusLabel(status: SupplierReturnStatusValue | string) {
  return SUPPLIER_RETURN_STATUS_LABELS[status as SupplierReturnStatusValue] ?? String(status).replaceAll('_', ' ');
}

export function getSupplierReturnReasonLabel(reason: SupplierReturnReasonValue | string) {
  return SUPPLIER_RETURN_REASON_LABELS[reason as SupplierReturnReasonValue] ?? String(reason).replaceAll('_', ' ');
}

export function getSupplierReturnDispositionLabel(disposition: SupplierReturnDispositionValue | string) {
  return SUPPLIER_RETURN_DISPOSITION_LABELS[disposition as SupplierReturnDispositionValue] ?? String(disposition).replaceAll('_', ' ');
}

export function getSupplierCreditMemoStatusLabel(status: SupplierCreditMemoStatusValue | string) {
  return SUPPLIER_CREDIT_MEMO_STATUS_LABELS[status as SupplierCreditMemoStatusValue] ?? String(status).replaceAll('_', ' ');
}

export function supplierReturnStatusTone(status: SupplierReturnStatusValue | string): SupplierReturnTone {
  switch (status) {
    case 'POSTED':
      return 'emerald';
    case 'CANCELLED':
      return 'red';
    default:
      return 'stone';
  }
}

export function supplierCreditMemoStatusTone(status: SupplierCreditMemoStatusValue | string): SupplierReturnTone {
  switch (status) {
    case 'APPLIED':
      return 'emerald';
    case 'ISSUED':
      return 'blue';
    default:
      return 'amber';
  }
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

export function serializeSupplierReturnItem<
  T extends {
    unitCost: DecimalLike;
    lineTotal: DecimalLike;
    createdAt: Date;
  }
>(item: T) {
  return {
    ...item,
    unitCost: serializeDecimal(item.unitCost),
    lineTotal: serializeDecimal(item.lineTotal),
    createdAt: item.createdAt.toISOString()
  };
}

export function serializeSupplierReturn<
  T extends {
    creditAmount: DecimalLike;
    creditMemoDate: Date | null;
    postedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    items?: Array<{
      unitCost: DecimalLike;
      lineTotal: DecimalLike;
      createdAt: Date;
    }>;
  }
>(supplierReturn: T) {
  return {
    ...supplierReturn,
    creditAmount: serializeDecimal(supplierReturn.creditAmount),
    creditMemoDate: serializeDate(supplierReturn.creditMemoDate),
    postedAt: serializeDate(supplierReturn.postedAt),
    createdAt: supplierReturn.createdAt.toISOString(),
    updatedAt: supplierReturn.updatedAt.toISOString(),
    items: supplierReturn.items?.map(serializeSupplierReturnItem)
  };
}
