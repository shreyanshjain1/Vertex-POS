import { DocumentSequenceType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { saleSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { getNextDocumentNumber } from '@/lib/document-sequence';
import { collapseSaleItems, normalizeText, roundCurrency } from '@/lib/inventory';
import { prisma } from '@/lib/prisma';
import { CASH_PAYMENT_METHOD, getActiveCashSession } from '@/lib/register';

function serializeSale<T extends { createdAt: Date; subtotal: { toString(): string }; taxAmount: { toString(): string }; discountAmount: { toString(): string }; totalAmount: { toString(): string } }>(
  sale: T
) {
  return {
    ...sale,
    subtotal: sale.subtotal.toString(),
    taxAmount: sale.taxAmount.toString(),
    discountAmount: sale.discountAmount.toString(),
    totalAmount: sale.totalAmount.toString(),
    createdAt: sale.createdAt.toISOString()
  };
}

export async function GET() {
  try {
    const { shopId } = await requireRole('CASHIER');
    const sales = await prisma.sale.findMany({
      where: { shopId },
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      sales: sales.map((sale) => ({
        ...serializeSale(sale),
        items: sale.items.map((item) => ({
          ...item,
          unitPrice: item.unitPrice.toString(),
          lineTotal: item.lineTotal.toString()
        }))
      }))
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load sales.');
  }
}

export async function POST(request: Request) {
  try {
    const { shopId, userId, session } = await requireRole('CASHIER');
    const body = await request.json();
    const parsed = saleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid sale payload.' },
        { status: 400 }
      );
    }

    if (parsed.data.paymentMethod.trim() === CASH_PAYMENT_METHOD) {
      const activeCashSession = await getActiveCashSession(prisma, shopId, userId);
      if (!activeCashSession) {
        return NextResponse.json(
          { error: 'Open a register session before accepting cash sales.' },
          { status: 409 }
        );
      }
    }

    const items = collapseSaleItems(parsed.data.items);
    const [settings, products] = await Promise.all([
      prisma.shopSetting.findUnique({ where: { shopId } }),
      prisma.product.findMany({
        where: {
          shopId,
          id: { in: items.map((item) => item.productId) }
        }
      })
    ]);

    const productMap = new Map(products.map((product) => [product.id, product]));

    for (const item of items) {
      const product = productMap.get(item.productId);

      if (!product) {
        return NextResponse.json(
          { error: 'One or more selected products were not found.' },
          { status: 404 }
        );
      }

      if (!product.isActive) {
        return NextResponse.json(
          { error: `${product.name} is archived and cannot be sold.` },
          { status: 400 }
        );
      }

      if (product.stockQty < item.qty) {
        return NextResponse.json(
          { error: `${product.name} has only ${product.stockQty} item(s) available.` },
          { status: 400 }
        );
      }
    }

    const subtotal = roundCurrency(
      items.reduce((sum, item) => sum + Number(productMap.get(item.productId)!.price) * item.qty, 0)
    );
    const taxAmount = roundCurrency(subtotal * (Number(settings?.taxRate ?? 0) / 100));
    const discountAmount = roundCurrency(Number(parsed.data.discountAmount ?? 0));

    if (discountAmount > subtotal + taxAmount) {
      return NextResponse.json(
        { error: 'Discount cannot exceed the sale total.' },
        { status: 400 }
      );
    }

    const totalAmount = roundCurrency(subtotal + taxAmount - discountAmount);

    const sale = await prisma.$transaction(async (tx) => {
      const saleNumber = await getNextDocumentNumber(tx, {
        shopId,
        type: DocumentSequenceType.SALE,
        prefix: settings?.salePrefix ?? 'SAL'
      });
      const receiptNumber = await getNextDocumentNumber(tx, {
        shopId,
        type: DocumentSequenceType.RECEIPT,
        prefix: settings?.receiptPrefix ?? 'RCP'
      });

      const saleRecord = await tx.sale.create({
        data: {
          shopId,
          cashierUserId: userId,
          saleNumber,
          receiptNumber,
          customerName: normalizeText(parsed.data.customerName),
          customerPhone: normalizeText(parsed.data.customerPhone),
          subtotal,
          taxAmount,
          discountAmount,
          totalAmount,
          paymentMethod: parsed.data.paymentMethod.trim(),
          notes: normalizeText(parsed.data.notes),
          cashierName: session.user.name || session.user.email || 'Cashier',
          items: {
            create: items.map((item) => {
              const product = productMap.get(item.productId)!;
              const unitPrice = Number(product.price);
              return {
                productId: item.productId,
                productName: product.name,
                qty: item.qty,
                unitPrice,
                lineTotal: roundCurrency(unitPrice * item.qty)
              };
            })
          }
        },
        include: { items: true }
      });

      for (const item of items) {
        const product = productMap.get(item.productId)!;
        await tx.product.update({
          where: { id: product.id },
          data: {
            stockQty: {
              decrement: item.qty
            }
          }
        });

        await tx.inventoryMovement.create({
          data: {
            shopId,
            productId: product.id,
            type: 'SALE_COMPLETED',
            qtyChange: item.qty * -1,
            referenceId: saleRecord.id,
            userId,
            notes: `Sale ${saleRecord.saleNumber}`
          }
        });
      }

      await logActivity({
        tx,
        shopId,
        userId,
        action: 'SALE_COMPLETED',
        entityType: 'Sale',
        entityId: saleRecord.id,
        description: `Completed sale ${saleRecord.saleNumber}.`,
        metadata: {
          itemCount: items.reduce((sum, item) => sum + item.qty, 0),
          paymentMethod: parsed.data.paymentMethod.trim(),
          totalAmount
        }
      });

      return saleRecord;
    });

    return NextResponse.json(
      {
        sale: {
          ...serializeSale(sale),
          items: sale.items.map((item) => ({
            ...item,
            unitPrice: item.unitPrice.toString(),
            lineTotal: item.lineTotal.toString()
          }))
        }
      },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error, 'Unable to complete sale.');
  }
}
