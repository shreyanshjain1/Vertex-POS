import type { Prisma } from '@prisma/client';

export const recentSaleCardSelect = {
  id: true,
  saleNumber: true,
  receiptNumber: true,
  paymentMethod: true,
  cashierName: true,
  createdAt: true,
  totalAmount: true,
  items: {
    select: {
      id: true,
      productName: true,
      qty: true,
      unitPrice: true,
      lineTotal: true
    }
  }
} satisfies Prisma.SaleSelect;

type RecentSaleCardRecord = Prisma.SaleGetPayload<{
  select: typeof recentSaleCardSelect;
}>;

export type SerializedRecentSale = {
  id: string;
  saleNumber: string;
  receiptNumber: string;
  paymentMethod: string;
  cashierName: string | null;
  createdAt: string;
  totalAmount: string;
  items: {
    id: string;
    productName: string;
    qty: number;
    unitPrice: string;
    lineTotal: string;
  }[];
};

export function serializeRecentSale(sale: RecentSaleCardRecord): SerializedRecentSale {
  return {
    id: sale.id,
    saleNumber: sale.saleNumber,
    receiptNumber: sale.receiptNumber,
    paymentMethod: sale.paymentMethod,
    cashierName: sale.cashierName,
    createdAt: sale.createdAt.toISOString(),
    totalAmount: sale.totalAmount.toString(),
    items: sale.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      qty: item.qty,
      unitPrice: item.unitPrice.toString(),
      lineTotal: item.lineTotal.toString()
    }))
  };
}

export const lowStockCardProductSelect = {
  id: true,
  name: true,
  stockQty: true,
  reorderPoint: true,
  price: true,
  category: {
    select: {
      name: true
    }
  }
} satisfies Prisma.ProductSelect;

type LowStockCardProductRecord = Prisma.ProductGetPayload<{
  select: typeof lowStockCardProductSelect;
}>;

export type SerializedLowStockProduct = {
  id: string;
  name: string;
  stockQty: number;
  reorderPoint: number;
  price: string;
  category: {
    name: string;
  } | null;
};

export function serializeLowStockProduct(product: LowStockCardProductRecord): SerializedLowStockProduct {
  return {
    id: product.id,
    name: product.name,
    stockQty: product.stockQty,
    reorderPoint: product.reorderPoint,
    price: product.price.toString(),
    category: product.category
  };
}
