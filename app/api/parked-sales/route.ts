import { NextResponse } from 'next/server';
import { parkedSaleCreateSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import {
  calculateParkedSaleTotals,
  cleanupExpiredParkedSales,
  createQuoteReference,
  getParkedSaleExpiresAt,
  getParkedSaleTypeLabel,
  serializeParkedSale
} from '@/lib/parked-sales';
import { getCustomerDisplayName } from '@/lib/customers';
import { collapseSaleItems, normalizeText } from '@/lib/inventory';
import { buildVariantLabel } from '@/lib/product-merchandising';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { shopId, userId, session } = await requireRole('CASHIER');
    const body = await request.json();
    const parsed = parkedSaleCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid saved checkout payload.' },
        { status: 400 }
      );
    }

    const items = collapseSaleItems(parsed.data.items);

    await cleanupExpiredParkedSales(prisma, shopId);

    const [settings, products, customer] = await Promise.all([
      prisma.shopSetting.findUnique({
        where: { shopId },
        select: { taxRate: true }
      }),
      prisma.product.findMany({
        where: {
          shopId,
          id: { in: items.map((item) => item.productId) }
        },
        include: {
          variants: true
        }
      }),
      parsed.data.customerId
        ? prisma.customer.findFirst({
            where: {
              id: parsed.data.customerId,
              shopId,
              isActive: true
            }
          })
        : Promise.resolve(null)
    ]);

    if (parsed.data.customerId && !customer) {
      return NextResponse.json(
        { error: 'Selected customer was not found or is archived.' },
        { status: 404 }
      );
    }

    const productMap = new Map(products.map((product) => [product.id, product]));

    const heldItems = items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error('PRODUCT_NOT_FOUND');
      }

      const variant = item.variantId ? product.variants.find((entry) => entry.id === item.variantId) ?? null : null;
      if (item.variantId && (!variant || !variant.isActive)) {
        throw new Error('VARIANT_NOT_FOUND');
      }

      const unitPrice = Number(variant?.priceOverride ?? product.price);
      return {
        productId: item.productId,
        productVariantId: variant?.id ?? null,
        productName: product.name,
        variantLabel: variant ? buildVariantLabel(variant) || null : null,
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
          customerId: customer?.id ?? null,
          customerName: normalizeText(parsed.data.customerName) ?? (customer ? getCustomerDisplayName(customer) : null),
          customerPhone: normalizeText(parsed.data.customerPhone) ?? normalizeText(customer?.phone),
          title: normalizeText(parsed.data.title),
          quoteReference: parsed.data.type === 'QUOTE' ? createQuoteReference() : null,
          type: parsed.data.type,
          notes: normalizeText(parsed.data.notes),
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          discountAmount: totals.discountAmount,
          totalAmount: totals.totalAmount,
          expiresAt: getParkedSaleExpiresAt(parsed.data.type),
          items: {
            create: heldItems.map((item) => ({
              productId: item.productId,
              productVariantId: item.productVariantId,
              productName: item.productName,
              variantLabel: item.variantLabel,
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
        description: `Saved ${getParkedSaleTypeLabel(createdParkedSale.type).toLowerCase()} for ${session.user.name ?? session.user.email ?? 'cashier'}.`,
        metadata: {
          itemCount: createdParkedSale.items.reduce((sum, item) => sum + item.qty, 0),
          totalAmount: totals.totalAmount,
          type: createdParkedSale.type,
          quoteReference: createdParkedSale.quoteReference
        }
      });

      return createdParkedSale;
    });

    return NextResponse.json(
      { parkedSale: serializeParkedSale(parkedSale) },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'PRODUCT_NOT_FOUND') {
      return NextResponse.json(
        { error: 'One or more selected products were not found.' },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message === 'VARIANT_NOT_FOUND') {
      return NextResponse.json(
        { error: 'One or more selected variants were not found.' },
        { status: 404 }
      );
    }

    return apiErrorResponse(error, 'Unable to save the checkout draft.');
  }
}
