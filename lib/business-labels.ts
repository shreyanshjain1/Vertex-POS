export function humanizeEnumLabel(value: string | null | undefined) {
  if (!value) {
    return 'N/A';
  }

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getSaleStatusLabel(status: string | null | undefined) {
  switch (status) {
    case 'COMPLETED':
      return 'Completed';
    case 'VOIDED':
      return 'Voided';
    default:
      return humanizeEnumLabel(status);
  }
}

export function getAdjustmentTypeLabel(type: string | null | undefined) {
  switch (type) {
    case 'REFUND':
      return 'Refund';
    case 'EXCHANGE':
      return 'Exchange';
    case 'VOID':
      return 'Void';
    default:
      return humanizeEnumLabel(type);
  }
}

export function getInventoryMovementTypeLabel(type: string | null | undefined) {
  switch (type) {
    case 'PURCHASE_RECEIVED':
      return 'Purchase received';
    case 'SUPPLIER_RETURN_POSTED':
      return 'Supplier return sent';
    case 'SALE_COMPLETED':
      return 'Sale completed';
    case 'SALE_VOIDED':
      return 'Void restock';
    case 'RETURN_RESTOCKED':
      return 'Customer return restocked';
    case 'EXCHANGE_ISSUED':
      return 'Exchange issued';
    case 'STOCK_COUNT_POSTED':
      return 'Stock count variance posted';
    case 'MANUAL_ADJUSTMENT':
      return 'Reason-coded stock correction';
    case 'OPENING_STOCK':
      return 'Opening stock';
    case 'TRANSFER_OUT':
      return 'Branch transfer sent';
    case 'TRANSFER_IN':
      return 'Branch transfer received';
    default:
      return humanizeEnumLabel(type);
  }
}

export function getStockCountStatusLabel(status: string | null | undefined) {
  switch (status) {
    case 'DRAFT':
      return 'Planned';
    case 'IN_PROGRESS':
      return 'Counting in progress';
    case 'SUBMITTED':
      return 'Awaiting approval';
    case 'APPROVED':
      return 'Ready to post';
    case 'POSTED':
      return 'Posted to inventory';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return humanizeEnumLabel(status);
  }
}

export function getRegisterSessionStatusLabel(status: string | null | undefined) {
  switch (status) {
    case 'OPEN':
      return 'Open register';
    case 'CLOSED':
      return 'Closed';
    case 'OVERRIDE_CLOSED':
      return 'Manager closed';
    default:
      return humanizeEnumLabel(status);
  }
}
