import { NextResponse } from 'next/server';
import { PurchaseStatus } from '@prisma/client';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { normalizeText } from '@/lib/inventory';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      status?: PurchaseStatus;
      notes?: string | null;
    };

    const purchase = await prisma.purchaseOrder.findFirst({
      where: { id, shopId },
      include: { items: true }
    });

    if (!purchase) {
      return NextResponse.json({ error: 'Purchase not found.' }, { status: 404 });
    }

    const nextStatus = body.status ?? purchase.status;

    if (nextStatus === purchase.status && body.notes === undefined) {
      return NextResponse.json({ error: 'No purchase changes were provided.' }, { status: 400 });
    }

    if (purchase.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Cancelled purchases cannot be updated.' },
        { status: 400 }
      );
    }

    if (purchase.status === 'RECEIVED' && nextStatus !== 'RECEIVED') {
      return NextResponse.json(
        { error: 'Received purchases cannot be moved back to another status.' },
        { status: 400 }
      );
    }

    const updatedPurchase = await prisma.$transaction(async (tx) => {
      if (purchase.status === 'DRAFT' && nextStatus === 'RECEIVED') {
        for (const item of purchase.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQty: {
                increment: item.qty
              },
              cost: item.unitCost
            }
          });

          await tx.inventoryMovement.create({
            data: {
              shopId,
              productId: item.productId,
              type: 'PURCHASE_RECEIVED',
              qtyChange: item.qty,
              referenceId: purchase.id,
              userId,
              notes: `Purchase ${purchase.purchaseNumber}`
            }
          });
        }
      }

      const record = await tx.purchaseOrder.update({
        where: { id: purchase.id },
        data: {
          status: nextStatus,
          notes: body.notes === undefined ? purchase.notes : normalizeText(body.notes),
          receivedAt:
            purchase.status === 'DRAFT' && nextStatus === 'RECEIVED'
              ? new Date()
              : nextStatus === 'RECEIVED'
                ? purchase.receivedAt
                : null
        },
        include: { supplier: true, items: true }
      });

      await logActivity({
        tx,
        shopId,
        userId,
        action:
          nextStatus === 'RECEIVED'
            ? 'PURCHASE_RECEIVED'
            : nextStatus === 'CANCELLED'
              ? 'PURCHASE_CANCELLED'
              : 'PURCHASE_UPDATED',
        entityType: 'PurchaseOrder',
        entityId: purchase.id,
        description:
          nextStatus === 'RECEIVED'
            ? `Received purchase ${purchase.purchaseNumber}.`
            : nextStatus === 'CANCELLED'
              ? `Cancelled purchase ${purchase.purchaseNumber}.`
              : `Updated purchase ${purchase.purchaseNumber}.`
      });

      return record;
    });

    return NextResponse.json({
      purchase: {
        ...updatedPurchase,
        totalAmount: updatedPurchase.totalAmount.toString(),
        createdAt: updatedPurchase.createdAt.toISOString(),
        updatedAt: updatedPurchase.updatedAt.toISOString(),
        receivedAt: updatedPurchase.receivedAt?.toISOString() ?? null,
        items: updatedPurchase.items.map((item) => ({
          ...item,
          unitCost: item.unitCost.toString(),
          lineTotal: item.lineTotal.toString()
        }))
      }
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to update purchase.');
  }
}
