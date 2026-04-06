import { describe, expect, it } from 'vitest';
import { createQuoteReference, getParkedSaleExpiresAt, getParkedSaleTypeLabel } from '@/lib/parked-sales';

describe('parked sales helpers', () => {
  it('gives quotes a longer expiry window than saved carts', () => {
    const now = new Date('2026-04-06T00:00:00.000Z');
    const savedCartExpiry = getParkedSaleExpiresAt('SAVED_CART', now);
    const quoteExpiry = getParkedSaleExpiresAt('QUOTE', now);

    expect(savedCartExpiry.toISOString()).toBe('2026-04-07T00:00:00.000Z');
    expect(quoteExpiry.toISOString()).toBe('2026-05-06T00:00:00.000Z');
  });

  it('creates quote references with the expected prefix', () => {
    const reference = createQuoteReference(new Date('2026-04-06T10:11:12.000Z'));
    expect(reference).toBe('QT-20260406-101112');
  });

  it('returns user-friendly parked sale labels', () => {
    expect(getParkedSaleTypeLabel('SAVED_CART')).toBe('Saved cart');
    expect(getParkedSaleTypeLabel('QUOTE')).toBe('Quote');
  });
});
