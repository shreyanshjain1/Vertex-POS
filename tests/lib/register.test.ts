import {
  calculateDenominationTotal,
  createEmptyDenominationSnapshot,
  getCashMovementLabel,
  getCashMovementSignedAmount,
  isOpenCashSessionStatus,
  normalizeDenominationSnapshot
} from '@/lib/register';

describe('register', () => {
  it('creates an empty denomination snapshot with all values initialized to zero', () => {
    const snapshot = createEmptyDenominationSnapshot();

    expect(snapshot['1000.00']).toBe(0);
    expect(snapshot['0.25']).toBe(0);
    expect(Object.values(snapshot).every((value) => value === 0)).toBe(true);
  });

  it('normalizes mixed denomination input safely', () => {
    const snapshot = normalizeDenominationSnapshot({
      '1000.00': 1,
      '500.00': '2',
      '20.00': 3.9,
      '10.00': -5,
      '1.00': 'bad'
    });

    expect(snapshot['1000.00']).toBe(1);
    expect(snapshot['500.00']).toBe(2);
    expect(snapshot['20.00']).toBe(3);
    expect(snapshot['10.00']).toBe(0);
    expect(snapshot['1.00']).toBe(0);
  });

  it('calculates denomination totals using registered values', () => {
    const total = calculateDenominationTotal({
      ...createEmptyDenominationSnapshot(),
      '1000.00': 1,
      '500.00': 2,
      '20.00': 3,
      '0.25': 4
    });

    expect(total).toBe(1561);
  });

  it('returns movement labels and signed amounts consistently', () => {
    expect(getCashMovementLabel('CASH_DROP')).toBe('Cash drop');
    expect(getCashMovementLabel('PETTY_CASH')).toBe('Petty cash');
    expect(getCashMovementLabel('MANUAL_CORRECTION')).toBe('Manual correction');
    expect(getCashMovementLabel('PAYOUT')).toBe('Payout');

    expect(getCashMovementSignedAmount('MANUAL_CORRECTION', 50)).toBe(50);
    expect(getCashMovementSignedAmount('PAYOUT', 50)).toBe(-50);
  });

  it('identifies open sessions correctly', () => {
    expect(isOpenCashSessionStatus('OPEN')).toBe(true);
    expect(isOpenCashSessionStatus('CLOSED')).toBe(false);
    expect(isOpenCashSessionStatus('RECONCILED')).toBe(false);
  });
});
