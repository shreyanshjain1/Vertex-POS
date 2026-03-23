import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { saleSchema } from '@/lib/auth/validation';

function numberWithPrefix(prefix: string) {
  const now = new Date();
  return `${prefix}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

export async function GET() {
  const { shopId } = await requireRole('CASHIER');
  const sales = await prisma.sale.findMany({ where: { shopId }, include: { items: true }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ sales });
}

export async function POST(request: Request) {
  try {
    const { shopId, userId, session } = await requireRole('CASHIER');
    const body = await request.json();
    const parsed = saleSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid sale payload.' }, { status: 400 });

    const [settings, products] = await Promise.all([
      prisma.shopSetting.findUnique({ where: { shopId } }),
      prisma.product.findMany({ where: { shopId, id: { in: parsed.data.items.map((item) => item.productId) } } })
    ]);
    const productMap = new Map(products.map((product) => [product.id, product]));

    for (const item of parsed.data.items) {
      const product = productMap.get(item.productId);
      if (!product) return NextResponse.json({ error: 'One or more selected products were not found.' }, { status: 404 });
      if (!product.isActive) return NextResponse.json({ error: `${product.name} is inactive and cannot be sold.` }, { status: 400 });
      if (product.stockQty < item.qty) return NextResponse.json({ error: `${product.name} has only ${product.stockQty} item(s) left.` }, { status: 400 });
    }

    const subtotal = parsed.data.items.reduce((sum, item) => sum + Number(productMap.get(item.productId)!.price) * item.qty, 0);
    const taxAmount = subtotal * (Number(settings?.taxRate ?? 0) / 100);
    const discountAmount = Number(parsed.data.discountAmount ?? 0);
    const totalAmount = Math.max(subtotal + taxAmount - discountAmount, 0);

    const sale = await prisma.$transaction(async (tx) => {
      const saleRecord = await tx.sale.create({
        data: {
          shopId,
          cashierUserId: userId,
          saleNumber: numberWithPrefix(settings?.salePrefix ?? 'SAL'),
          receiptNumber: numberWithPrefix(settings?.receiptPrefix ?? 'RCP'),
          customerName: parsed.data.customerName || null,
          customerPhone: parsed.data.customerPhone || null,
          subtotal,
          taxAmount,
          discountAmount,
          totalAmount,
          paymentMethod: parsed.data.paymentMethod,
          notes: parsed.data.notes || null,
          cashierName: session.user.name || session.user.email || 'Cashier',
          items: { create: parsed.data.items.map((item) => ({ productId: item.productId, productName: productMap.get(item.productId)!.name, qty: item.qty, unitPrice: productMap.get(item.productId)!.price, lineTotal: Number(productMap.get(item.productId)!.price) * item.qty })) }
        },
        include: { items: true }
      });

      for (const item of parsed.data.items) {
        const product = productMap.get(item.productId)!;
        await tx.product.update({ where: { id: product.id }, data: { stockQty: { decrement: item.qty } } });
        await tx.inventoryMovement.create({ data: { shopId, productId: product.id, type: 'SALE_COMPLETED', qtyChange: item.qty * -1, referenceId: saleRecord.id, notes: `Sale ${saleRecord.saleNumber}` } });
      }

      await tx.activityLog.create({ data: { shopId, userId, action: 'SALE_COMPLETED', entityType: 'Sale', entityId: saleRecord.id, description: `Completed sale ${saleRecord.saleNumber}`, metadata: { totalAmount, paymentMethod: parsed.data.paymentMethod } } });
      return saleRecord;
    });

    return NextResponse.json({ sale: { ...sale, subtotal: sale.subtotal.toString(), taxAmount: sale.taxAmount.toString(), discountAmount: sale.discountAmount.toString(), totalAmount: sale.totalAmount.toString(), createdAt: sale.createdAt.toISOString() } }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to complete sale.' }, { status: 500 });
  }
}
