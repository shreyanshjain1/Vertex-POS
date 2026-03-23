import { NextResponse } from 'next/server';
import { ShopRole, ShopType } from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { onboardSchema } from '@/lib/auth/validation';
import { slugify } from '@/lib/slug';

async function uniqueSlug(name: string) {
  const base = slugify(name) || 'shop';
  let attempt = base;
  let i = 2;
  while (await prisma.shop.findUnique({ where: { slug: attempt }, select: { id: true } })) {
    attempt = `${base}-${i++}`;
  }
  return attempt;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const existing = await prisma.userShop.findFirst({ where: { userId: session.user.id }, include: { shop: true } });
    if (existing) return NextResponse.json({ shop: existing.shop });

    const body = await request.json();
    const parsed = onboardSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid onboarding data' }, { status: 400 });

    const slug = await uniqueSlug(parsed.data.shopName);

    const result = await prisma.$transaction(async (tx) => {
      const shop = await tx.shop.create({
        data: {
          name: parsed.data.shopName,
          slug,
          posType: parsed.data.posType as ShopType,
          phone: parsed.data.phone || null,
          email: parsed.data.email || null,
          address: parsed.data.address || null,
          taxId: parsed.data.taxId || null,
          ownerId: session.user!.id
        }
      });

      await tx.userShop.create({ data: { userId: session.user!.id, shopId: shop.id, role: ShopRole.ADMIN } });
      await tx.user.update({ where: { id: session.user!.id }, data: { defaultShopId: shop.id } });
      await tx.shopSetting.create({
        data: {
          shopId: shop.id,
          currencyCode: parsed.data.currencyCode,
          currencySymbol: parsed.data.currencySymbol,
          taxRate: parsed.data.taxRate,
          receiptHeader: parsed.data.receiptHeader || null,
          receiptFooter: parsed.data.receiptFooter || null,
          lowStockThreshold: parsed.data.lowStockThreshold,
          lowStockEnabled: true
        }
      });

      const categoryMap = new Map<string, string>();
      for (const category of parsed.data.categories) {
        const record = await tx.category.create({ data: { shopId: shop.id, name: category.name, slug: slugify(category.name) || crypto.randomUUID() } });
        categoryMap.set(category.name.toLowerCase(), record.id);
        await tx.activityLog.create({ data: { shopId: shop.id, userId: session.user!.id, action: 'CATEGORY_CREATED', entityType: 'Category', entityId: record.id, description: `Created onboarding category ${record.name}` } });
      }

      for (const supplier of parsed.data.suppliers) {
        if (!supplier.name.trim()) continue;
        const record = await tx.supplier.create({ data: { shopId: shop.id, name: supplier.name, contactName: supplier.contactName || null, phone: supplier.phone || null } });
        await tx.activityLog.create({ data: { shopId: shop.id, userId: session.user!.id, action: 'SUPPLIER_CREATED', entityType: 'Supplier', entityId: record.id, description: `Created onboarding supplier ${record.name}` } });
      }

      for (const product of parsed.data.products) {
        if (!product.name.trim()) continue;
        const categoryId = product.categoryName ? categoryMap.get(product.categoryName.toLowerCase()) ?? null : null;
        const record = await tx.product.create({
          data: {
            shopId: shop.id,
            categoryId,
            name: product.name,
            sku: product.sku || null,
            barcode: product.barcode || null,
            cost: product.cost,
            price: product.price,
            stockQty: product.stockQty,
            reorderPoint: product.reorderPoint
          }
        });
        if (product.stockQty > 0) {
          await tx.inventoryMovement.create({ data: { shopId: shop.id, productId: record.id, type: 'OPENING_STOCK', qtyChange: product.stockQty, notes: 'Opening stock during onboarding' } });
        }
        await tx.activityLog.create({ data: { shopId: shop.id, userId: session.user!.id, action: 'PRODUCT_CREATED', entityType: 'Product', entityId: record.id, description: `Created onboarding product ${record.name}` } });
      }

      await tx.activityLog.create({ data: { shopId: shop.id, userId: session.user!.id, action: 'SHOP_ONBOARDED', entityType: 'Shop', entityId: shop.id, description: `Completed onboarding for ${shop.name}` } });
      return shop;
    });

    return NextResponse.json({ shop: result }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to complete onboarding.' }, { status: 500 });
  }
}
