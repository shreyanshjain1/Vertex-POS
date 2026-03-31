import { DocumentSequenceType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { stockTransferSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { getNextDocumentNumber } from '@/lib/document-sequence';
import { normalizeText } from '@/lib/inventory';
import { prisma } from '@/lib/prisma';
import { stockTransferDetailInclude } from '@/lib/stock-transfer-operations';
import { serializeStockTransfer } from '@/lib/stock-transfers';

export async function POST(request: Request) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const body = await request.json();
    const parsed = stockTransferSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid stock transfer payload.' },
        { status: 400 }
      );
    }

    if (parsed.data.toShopId === shopId) {
      return NextResponse.json(
        { error: 'Destination branch must be different from the source branch.' },
        { status: 400 }
      );
    }

    const memberships = await prisma.userShop.findMany({
      where: {
        userId,
        isActive: true,
        shopId: {
          in: [shopId, parsed.data.toShopId]
        }
      },
      select: {
        shopId: true
      }
    });
    const membershipIds = new Set(memberships.map((membership) => membership.shopId));

    if (!membershipIds.has(parsed.data.toShopId)) {
      return NextResponse.json(
        { error: 'You can only transfer to branches you are assigned to.' },
        { status: 403 }
      );
    }

    const [destinationShop, sourceProducts, destinationProducts] = await Promise.all([
      prisma.shop.findUnique({
        where: { id: parsed.data.toShopId },
        select: {
          id: true,
          name: true
        }
      }),
      prisma.product.findMany({
        where: {
          shopId,
          isActive: true,
          id: { in: parsed.data.items.map((item) => item.fromProductId) }
        },
        select: {
          id: true,
          name: true,
          stockQty: true
        }
      }),
      prisma.product.findMany({
        where: {
          shopId: parsed.data.toShopId,
          isActive: true,
          id: { in: parsed.data.items.map((item) => item.toProductId) }
        },
        select: {
          id: true,
          name: true
        }
      })
    ]);

    if (!destinationShop) {
      return NextResponse.json({ error: 'Destination branch not found.' }, { status: 404 });
    }

    const sourceProductMap = new Map(sourceProducts.map((product) => [product.id, product]));
    const destinationProductMap = new Map(destinationProducts.map((product) => [product.id, product]));

    for (const item of parsed.data.items) {
      const sourceProduct = sourceProductMap.get(item.fromProductId);
      if (!sourceProduct) {
        return NextResponse.json({ error: 'One or more source products were not found.' }, { status: 404 });
      }

      const destinationProduct = destinationProductMap.get(item.toProductId);
      if (!destinationProduct) {
        return NextResponse.json({ error: 'One or more destination products were not found.' }, { status: 404 });
      }

      if (item.qty > sourceProduct.stockQty) {
        return NextResponse.json(
          { error: `${sourceProduct.name} only has ${sourceProduct.stockQty} unit(s) available.` },
          { status: 400 }
        );
      }
    }

    const stockTransfer = await prisma.$transaction(async (tx) => {
      const transferNumber = await getNextDocumentNumber(tx, {
        shopId,
        type: DocumentSequenceType.TRANSFER,
        prefix: 'TRF'
      });

      const createdTransfer = await tx.stockTransfer.create({
        data: {
          fromShopId: shopId,
          toShopId: parsed.data.toShopId,
          createdByUserId: userId,
          transferNumber,
          status: 'DRAFT',
          notes: normalizeText(parsed.data.notes),
          items: {
            create: parsed.data.items.map((item) => ({
              fromProductId: item.fromProductId,
              toProductId: item.toProductId,
              productNameSnapshot: sourceProductMap.get(item.fromProductId)!.name,
              destinationProductNameSnapshot: destinationProductMap.get(item.toProductId)!.name,
              qty: item.qty
            }))
          }
        },
        include: stockTransferDetailInclude
      });

      await logActivity({
        tx,
        shopId,
        userId,
        action: 'STOCK_TRANSFER_CREATED',
        entityType: 'StockTransfer',
        entityId: createdTransfer.id,
        description: `Created stock transfer ${createdTransfer.transferNumber} to ${destinationShop.name}.`,
        metadata: {
          destinationShopId: destinationShop.id,
          itemCount: parsed.data.items.length
        }
      });

      return createdTransfer;
    });

    return NextResponse.json(
      {
        stockTransfer: serializeStockTransfer(stockTransfer)
      },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error, 'Unable to create stock transfer.');
  }
}
