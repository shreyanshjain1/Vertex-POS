import { ShopRole } from '@prisma/client';
import {
  PERMISSION_KEYS,
  getDefaultPermissionState,
  getEffectivePermissionState,
  hasPermission,
  normalizePermissionOverride,
  sanitizePermissionList
} from '../../lib/permissions';

describe('lib/permissions', () => {
  it('removes invalid and duplicate permission values', () => {
    expect(sanitizePermissionList(['VIEW_REPORTS', 'VIEW_REPORTS', 'BAD_KEY', 123])).toEqual([
      'VIEW_REPORTS'
    ]);
  });

  it('maps default permissions correctly for cashier role', () => {
    const state = getDefaultPermissionState(ShopRole.CASHIER);

    expect(state.VOID_SALES).toBe(true);
    expect(state.REFUND_SALES).toBe(true);
    expect(state.MANAGE_STAFF).toBe(false);
    expect(Object.keys(state)).toHaveLength(PERMISSION_KEYS.length);
  });

  it('uses sanitized custom overrides when present', () => {
    const state = getEffectivePermissionState(ShopRole.MANAGER, ['MANAGE_STAFF', 'VIEW_REPORTS']);

    expect(state.MANAGE_STAFF).toBe(true);
    expect(state.VIEW_REPORTS).toBe(true);
    expect(state.EDIT_PRODUCTS).toBe(false);
    expect(hasPermission(ShopRole.MANAGER, ['MANAGE_STAFF'], 'MANAGE_STAFF')).toBe(true);
  });

  it('stores null override when selected permissions match the role defaults exactly', () => {
    expect(
      normalizePermissionOverride(ShopRole.ADMIN, [...PERMISSION_KEYS])
    ).toBeNull();
  });
});
