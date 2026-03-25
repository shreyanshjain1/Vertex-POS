import { NextResponse } from 'next/server';
import { inventoryAdjustmentSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const body = await request.json();
    const parsed = inventoryAdjustmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid adjustment.' },
        { status: 400 }
      );
    }

    const product = await prisma.product.findFirst({
      where: { id: parsed.data.productId, shopId }
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    if (!product.isActive) {
      return NextResponse.json(
        { error: 'Archived products cannot be adjusted until they are restored.' },
        { status: 400 }
      );
    }

    const nextStock = product.stockQty + parsed.data.qtyChange;
    if (nextStock < 0) {
      return NextResponse.json(
        { error: 'Adjustment would create negative stock.' },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: {
          stockQty: nextStock
        }
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          shopId,
          productId: product.id,
          type: 'MANUAL_ADJUSTMENT',
          qtyChange: parsed.data.qtyChange,
          userId,
          notes: parsed.data.notes || null
        }
      });

      await logActivity({
        tx,
        shopId,
        userId,
        action: 'STOCK_ADJUSTED',
        entityType: 'Product',
        entityId: product.id,
        description: `Adjusted stock for ${product.name} by ${parsed.data.qtyChange}.`,
        metadata: {
          previousStock: product.stockQty,
          nextStock,
          qtyChange: parsed.data.qtyChange,
          notes: parsed.data.notes || null
        }
      });

      return { product: updatedProduct, movement };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to adjust inventory.');
  }
}
