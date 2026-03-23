import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const memberships = await prisma.userShop.findMany({ where: { userId: session.user.id }, include: { shop: true }, orderBy: { createdAt: 'asc' } });
  return NextResponse.json({ shops: memberships.map((membership) => ({ id: membership.shop.id, name: membership.shop.name, slug: membership.shop.slug, role: membership.role, posType: membership.shop.posType })) });
}
