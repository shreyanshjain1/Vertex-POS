import { DocumentSequenceType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { purchaseSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { getNextDocumentNumber } from '@/lib/document-sequence';
import { collapsePurchaseItems, normalizeText, roundCurrency } from '@/lib/inventory';
import {
  getPurchaseDetailOrThrow,
  purchaseDetailInclude,
  PurchaseOperationError,
  receivePurchaseOrder
} from '@/lib/purchase-operations';
import { prisma } from '@/lib/prisma';
import { serializePurchase } from '@/lib/purchases';
import { ensureUnitsOfMeasure } from '@/lib/uom';

export async function GET() {
  try {
    const { shopId } = await requireRole('MANAGER');
    await ensureUnitsOfMeasure(shopId);

    const purchases = await prisma.purchaseOrder.findMany({
      where: { shopId },
      include: purchaseDetailInclude,
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      purchases: purchases.map(serializePurchase)
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
    const createStatus = parsed.data.status === 'DRAFT' ? 'DRAFT' : 'SENT';

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
          status: createStatus,
          totalAmount,
          notes: normalizeText(parsed.data.notes),
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
                  : productMap
                      .get(item.productId)!
                      .uomConversions.find((conversion) => conversion.unitOfMeasureId === item.unitOfMeasureId)!.ratioToBase,
              receivedBaseQty: 0,
              unitCost: item.unitCost,
              lineTotal: roundCurrency(item.qty * item.unitCost)
            }))
          }
        },
        include: {
          items: true
        }
      });

      await logActivity({
        tx,
        shopId,
        userId,
        action: createStatus === 'DRAFT' ? 'PURCHASE_DRAFTED' : 'PURCHASE_CREATED',
        entityType: 'PurchaseOrder',
        entityId: purchaseRecord.id,
        description:
          createStatus === 'DRAFT'
            ? `Created draft purchase ${purchaseRecord.purchaseNumber}.`
            : `Created purchase ${purchaseRecord.purchaseNumber} and marked it as sent.`,
        metadata: {
          totalAmount,
          lineCount: items.length,
          supplierName: supplier.name
        }
      });

      if (parsed.data.status === 'FULLY_RECEIVED') {
        const purchaseDetail = await getPurchaseDetailOrThrow(tx, purchaseRecord.id, shopId);
        await receivePurchaseOrder({
          tx,
          purchase: purchaseDetail,
          shopId,
          userId,
          receivedAt: new Date(),
          notes: parsed.data.notes,
          items: purchaseDetail.items.map((item) => ({
            purchaseItemId: item.id,
            qtyReceived: item.qty
          }))
        });
      }

      return getPurchaseDetailOrThrow(tx, purchaseRecord.id, shopId);
    });

    return NextResponse.json(
      {
        purchase: serializePurchase(purchase)
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof PurchaseOperationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return apiErrorResponse(error, 'Unable to create purchase.');
  }
}
