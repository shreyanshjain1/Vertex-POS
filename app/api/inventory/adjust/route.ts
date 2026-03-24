import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    let shopId = session.user.defaultShopId;

    if (!shopId) {
      const membership = await prisma.userShop.findFirst({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'asc' },
        select: { shopId: true }
      });

      if (!membership?.shopId) {
        return NextResponse.json({ error: 'No active shop found.' }, { status: 400 });
      }

      shopId = membership.shopId;
    }

    const body = await request.json();
    const productId = typeof body.productId === 'string' ? body.productId : '';
    const adjustmentType = body.type === 'REMOVE' ? 'REMOVE' : 'ADD';
    const qty = Number(body.qty);
    const notes = typeof body.notes === 'string' ? body.notes : null;

    if (!productId) {
      return NextResponse.json({ error: 'Product is required.' }, { status: 400 });
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ error: 'Quantity must be greater than 0.' }, { status: 400 });
    }

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        shopId
      }
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    if (adjustmentType === 'REMOVE' && qty > product.stockQty) {
      return NextResponse.json({ error: 'Cannot remove more stock than available.' }, { status: 400 });
    }

    const qtyChange = adjustmentType === 'REMOVE' ? -qty : qty;

    const result = await prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: {
          stockQty: {
            increment: qtyChange
          }
        }
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          shopId,
          productId: product.id,
          type: 'MANUAL_ADJUSTMENT',
          qtyChange,
          notes,
          referenceId: null
        }
      });

      await tx.activityLog.create({
        data: {
          shopId,
          userId: session.user.id,
          action: 'inventory.adjusted',
          entityType: 'product',
          entityId: product.id,
          description: `${adjustmentType === 'REMOVE' ? 'Removed' : 'Added'} ${qty} stock for ${product.name}`,
          metadata: {
            productId: product.id,
            productName: product.name,
            qty,
            qtyChange,
            adjustmentType,
            notes
          }
        }
      });

      return { updatedProduct, movement };
    });

    return NextResponse.json({
      ok: true,
      product: result.updatedProduct,
      movement: result.movement
    });
  } catch (error) {
    console.error('inventory adjustment error', error);
    return NextResponse.json({ error: 'Failed to save inventory adjustment.' }, { status: 500 });
  }
}
