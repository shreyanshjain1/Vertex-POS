import {
  getAdjustmentTypeLabel,
  getInventoryMovementTypeLabel,
  getRegisterSessionStatusLabel,
  getSaleStatusLabel,
  getStockCountStatusLabel,
  humanizeEnumLabel
} from '../../lib/business-labels';

describe('lib/business-labels', () => {
  it('humanizes unknown enum-like values', () => {
    expect(humanizeEnumLabel('CUSTOM_MIXED_CASE')).toBe('Custom Mixed Case');
    expect(humanizeEnumLabel(null)).toBe('N/A');
  });

  it('returns explicit business labels for key sale and adjustment states', () => {
    expect(getSaleStatusLabel('COMPLETED')).toBe('Completed');
    expect(getAdjustmentTypeLabel('VOID')).toBe('Void');
    expect(getRegisterSessionStatusLabel('OPEN')).toBe('Open register');
    expect(getStockCountStatusLabel('IN_PROGRESS')).toBe('Counting in progress');
  });

  it('returns inventory movement labels for operational history', () => {
    expect(getInventoryMovementTypeLabel('PURCHASE_RECEIVED')).toBe('Purchase received');
    expect(getInventoryMovementTypeLabel('TRANSFER_IN')).toBe('Branch transfer received');
  });
});
