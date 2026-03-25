import { DocumentSequenceType, PurchaseStatus } from '@prisma/client';
import { NextResponse } from 'next/server';
import { purchaseSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { getNextDocumentNumber } from '@/lib/document-sequence';
import { collapsePurchaseItems, normalizeText, roundCurrency } from '@/lib/inventory';
import { prisma } from '@/lib/prisma';

function serializePurchase<
  T extends {
    totalAmount: { toString(): string };
    createdAt: Date;
    updatedAt: Date;
    receivedAt: Date | null;
  }
>(purchase: T) {
  return {
    ...purchase,
    totalAmount: purchase.totalAmount.toString(),
    createdAt: purchase.createdAt.toISOString(),
    updatedAt: purchase.updatedAt.toISOString(),
    receivedAt: purchase.receivedAt?.toISOString() ?? null
  };
}

export async function GET() {
  try {
    const { shopId } = await requireRole('MANAGER');
    const purchases = await prisma.purchaseOrder.findMany({
      where: { shopId },
      include: { supplier: true, items: true },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      purchases: purchases.map((purchase) => ({
        ...serializePurchase(purchase),
        items: purchase.items.map((item) => ({
          ...item,
          unitCost: item.unitCost.toString(),
          lineTotal: item.lineTotal.toString()
        }))
      }))
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load purchases.');
  }
}

export async function POST(request: Request) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const body = await request.json();
    const parsed = purchaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid purchase payload.' },
        { status: 400 }
      );
    }

    const items = collapsePurchaseItems(parsed.data.items);
    const [settings, supplier, products] = await Promise.all([
      prisma.shopSetting.findUnique({ where: { shopId } }),
      prisma.supplier.findFirst({
        where: {
          id: parsed.data.supplierId,
          shopId,
          isActive: true
        }
      }),
      prisma.product.findMany({
        where: {
          shopId,
          id: { in: items.map((item) => item.productId) }
        }
      })
    ]);

    if (!supplier) {
      return NextResponse.json(
        { error: 'Selected supplier was not found or is archived.' },
        { status: 404 }
      );
    }

    const productMap = new Map(products.map((product) => [product.id, product]));

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return NextResponse.json(
          { error: 'One or more selected products were not found.' },
          { status: 404 }
        );
      }
    }

    const totalAmount = roundCurrency(
      items.reduce((sum, item) => sum + item.qty * item.unitCost, 0)
    );

    const purchase = await prisma.$transaction(async (tx) => {
      const purchaseNumber = await getNextDocumentNumber(tx, {
        shopId,
        type: DocumentSequenceType.PURCHASE,
        prefix: settings?.purchasePrefix ?? 'PO'
      });

      const purchaseRecord = await tx.purchaseOrder.create({
        data: {
          shopId,
          supplierId: supplier.id,
          purchaseNumber,
          status: parsed.data.status as PurchaseStatus,
          totalAmount,
          notes: normalizeText(parsed.data.notes),
          receivedAt: parsed.data.status === 'RECEIVED' ? new Date() : null,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              productName: productMap.get(item.productId)!.name,
              qty: item.qty,
              unitCost: item.unitCost,
              lineTotal: roundCurrency(item.qty * item.unitCost)
            }))
          }
        },
        include: { supplier: true, items: true }
      });

      if (purchaseRecord.status === 'RECEIVED') {
        for (const item of items) {
          const product = productMap.get(item.productId)!;
          await tx.product.update({
            where: { id: product.id },
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
              productId: product.id,
              type: 'PURCHASE_RECEIVED',
              qtyChange: item.qty,
              referenceId: purchaseRecord.id,
              userId,
              notes: `Purchase ${purchaseRecord.purchaseNumber}`
            }
          });
        }
      }

      await logActivity({
        tx,
        shopId,
        userId,
        action: purchaseRecord.status === 'RECEIVED' ? 'PURCHASE_RECEIVED' : 'PURCHASE_DRAFTED',
        entityType: 'PurchaseOrder',
        entityId: purchaseRecord.id,
        description:
          purchaseRecord.status === 'RECEIVED'
            ? `Received purchase ${purchaseRecord.purchaseNumber}.`
            : `Created draft purchase ${purchaseRecord.purchaseNumber}.`,
        metadata: {
          totalAmount,
          lineCount: items.length,
          supplierName: supplier.name
        }
      });

      return purchaseRecord;
    });

    return NextResponse.json(
      {
        purchase: {
          ...serializePurchase(purchase),
          items: purchase.items.map((item) => ({
            ...item,
            unitCost: item.unitCost.toString(),
            lineTotal: item.lineTotal.toString()
          }))
        }
      },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error, 'Unable to create purchase.');
  }
}
