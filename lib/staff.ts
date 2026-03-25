import { Prisma, ShopRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const STAFF_LOGIN_ACTION = 'LOGIN_SUCCESS';

export async function getManagedShops(userId: string) {
  return prisma.shop.findMany({
    where: {
      OR: [
        { ownerId: userId },
        {
          memberships: {
            some: {
              userId,
              role: 'ADMIN',
              isActive: true
            }
          }
        }
      ]
    },
    select: {
      id: true,
      name: true,
      slug: true
    },
    orderBy: { name: 'asc' }
  });
}

export async function assertManagedShopAccess(userId: string, shopId: string) {
  const shop = await prisma.shop.findFirst({
    where: {
      id: shopId,
      OR: [
        { ownerId: userId },
        {
          memberships: {
            some: {
              userId,
              role: 'ADMIN',
              isActive: true
            }
          }
        }
      ]
    },
    select: { id: true }
  });

  return Boolean(shop);
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
