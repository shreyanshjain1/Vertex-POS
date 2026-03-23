import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { productSchema } from '@/lib/auth/validation';

export async function GET() {
  const { shopId } = await requireRole('CASHIER');
  const products = await prisma.product.findMany({ where: { shopId }, include: { category: true }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const body = await request.json();
    const parsed = productSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid product data.' }, { status: 400 });
    if (parsed.data.sku) {
      const existing = await prisma.product.findFirst({ where: { shopId, sku: parsed.data.sku } });
      if (existing) return NextResponse.json({ error: 'A product with this SKU already exists.' }, { status: 409 });
    }
    if (parsed.data.barcode) {
      const existing = await prisma.product.findFirst({ where: { shopId, barcode: parsed.data.barcode } });
      if (existing) return NextResponse.json({ error: 'A product with this barcode already exists.' }, { status: 409 });
    }
    const product = await prisma.product.create({ data: { shopId, ...parsed.data }, include: { category: { select: { name: true } } } });
    if (parsed.data.stockQty > 0) {
      await prisma.inventoryMovement.create({ data: { shopId, productId: product.id, type: 'OPENING_STOCK', qtyChange: parsed.data.stockQty, notes: 'Opening stock from product creation' } });
    }
    await prisma.activityLog.create({ data: { shopId, userId, action: 'PRODUCT_CREATED', entityType: 'Product', entityId: product.id, description: `Created product ${product.name}` } });
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to create product.' }, { status: 500 });
  }
}
