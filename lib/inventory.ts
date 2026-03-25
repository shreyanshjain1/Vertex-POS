export type SaleInputItem = {
  productId: string;
  qty: number;
};

export type PurchaseInputItem = {
  productId: string;
  qty: number;
  unitCost: number;
};

export type StockLevel = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  return trimmed.length ? trimmed : null;
}

export function collapseSaleItems(items: SaleInputItem[]) {
  const grouped = new Map<string, number>();

  for (const item of items) {
    grouped.set(item.productId, (grouped.get(item.productId) ?? 0) + item.qty);
  }

  return [...grouped.entries()].map(([productId, qty]) => ({ productId, qty }));
}

export function collapsePurchaseItems(items: PurchaseInputItem[]) {
  const grouped = new Map<string, { qty: number; extendedCost: number }>();

  for (const item of items) {
    const current = grouped.get(item.productId) ?? { qty: 0, extendedCost: 0 };
    current.qty += item.qty;
    current.extendedCost += item.qty * item.unitCost;
    grouped.set(item.productId, current);
  }

  return [...grouped.entries()].map(([productId, value]) => ({
    productId,
    qty: value.qty,
    unitCost: value.qty > 0 ? roundCurrency(value.extendedCost / value.qty) : 0
  }));
}

export function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function getStockLevel(stockQty: number, reorderPoint: number, fallbackThreshold = 0): StockLevel {
  if (stockQty <= 0) {
    return 'OUT_OF_STOCK';
  }

  const threshold = Math.max(reorderPoint, fallbackThreshold);
  if (stockQty <= threshold) {
    return 'LOW_STOCK';
  }

  return 'IN_STOCK';
}

export function stockLevelLabel(level: StockLevel) {
  switch (level) {
    case 'OUT_OF_STOCK':
      return 'Out of stock';
    case 'LOW_STOCK':
      return 'Low stock';
    default:
      return 'In stock';
  }
}
