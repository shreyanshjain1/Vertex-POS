import { ParkedSale, ParkedSaleItem, Prisma, ShopRole, User } from '@prisma/client';
import { hasRole } from '@/lib/authz';
import { roundCurrency } from '@/lib/inventory';
import { prisma } from '@/lib/prisma';

type ParkedSalesDb = Prisma.TransactionClient | typeof prisma;

export const PARKED_SALE_TTL_HOURS = 24;

type ParkedSaleRecord = ParkedSale & {
  cashier?: Pick<User, 'id' | 'name' | 'email'> | null;
  items: ParkedSaleItem[];
};

export type SerializedParkedSale = {
  id: string;
  shopId: string;
  cashierUserId: string;
  cashierName: string;
  cashierEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  notes: string | null;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  status: ParkedSale['status'];
  expiresAt: string;
  resumedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    qty: number;
    unitPrice: string;
    lineTotal: string;
    createdAt: string;
  }>;
};

export function getParkedSaleExpiresAt(now = new Date()) {
  return new Date(now.getTime() + PARKED_SALE_TTL_HOURS * 60 * 60 * 1000);
}

export async function cleanupExpiredParkedSales(db: ParkedSalesDb, shopId: string) {
  return db.parkedSale.updateMany({
    where: {
      shopId,
      status: 'HELD',
      expiresAt: {
        lt: new Date()
      }
    },
    data: {
      status: 'EXPIRED'
    }
  });
}

export function getParkedSaleVisibilityWhere(shopId: string, role: ShopRole, userId: string) {
  return {
    shopId,
    status: 'HELD' as const,
    expiresAt: {
      gt: new Date()
    },
    ...(hasRole(role, 'MANAGER') ? {} : { cashierUserId: userId })
  };
}

export function canManageAllParkedSales(role: ShopRole) {
  return hasRole(role, 'MANAGER');
}

export function serializeParkedSale(record: ParkedSaleRecord): SerializedParkedSale {
  return {
    id: record.id,
    shopId: record.shopId,
    cashierUserId: record.cashierUserId,
    cashierName:
      record.cashier?.name ??
      record.cashier?.email?.split('@')[0] ??
      'Cashier',
    cashierEmail: record.cashier?.email ?? null,
    customerName: record.customerName ?? null,
    customerPhone: record.customerPhone ?? null,
    notes: record.notes ?? null,
    subtotal: record.subtotal.toString(),
    taxAmount: record.taxAmount.toString(),
    discountAmount: record.discountAmount.toString(),
    totalAmount: record.totalAmount.toString(),
    status: record.status,
    expiresAt: record.expiresAt.toISOString(),
    resumedAt: record.resumedAt?.toISOString() ?? null,
    cancelledAt: record.cancelledAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    itemCount: record.items.reduce((sum, item) => sum + item.qty, 0),
    items: record.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      qty: item.qty,
      unitPrice: item.unitPrice.toString(),
      lineTotal: item.lineTotal.toString(),
      createdAt: item.createdAt.toISOString()
    }))
  };
}

export function calculateParkedSaleTotals(input: {
  items: Array<{ qty: number; unitPrice: number }>;
  taxRate: number;
  discountAmount: number;
}) {
  const subtotal = roundCurrency(
    input.items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0)
  );
  const taxAmount = roundCurrency(subtotal * (input.taxRate / 100));
  const discountAmount = roundCurrency(input.discountAmount);
  const totalAmount = roundCurrency(subtotal + taxAmount - discountAmount);

  return {
    subtotal,
    taxAmount,
    discountAmount,
    totalAmount
  };
}
