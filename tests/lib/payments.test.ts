import { describe, expect, it } from 'vitest';
import {
  getPaymentSummary,
  normalizePaymentInput,
  requiresReferenceNumber,
  validatePaymentsForSale
} from '@/lib/payments';

describe('payments', () => {
  it('requires references for card, e-wallet, and bank transfer payments', () => {
    expect(requiresReferenceNumber('Cash')).toBe(false);
    expect(requiresReferenceNumber('Card')).toBe(true);
    expect(requiresReferenceNumber('E-Wallet')).toBe(true);
    expect(requiresReferenceNumber('Bank Transfer')).toBe(true);
  });

  it('normalizes payment input amounts and empty references', () => {
    expect(
      normalizePaymentInput({
        method: 'Cash',
        amount: 100.456,
        referenceNumber: '   '
      })
    ).toEqual({
      method: 'Cash',
      amount: 100.46,
      referenceNumber: null
    });
  });

  it('rejects missing bank transfer references', () => {
    const result = validatePaymentsForSale(500, [
      { method: 'Bank Transfer', amount: 500, referenceNumber: null }
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Bank Transfer payments require a reference number.');
    }
  });

  it('rejects duplicate non-cash references for the same payment method', () => {
    const result = validatePaymentsForSale(500, [
      { method: 'Card', amount: 250, referenceNumber: 'ABC123' },
      { method: 'Card', amount: 250, referenceNumber: 'abc123' }
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Duplicate card reference numbers are not allowed in one sale.');
    }
  });

  it('allows cash overpayment while returning change', () => {
    const result = validatePaymentsForSale(500, [
      { method: 'Cash', amount: 1000, referenceNumber: null }
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary.changeDue).toBe(500);
      expect(result.summary.totalPaid).toBe(1000);
    }
  });

  it('blocks non-cash overpayment', () => {
    const result = validatePaymentsForSale(500, [
      { method: 'Card', amount: 600, referenceNumber: 'CARD-1' }
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Non-cash payments must match the sale total exactly.');
    }
  });

  it('summarizes mixed cash and non-cash tenders correctly', () => {
    const summary = getPaymentSummary(500, [
      { method: 'Cash', amount: 300, referenceNumber: null },
      { method: 'Card', amount: 200, referenceNumber: 'CARD-2' }
    ]);

    expect(summary).toEqual({
      totalPaid: 500,
      remainingAmount: 0,
      changeDue: 0,
      cashReceived: 300,
      hasCashPayment: true
    });
  });
});
