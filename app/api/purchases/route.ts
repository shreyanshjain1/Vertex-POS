import { NextResponse } from 'next/server';
import { PurchaseStatus } from '@prisma/client';
import { requireRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { purchaseSchema } from '@/lib/auth/validation';

function nextPurchaseNumber(prefix: string) {
  const now = new Date();
  return `${prefix}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

export async function GET() {
  const { shopId } = await requireRole('CASHIER');
  const purchases = await prisma.purchaseOrder.findMany({ where: { shopId }, include: { supplier: true, items: true }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ purchases });
}

export async function POST(request: Request) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const body = await request.json();
    const parsed = purchaseSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid purchase payload.' }, { status: 400 });

    const [settings, products] = await Promise.all([
      prisma.shopSetting.findUnique({ where: { shopId } }),
      prisma.product.findMany({ where: { shopId, id: { in: parsed.data.items.map((item) => item.productId) } } })
    ]);
    const map = new Map(products.map((product) => [product.id, product]));
    const totalAmount = parsed.data.items.reduce((sum, item) => sum + item.qty * item.unitCost, 0);

    const purchase = await prisma.$transaction(async (tx) => {
      const purchaseRecord = await tx.purchaseOrder.create({
        data: {
          shopId,
          supplierId: parsed.data.supplierId,
          purchaseNumber: nextPurchaseNumber(settings?.purchasePrefix ?? 'PO'),
          status: parsed.data.status as PurchaseStatus,
          totalAmount,
          notes: parsed.data.notes || null,
          receivedAt: parsed.data.status === 'RECEIVED' ? new Date() : null,
          items: { create: parsed.data.items.map((item) => ({ productId: item.productId, productName: map.get(item.productId)?.name ?? 'Unknown product', qty: item.qty, unitCost: item.unitCost, lineTotal: item.qty * item.unitCost })) }
        },
        include: { supplier: true, items: true }
      });

      if (purchaseRecord.status === 'RECEIVED') {
        for (const item of parsed.data.items) {
          const product = map.get(item.productId);
          if (!product) continue;
          await tx.product.update({ where: { id: product.id }, data: { stockQty: { increment: item.qty }, cost: item.unitCost } });
          await tx.inventoryMovement.create({ data: { shopId, productId: product.id, type: 'PURCHASE_RECEIVED', qtyChange: item.qty, referenceId: purchaseRecord.id, notes: `Purchase ${purchaseRecord.purchaseNumber}` } });
        }
      }

      await tx.activityLog.create({ data: { shopId, userId, action: purchaseRecord.status === 'RECEIVED' ? 'PURCHASE_RECEIVED' : 'PURCHASE_DRAFTED', entityType: 'PurchaseOrder', entityId: purchaseRecord.id, description: `${purchaseRecord.status === 'RECEIVED' ? 'Received' : 'Created'} purchase ${purchaseRecord.purchaseNumber}` } });
      return purchaseRecord;
    });

    return NextResponse.json({ purchase: { ...purchase, totalAmount: purchase.totalAmount.toString(), createdAt: purchase.createdAt.toISOString() } }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to create purchase.' }, { status: 500 });
  }
}
