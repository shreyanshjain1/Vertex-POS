import { describe, expect, it } from 'vitest';
import {
  PARKED_SALE_TTL_HOURS,
  QUOTE_TTL_DAYS,
  calculateParkedSaleTotals,
  createQuoteReference,
  getParkedSaleExpiresAt,
  getParkedSaleTypeLabel
} from '@/lib/parked-sales-utils';

describe('parked sales utils', () => {
  it('uses parked sale ttl hours for saved carts', () => {
    const now = new Date('2026-04-07T10:00:00.000Z');
    const expiresAt = getParkedSaleExpiresAt('SAVED_CART', now);

    expect(expiresAt.toISOString()).toBe(
      new Date(now.getTime() + PARKED_SALE_TTL_HOURS * 60 * 60 * 1000).toISOString()
    );
  });

  it('uses quote ttl days for quotes', () => {
    const now = new Date('2026-04-07T10:00:00.000Z');
    const expiresAt = getParkedSaleExpiresAt('QUOTE', now);

    expect(expiresAt.toISOString()).toBe(
      new Date(now.getTime() + QUOTE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
    );
  });

  it('creates a quote reference with the expected prefix and date format', () => {
    const now = new Date('2026-04-07T08:09:10.000Z');

    expect(createQuoteReference(now)).toBe('QT-20260407-080910');
  });

  it('returns a readable type label', () => {
    expect(getParkedSaleTypeLabel('SAVED_CART')).toBe('Saved cart');
    expect(getParkedSaleTypeLabel('QUOTE')).toBe('Quote');
  });

  it('calculates parked sale totals correctly', () => {
    const totals = calculateParkedSaleTotals({
      items: [
        { qty: 2, unitPrice: 100 },
        { qty: 1, unitPrice: 50.25 }
      ],
      taxRate: 12,
      discountAmount: 20
    });

    expect(totals).toEqual({
      subtotal: 250.25,
      taxAmount: 30.03,
      discountAmount: 20,
      totalAmount: 260.28
    });
  });

  it('supports zero discount totals', () => {
    const totals = calculateParkedSaleTotals({
      items: [{ qty: 3, unitPrice: 99.99 }],
      taxRate: 0,
      discountAmount: 0
    });

    expect(totals).toEqual({
      subtotal: 299.97,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: 299.97
    });
  });
});