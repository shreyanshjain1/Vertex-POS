import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const nextShopId = typeof body.shopId === 'string' ? body.shopId.trim() : '';

  if (!nextShopId) {
    return NextResponse.json({ error: 'Select a branch to continue.' }, { status: 400 });
  }

  const membership = await prisma.userShop.findFirst({
    where: {
      userId: session.user.id,
      shopId: nextShopId,
      isActive: true
    },
    select: {
      shopId: true
    }
  });

  if (!membership) {
    return NextResponse.json({ error: 'You do not have access to that branch.' }, { status: 403 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { defaultShopId: nextShopId }
  });

  return NextResponse.json({ ok: true, shopId: nextShopId });
}
