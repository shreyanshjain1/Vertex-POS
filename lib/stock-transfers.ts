export const STOCK_TRANSFER_STATUS_OPTIONS = ['DRAFT', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'] as const;

export type StockTransferStatusValue = (typeof STOCK_TRANSFER_STATUS_OPTIONS)[number];
export type StockTransferTone = 'stone' | 'emerald' | 'amber' | 'red' | 'blue';

const STOCK_TRANSFER_STATUS_LABELS: Record<StockTransferStatusValue, string> = {
  DRAFT: 'Pending dispatch',
  IN_TRANSIT: 'Sent to destination',
  RECEIVED: 'Received by destination',
  CANCELLED: 'Cancelled'
};

export function getStockTransferStatusLabel(status: StockTransferStatusValue | string) {
  return STOCK_TRANSFER_STATUS_LABELS[status as StockTransferStatusValue] ?? String(status).replaceAll('_', ' ');
}

export function stockTransferStatusTone(status: StockTransferStatusValue | string): StockTransferTone {
  switch (status) {
    case 'RECEIVED':
      return 'emerald';
    case 'IN_TRANSIT':
      return 'blue';
    case 'CANCELLED':
      return 'red';
    default:
      return 'amber';
  }
}

function serializeDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export function serializeStockTransferItem<
  T extends {
    createdAt: Date;
  }
>(item: T) {
  return {
    ...item,
    createdAt: item.createdAt.toISOString()
  };
}

export function serializeStockTransfer<
  T extends {
    sentAt: Date | null;
    receivedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    items?: Array<{
      createdAt: Date;
    }>;
  }
>(stockTransfer: T) {
  return {
    ...stockTransfer,
    sentAt: serializeDate(stockTransfer.sentAt),
    receivedAt: serializeDate(stockTransfer.receivedAt),
    createdAt: stockTransfer.createdAt.toISOString(),
    updatedAt: stockTransfer.updatedAt.toISOString(),
    items: stockTransfer.items?.map(serializeStockTransferItem)
  };
}
