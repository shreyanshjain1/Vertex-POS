import { ShopRole } from '@prisma/client';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';

const ROLE_WEIGHT: Record<ShopRole, number> = {
  CASHIER: 1,
  MANAGER: 2,
  ADMIN: 3
};

export async function requireRole(minRole: ShopRole) {
  const context = await getActiveShopContext();
  if (ROLE_WEIGHT[context.role] < ROLE_WEIGHT[minRole]) {
    throw new Error('Forbidden');
  }
  return context;
}

export function hasRole(role: ShopRole, minRole: ShopRole) {
  return ROLE_WEIGHT[role] >= ROLE_WEIGHT[minRole];
}
