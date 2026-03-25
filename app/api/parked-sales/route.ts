import { NextResponse } from 'next/server';
import { parkedSaleCreateSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import {
  calculateParkedSaleTotals,
  cleanupExpiredParkedSales,
  getParkedSaleExpiresAt,
  serializeParkedSale
} from '@/lib/parked-sales';
import { collapseSaleItems, normalizeText } from '@/lib/inventory';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { shopId, userId, session } = await requireRole('CASHIER');
    const body = await request.json();
    const parsed = parkedSaleCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid held cart payload.' },
        { status: 400 }
      );
    }

    const items = collapseSaleItems(parsed.data.items);

    await cleanupExpiredParkedSales(prisma, shopId);

    const [settings, products] = await Promise.all([
      prisma.shopSetting.findUnique({
        where: { shopId },
        select: { taxRate: true }
      }),
      prisma.product.findMany({
        where: {
          shopId,
          id: { in: items.map((item) => item.productId) }
        },
        select: {
          id: true,
          name: true,
          price: true
        }
      })
    ]);

    const productMap = new Map(products.map((product) => [product.id, product]));

    for (const item of items) {
      if (!productMap.has(item.productId)) {
        return NextResponse.json(
          { error: 'One or more selected products were not found.' },
          { status: 404 }
        );
      }
    }

    const heldItems = items.map((item) => {
      const product = productMap.get(item.productId)!;
      const unitPrice = Number(product.price);
      return {
        productId: item.productId,
        productName: product.name,
        qty: item.qty,
        unitPrice,
        lineTotal: unitPrice * item.qty
      };
    });

    const totals = calculateParkedSaleTotals({
      items: heldItems,
      taxRate: Number(settings?.taxRate ?? 0),
      discountAmount: Number(parsed.data.discountAmount ?? 0)
    });

    const parkedSale = await prisma.$transaction(async (tx) => {
      const createdParkedSale = await tx.parkedSale.create({
        data: {
          shopId,
          cashierUserId: userId,
          customerName: normalizeText(parsed.data.customerName),
          customerPhone: normalizeText(parsed.data.customerPhone),
          notes: normalizeText(parsed.data.notes),
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          discountAmount: totals.discountAmount,
          totalAmount: totals.totalAmount,
          expiresAt: getParkedSaleExpiresAt(),
          items: {
            create: heldItems.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              qty: item.qty,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal
            }))
          }
        },
        include: {
          cashier: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          items: {
            orderBy: { createdAt: 'asc' }
          }
        }
      });

      await logActivity({
        tx,
        shopId,
        userId,
        action: 'CART_HELD',
        entityType: 'ParkedSale',
        entityId: createdParkedSale.id,
        description: `Held cart for ${session.user.name ?? session.user.email ?? 'cashier'}.`,
        metadata: {
          itemCount: createdParkedSale.items.reduce((sum, item) => sum + item.qty, 0),
          totalAmount: totals.totalAmount
        }
      });

      return createdParkedSale;
    });

    return NextResponse.json(
      { parkedSale: serializeParkedSale(parkedSale) },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error, 'Unable to hold the cart.');
  }
}
