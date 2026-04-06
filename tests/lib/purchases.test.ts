import {
  canTransitionPurchaseStatus,
  derivePayableStatus,
  derivePurchaseReceiptStatus,
  getPurchaseRemainingUnitQty,
  getPurchaseStatusLabel,
  payableStatusTone,
  purchaseStatusTone,
  stripDateTime
} from '@/lib/purchases';

describe('purchases', () => {
  it('derives receipt status from received base quantities', () => {
    expect(
      derivePurchaseReceiptStatus([
        { qty: 10, ratioToBase: 1, receivedBaseQty: 0 },
        { qty: 5, ratioToBase: 1, receivedBaseQty: 0 }
      ])
    ).toBeNull();

    expect(
      derivePurchaseReceiptStatus([
        { qty: 10, ratioToBase: 1, receivedBaseQty: 4 },
        { qty: 5, ratioToBase: 1, receivedBaseQty: 0 }
      ])
    ).toBe('PARTIALLY_RECEIVED');

    expect(
      derivePurchaseReceiptStatus([
        { qty: 10, ratioToBase: 1, receivedBaseQty: 10 },
        { qty: 5, ratioToBase: 1, receivedBaseQty: 5 }
      ])
    ).toBe('FULLY_RECEIVED');
  });

  it('computes remaining unit quantity from base quantities', () => {
    expect(
      getPurchaseRemainingUnitQty({ qty: 12, ratioToBase: 2, receivedBaseQty: 9 })
    ).toBe(8);
  });

  it('allows only the declared manual transitions', () => {
    expect(canTransitionPurchaseStatus('DRAFT', 'SENT')).toBe(true);
    expect(canTransitionPurchaseStatus('SENT', 'DRAFT')).toBe(true);
    expect(canTransitionPurchaseStatus('PARTIALLY_RECEIVED', 'CLOSED')).toBe(true);
    expect(canTransitionPurchaseStatus('FULLY_RECEIVED', 'CLOSED')).toBe(true);
    expect(canTransitionPurchaseStatus('SENT', 'CLOSED')).toBe(false);
    expect(canTransitionPurchaseStatus('CANCELLED', 'DRAFT')).toBe(false);
  });

  it('derives payable status using paid amount and due date', () => {
    const today = new Date('2026-04-06T10:00:00+08:00');

    expect(
      derivePayableStatus({ totalAmount: 500, amountPaid: 500, dueDate: today, today })
    ).toBe('PAID');

    expect(
      derivePayableStatus({
        totalAmount: 500,
        amountPaid: 100,
        dueDate: new Date('2026-04-07T10:00:00+08:00'),
        today
      })
    ).toBe('PARTIALLY_PAID');

    expect(
      derivePayableStatus({
        totalAmount: 500,
        amountPaid: 0,
        dueDate: new Date('2026-04-05T10:00:00+08:00'),
        today
      })
    ).toBe('OVERDUE');

    expect(
      derivePayableStatus({
        totalAmount: 500,
        amountPaid: 0,
        dueDate: new Date('2026-04-07T10:00:00+08:00'),
        today
      })
    ).toBe('UNPAID');
  });

  it('returns readable labels and tones', () => {
    expect(getPurchaseStatusLabel('FULLY_RECEIVED')).toBe('Received in full');
    expect(purchaseStatusTone('PARTIALLY_RECEIVED')).toBe('blue');
    expect(payableStatusTone('OVERDUE')).toBe('red');
  });

  it('strips time but preserves calendar date', () => {
    const value = new Date('2026-04-06T18:45:10.123+08:00');
    const stripped = stripDateTime(value);

    expect(stripped.getHours()).toBe(0);
    expect(stripped.getMinutes()).toBe(0);
    expect(stripped.getSeconds()).toBe(0);
    expect(stripped.getFullYear()).toBe(value.getFullYear());
    expect(stripped.getMonth()).toBe(value.getMonth());
    expect(stripped.getDate()).toBe(value.getDate());
  });
});
