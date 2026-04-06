import {
  getPaymentSummary,
  getQuickCashAmounts,
  getSalePaymentSummaryLabel,
  normalizePaymentInput,
  requiresReferenceNumber,
  validatePaymentsForSale
} from '@/lib/payments';

describe('payments', () => {
  it('requires reference numbers only for card and e-wallet', () => {
    expect(requiresReferenceNumber('Cash')).toBe(false);
    expect(requiresReferenceNumber('Bank Transfer')).toBe(false);
    expect(requiresReferenceNumber('Card')).toBe(true);
    expect(requiresReferenceNumber('E-Wallet')).toBe(true);
  });

  it('normalizes amounts and trims empty reference numbers', () => {
    expect(
      normalizePaymentInput({ method: 'Cash', amount: 123.456, referenceNumber: '   ' })
    ).toEqual({
      method: 'Cash',
      amount: 123.46,
      referenceNumber: null
    });
  });

  it('returns cash change when cash overpays the balance', () => {
    const result = getPaymentSummary(150, [
      { method: 'Cash', amount: 200 },
      { method: 'Card', amount: 20, referenceNumber: 'REF-1' }
    ]);

    expect(result).toEqual({
      totalPaid: 220,
      remainingAmount: 0,
      changeDue: 70,
      cashReceived: 200,
      hasCashPayment: true
    });
  });

  it('rejects non-cash overpayment', () => {
    const result = validatePaymentsForSale(100, [
      { method: 'Card', amount: 60, referenceNumber: 'A1' },
      { method: 'Bank Transfer', amount: 50 }
    ]);

    expect(result).toEqual({
      ok: false,
      error: 'Non-cash payments must match the sale total exactly.'
    });
  });

  it('rejects card and e-wallet rows with no reference number', () => {
    const result = validatePaymentsForSale(100, [
      { method: 'Card', amount: 100, referenceNumber: '' }
    ]);

    expect(result).toEqual({
      ok: false,
      error: 'Card payments require a reference number.'
    });
  });

  it('accepts split payment where only the cash line exceeds the remaining amount', () => {
    const result = validatePaymentsForSale(100, [
      { method: 'Card', amount: 20, referenceNumber: 'CARD-1' },
      { method: 'Cash', amount: 100 }
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary.changeDue).toBe(20);
      expect(result.summary.totalPaid).toBe(120);
      expect(result.summary.cashReceived).toBe(100);
    }
  });

  it('produces readable payment labels for single and split tenders', () => {
    expect(getSalePaymentSummaryLabel([{ method: 'Cash' }, { method: 'Cash' }])).toBe('Cash');
    expect(getSalePaymentSummaryLabel([{ method: 'Cash' }, { method: 'Card' }])).toBe('Split');
  });

  it('builds sorted quick-cash suggestions without duplicates', () => {
    expect(getQuickCashAmounts(0)).toEqual([]);
    expect(getQuickCashAmounts(83)).toEqual([83, 100, 200, 500, 1000]);
    expect(getQuickCashAmounts(100)).toEqual([100, 200, 500, 1000]);
  });
});
