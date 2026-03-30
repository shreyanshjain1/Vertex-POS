import { NextResponse } from 'next/server';
import { PurchaseStatus } from '@prisma/client';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { normalizeText, roundCurrency } from '@/lib/inventory';
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
      include: {
        items: true
      }
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
        const products = await tx.product.findMany({
          where: {
            id: { in: purchase.items.map((item) => item.productId) }
          },
          select: {
            id: true,
            cost: true
          }
        });
        const productMap = new Map(products.map((product) => [product.id, product]));

        for (const item of purchase.items) {
          const nextBaseCost = item.ratioToBase > 0
            ? roundCurrency(Number(item.unitCost.toString()) / item.ratioToBase)
            : Number(item.unitCost.toString());

          const product = productMap.get(item.productId);
          if (product && Number(product.cost) !== nextBaseCost) {
            await tx.productCostHistory.create({
              data: {
                productId: item.productId,
                previousCost: product.cost,
                newCost: nextBaseCost,
                effectiveDate: new Date(),
                changedByUserId: userId,
                note: `Purchase ${purchase.purchaseNumber}`
              }
            });
          }

          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQty: {
                increment: item.receivedBaseQty
              },
              cost: nextBaseCost
            }
          });

          await tx.inventoryMovement.create({
            data: {
              shopId,
              productId: item.productId,
              type: 'PURCHASE_RECEIVED',
              qtyChange: item.receivedBaseQty,
              referenceId: purchase.id,
              userId,
              notes: `Purchase ${purchase.purchaseNumber} (${item.qty} ${item.unitName.toLowerCase()}${item.qty === 1 ? '' : 's'})`
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
