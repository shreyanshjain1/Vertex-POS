import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { inventoryAdjustmentSchema } from '@/lib/auth/validation';

export async function POST(request: Request) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const body = await request.json();
    const parsed = inventoryAdjustmentSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid adjustment.' }, { status: 400 });
    const product = await prisma.product.findFirst({ where: { id: parsed.data.productId, shopId } });
    if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    if (product.stockQty + parsed.data.qtyChange < 0) return NextResponse.json({ error: 'Adjustment would create negative stock.' }, { status: 400 });
    await prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id: product.id }, data: { stockQty: { increment: parsed.data.qtyChange } } });
      await tx.inventoryMovement.create({ data: { shopId, productId: product.id, type: 'MANUAL_ADJUSTMENT', qtyChange: parsed.data.qtyChange, userId, notes: parsed.data.notes || null } });
      await tx.activityLog.create({ data: { shopId, userId, action: 'STOCK_ADJUSTED', entityType: 'Product', entityId: product.id, description: `Adjusted stock for ${product.name} by ${parsed.data.qtyChange}`, metadata: { qtyChange: parsed.data.qtyChange, notes: parsed.data.notes } } });
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to adjust inventory.' }, { status: 500 });
  }
}
