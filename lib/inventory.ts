export type SaleInputItem = {
  productId: string;
  variantId?: string | null;
  priceSnapshot?: number | null;
  qty: number;
};

export type PurchaseInputItem = {
  productId: string;
  unitOfMeasureId: string;
  qty: number;
  unitCost: number;
  ratioToBase?: number;
};

export type StockLevel = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  return trimmed.length ? trimmed : null;
}

export function collapseSaleItems(items: SaleInputItem[]) {
  const grouped = new Map<string, { qty: number; variantId: string | null; priceSnapshot: number | null }>();

  for (const item of items) {
    const variantId = item.variantId ?? null;
    const priceSnapshot =
      item.priceSnapshot === null || item.priceSnapshot === undefined
        ? null
        : roundCurrency(Number(item.priceSnapshot));
    const key = `${item.productId}:${variantId ?? 'base'}:${priceSnapshot ?? 'live'}`;
    const current = grouped.get(key) ?? { qty: 0, variantId, priceSnapshot };
    current.qty += item.qty;
    grouped.set(key, current);
  }

  return [...grouped.entries()].map(([key, value]) => {
    const [productId] = key.split(':');
    return {
      productId,
      variantId: value.variantId,
      priceSnapshot: value.priceSnapshot,
      qty: value.qty
    };
  });
}

export function collapsePurchaseItems(items: PurchaseInputItem[]) {
  const grouped = new Map<string, { qty: number; extendedCost: number; ratioToBase: number }>();

  for (const item of items) {
    const ratioToBase = item.ratioToBase ?? 1;
    const key = `${item.productId}:${item.unitOfMeasureId}:${ratioToBase}:${item.unitCost}`;
    const current = grouped.get(key) ?? { qty: 0, extendedCost: 0, ratioToBase };
    current.qty += item.qty;
    current.extendedCost += item.qty * item.unitCost;
    grouped.set(key, current);
  }

  return [...grouped.entries()].map(([key, value]) => {
    const [productId, unitOfMeasureId] = key.split(':');
    return ({
      productId,
      unitOfMeasureId,
      qty: value.qty,
      ratioToBase: value.ratioToBase,
      unitCost: value.qty > 0 ? roundCurrency(value.extendedCost / value.qty) : 0
    });
  });
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
