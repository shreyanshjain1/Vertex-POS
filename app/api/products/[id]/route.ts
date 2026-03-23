import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { productUpdateSchema } from '@/lib/auth/validation';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const { id } = await params;
    const body = await request.json();
    const parsed = productUpdateSchema.safeParse({ ...body, id });
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid update.' }, { status: 400 });
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing || existing.shopId != shopId) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    const product = await prisma.product.update({ where: { id }, data: { ...body }, include: { category: { select: { name: true } } } });
    await prisma.activityLog.create({ data: { shopId, userId, action: 'PRODUCT_UPDATED', entityType: 'Product', entityId: product.id, description: `Updated product ${product.name}` } });
    return NextResponse.json({ product });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to update product.' }, { status: 500 });
  }
}
