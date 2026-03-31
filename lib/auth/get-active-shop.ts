import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getEffectivePermissionState } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

type GuardMode = 'redirect' | 'throw';

export class AuthenticationError extends Error {
  constructor(message = 'Authentication required.') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ShopContextError extends Error {
  code: 'SHOP_REQUIRED' | 'SHOP_ACCESS_LOST';

  constructor(code: 'SHOP_REQUIRED' | 'SHOP_ACCESS_LOST', message: string) {
    super(message);
    this.name = 'ShopContextError';
    this.code = code;
  }
}

async function resolveActiveShopContext(mode: GuardMode) {
  const session = await auth();

  if (!session?.user?.id) {
    if (mode === 'redirect') {
      redirect('/login');
    }

    throw new AuthenticationError();
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { defaultShopId: true }
  });
  const preferredShopId = currentUser?.defaultShopId ?? session.user.defaultShopId ?? null;

  const preferredMembership = preferredShopId
    ? await prisma.userShop.findFirst({
        where: {
          userId: session.user.id,
          shopId: preferredShopId,
          isActive: true
        },
        include: { shop: true }
      })
    : null;

  const membership =
    preferredMembership ??
    (await prisma.userShop.findFirst({
      where: {
        userId: session.user.id,
        isActive: true
      },
      include: { shop: true },
      orderBy: { assignedAt: 'asc' }
    }));

  if (!membership) {
    const anyMembership = await prisma.userShop.findFirst({
      where: { userId: session.user.id },
      select: { id: true }
    });

    if (mode === 'redirect') {
      redirect(anyMembership ? '/login?error=shop-access-lost' : '/onboard');
    }

    throw new ShopContextError(
      anyMembership ? 'SHOP_ACCESS_LOST' : 'SHOP_REQUIRED',
      anyMembership
        ? 'Your shop access is inactive. Contact an administrator.'
        : 'No active shop found for this user.'
    );
  }

  if (preferredShopId !== membership.shopId) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { defaultShopId: membership.shopId }
    });
  }

  return {
    session,
    membershipId: membership.id,
    shopId: membership.shopId,
    shop: membership.shop,
    role: membership.role,
    customPermissions: membership.customPermissions,
    permissions: getEffectivePermissionState(membership.role, membership.customPermissions),
    userId: session.user.id
  };
}

export async function getActiveShopContext() {
  return resolveActiveShopContext('redirect');
}

export async function getActiveShopContextOrThrow() {
  return resolveActiveShopContext('throw');
}
