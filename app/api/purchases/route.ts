import { DocumentSequenceType, PurchaseStatus } from '@prisma/client';
import { NextResponse } from 'next/server';
import { purchaseSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { getNextDocumentNumber } from '@/lib/document-sequence';
import { collapsePurchaseItems, normalizeText, roundCurrency } from '@/lib/inventory';
import { prisma } from '@/lib/prisma';
import { ensureUnitsOfMeasure } from '@/lib/uom';

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
    await ensureUnitsOfMeasure(shopId);
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
    await ensureUnitsOfMeasure(shopId);
    const body = await request.json();
    const parsed = purchaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid purchase payload.' },
        { status: 400 }
      );
    }

    const items = collapsePurchaseItems(parsed.data.items);
    const [settings, supplier, products, units] = await Promise.all([
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
        },
        include: {
          baseUnitOfMeasure: true,
          uomConversions: {
            include: {
              unitOfMeasure: true
            }
          }
        }
      }),
      prisma.unitOfMeasure.findMany({
        where: {
          shopId,
          id: { in: items.map((item) => item.unitOfMeasureId) },
          isActive: true
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
    const unitMap = new Map(units.map((unit) => [unit.id, unit]));

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return NextResponse.json(
          { error: 'One or more selected products were not found.' },
          { status: 404 }
        );
      }

      const unit = unitMap.get(item.unitOfMeasureId);
      if (!unit) {
        return NextResponse.json(
          { error: 'One or more selected purchase units were not found.' },
          { status: 404 }
        );
      }

      const ratioToBase =
        product.baseUnitOfMeasureId === item.unitOfMeasureId
          ? 1
          : product.uomConversions.find((conversion) => conversion.unitOfMeasureId === item.unitOfMeasureId)?.ratioToBase;

      if (!ratioToBase || ratioToBase <= 0) {
        return NextResponse.json(
          { error: `No valid conversion exists for ${product.name} and the selected unit.` },
          { status: 400 }
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
              unitOfMeasureId: item.unitOfMeasureId,
              unitCode: unitMap.get(item.unitOfMeasureId)!.code,
              unitName: unitMap.get(item.unitOfMeasureId)!.name,
              productName: productMap.get(item.productId)!.name,
              qty: item.qty,
              ratioToBase:
                productMap.get(item.productId)!.baseUnitOfMeasureId === item.unitOfMeasureId
                  ? 1
                  : productMap.get(item.productId)!.uomConversions.find((conversion) => conversion.unitOfMeasureId === item.unitOfMeasureId)!.ratioToBase,
              receivedBaseQty:
                item.qty *
                (productMap.get(item.productId)!.baseUnitOfMeasureId === item.unitOfMeasureId
                  ? 1
                  : productMap.get(item.productId)!.uomConversions.find((conversion) => conversion.unitOfMeasureId === item.unitOfMeasureId)!.ratioToBase),
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
          const ratioToBase =
            product.baseUnitOfMeasureId === item.unitOfMeasureId
              ? 1
              : product.uomConversions.find((conversion) => conversion.unitOfMeasureId === item.unitOfMeasureId)!.ratioToBase;
          const nextBaseCost = roundCurrency(item.unitCost / ratioToBase);

          if (Number(product.cost) !== nextBaseCost) {
            await tx.productCostHistory.create({
              data: {
                productId: product.id,
                previousCost: product.cost,
                newCost: nextBaseCost,
                effectiveDate: new Date(),
                changedByUserId: userId,
                note: `Purchase ${purchaseRecord.purchaseNumber}`
              }
            });
          }

          await tx.product.update({
            where: { id: product.id },
            data: {
              stockQty: {
                increment: item.qty * ratioToBase
              },
              cost: nextBaseCost
            }
          });

          await tx.inventoryMovement.create({
            data: {
              shopId,
              productId: product.id,
              type: 'PURCHASE_RECEIVED',
              qtyChange: item.qty * ratioToBase,
              referenceId: purchaseRecord.id,
              userId,
              notes: `Purchase ${purchaseRecord.purchaseNumber} (${item.qty} ${unitMap.get(item.unitOfMeasureId)!.name.toLowerCase()}${item.qty === 1 ? '' : 's'})`
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
          supplierName: supplier.name,
          receivedBaseQty: purchaseRecord.items.reduce((sum, item) => sum + item.receivedBaseQty, 0)
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
