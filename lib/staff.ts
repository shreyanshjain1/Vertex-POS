import { Prisma, ShopRole } from '@prisma/client';
import { hasPermission as membershipHasPermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

export const STAFF_LOGIN_ACTION = 'LOGIN_SUCCESS';

export async function getManagedShops(userId: string) {
  const [ownedShops, memberships] = await Promise.all([
    prisma.shop.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        name: true,
        slug: true
      },
      orderBy: { name: 'asc' }
    }),
    prisma.userShop.findMany({
      where: {
        userId,
        isActive: true
      },
      select: {
        role: true,
        customPermissions: true,
        shop: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      },
      orderBy: { assignedAt: 'asc' }
    })
  ]);

  const managedMembershipShops = memberships
    .filter((membership) => membershipHasPermission(membership.role, membership.customPermissions, 'MANAGE_STAFF'))
    .map((membership) => membership.shop);

  const deduped = new Map<string, { id: string; name: string; slug: string }>();

  for (const shop of [...ownedShops, ...managedMembershipShops]) {
    deduped.set(shop.id, shop);
  }

  return [...deduped.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export async function assertManagedShopAccess(userId: string, shopId: string) {
  const [ownedShop, membership] = await Promise.all([
    prisma.shop.findFirst({
      where: {
        id: shopId,
        ownerId: userId
      },
      select: { id: true }
    }),
    prisma.userShop.findFirst({
      where: {
        userId,
        shopId,
        isActive: true
      },
      select: {
        role: true,
        customPermissions: true
      }
    })
  ]);

  if (ownedShop) {
    return true;
  }

  return Boolean(
    membership && membershipHasPermission(membership.role, membership.customPermissions, 'MANAGE_STAFF')
  );
}

export function formatRoleLabel(role: ShopRole) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

export async function syncUserDefaultShopId(
  tx: Prisma.TransactionClient,
  userId: string,
  preferredShopId?: string | null
) {
  const [user, activeMemberships] = await Promise.all([
    tx.user.findUnique({
      where: { id: userId },
      select: { defaultShopId: true }
    }),
    tx.userShop.findMany({
      where: {
        userId,
        isActive: true
      },
      select: { shopId: true },
      orderBy: { assignedAt: 'asc' }
    })
  ]);

  const activeShopIds = new Set(activeMemberships.map((membership) => membership.shopId));
  const nextDefaultShopId =
    preferredShopId && activeShopIds.has(preferredShopId)
      ? preferredShopId
      : user?.defaultShopId && activeShopIds.has(user.defaultShopId)
        ? user.defaultShopId
        : activeMemberships[0]?.shopId ?? null;

  await tx.user.update({
    where: { id: userId },
    data: { defaultShopId: nextDefaultShopId }
  });

  return nextDefaultShopId;
}

export async function countActiveAdmins(
  tx: Prisma.TransactionClient,
  shopId: string,
  excludeMembershipId?: string
) {
  return tx.userShop.count({
    where: {
      shopId,
      role: 'ADMIN',
      isActive: true,
      ...(excludeMembershipId ? { id: { not: excludeMembershipId } } : {})
    }
  });
}
