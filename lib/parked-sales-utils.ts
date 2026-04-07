import { ParkedSaleType } from '@prisma/client';
import { roundCurrency } from '@/lib/inventory';

export const PARKED_SALE_TTL_HOURS = 24;
export const QUOTE_TTL_DAYS = 30;

export function getParkedSaleExpiresAt(type: ParkedSaleType = 'SAVED_CART', now = new Date()) {
  if (type === 'QUOTE') {
    return new Date(now.getTime() + QUOTE_TTL_DAYS * 24 * 60 * 60 * 1000);
  }

  return new Date(now.getTime() + PARKED_SALE_TTL_HOURS * 60 * 60 * 1000);
}

export function createQuoteReference(now = new Date()) {
  const compactDate = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeFragment = `${now.getHours().toString().padStart(2, '0')}${now
    .getMinutes()
    .toString()
    .padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;

  return `QT-${compactDate}-${timeFragment}`;
}

export function getParkedSaleTypeLabel(type: ParkedSaleType) {
  return type === 'QUOTE' ? 'Quote' : 'Saved cart';
}

export function calculateParkedSaleTotals(input: {
  items: Array<{ qty: number; unitPrice: number }>;
  taxRate: number;
  discountAmount: number;
}) {
  const subtotal = roundCurrency(input.items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0));
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