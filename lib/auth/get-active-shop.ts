import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function getActiveShopContext() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  let shopId = session.user.defaultShopId;

  if (!shopId) {
    const membership = await prisma.userShop.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'asc' }
    });

    if (!membership?.shopId) {
      redirect('/onboard');
    }

    shopId = membership.shopId;

    await prisma.user.update({
      where: { id: session.user.id },
      data: { defaultShopId: shopId }
    });
  }

  const membership = await prisma.userShop.findFirst({
    where: { userId: session.user.id, shopId },
    include: { shop: true }
  });

  if (!membership) {
    redirect('/onboard');
  }

  return {
    session,
    shopId,
    shop: membership.shop,
    role: membership.role,
    userId: session.user.id
  };
}
