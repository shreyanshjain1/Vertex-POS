import { redirect } from 'next/navigation';
import { auth } from '@/auth';
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

  const preferredMembership = session.user.defaultShopId
    ? await prisma.userShop.findFirst({
        where: {
          userId: session.user.id,
          shopId: session.user.defaultShopId
        },
        include: { shop: true }
      })
    : null;

  const membership =
    preferredMembership ??
    (await prisma.userShop.findFirst({
      where: { userId: session.user.id },
      include: { shop: true },
      orderBy: { createdAt: 'asc' }
    }));

  if (!membership) {
    if (mode === 'redirect') {
      redirect('/onboard');
    }

    throw new ShopContextError('SHOP_REQUIRED', 'No active shop found for this user.');
  }

  if (session.user.defaultShopId !== membership.shopId) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { defaultShopId: membership.shopId }
    });
  }

  return {
    session,
    shopId: membership.shopId,
    shop: membership.shop,
    role: membership.role,
    userId: session.user.id
  };
}

export async function getActiveShopContext() {
  return resolveActiveShopContext('redirect');
}

export async function getActiveShopContextOrThrow() {
  return resolveActiveShopContext('throw');
}
