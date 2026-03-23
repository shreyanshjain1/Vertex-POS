import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { settingSchema } from '@/lib/auth/validation';

export async function GET() {
  const { shopId } = await requireRole('MANAGER');
  const [shop, settings] = await Promise.all([
    prisma.shop.findUnique({ where: { id: shopId } }),
    prisma.shopSetting.findUnique({ where: { shopId } })
  ]);
  return NextResponse.json({ shop, settings });
}

export async function PUT(request: Request) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const body = await request.json();
    const parsed = settingSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid settings.' }, { status: 400 });
    await prisma.$transaction(async (tx) => {
      await tx.shop.update({ where: { id: shopId }, data: { name: parsed.data.shopName, phone: parsed.data.phone || null, email: parsed.data.email || null, address: parsed.data.address || null, taxId: parsed.data.taxId || null } });
      await tx.shopSetting.upsert({
        where: { shopId },
        update: { currencyCode: parsed.data.currencyCode, currencySymbol: parsed.data.currencySymbol, taxRate: parsed.data.taxRate, receiptHeader: parsed.data.receiptHeader || null, receiptFooter: parsed.data.receiptFooter || null, lowStockEnabled: parsed.data.lowStockEnabled, lowStockThreshold: parsed.data.lowStockThreshold, salePrefix: parsed.data.salePrefix, receiptPrefix: parsed.data.receiptPrefix, purchasePrefix: parsed.data.purchasePrefix },
        create: { shopId, currencyCode: parsed.data.currencyCode, currencySymbol: parsed.data.currencySymbol, taxRate: parsed.data.taxRate, receiptHeader: parsed.data.receiptHeader || null, receiptFooter: parsed.data.receiptFooter || null, lowStockEnabled: parsed.data.lowStockEnabled, lowStockThreshold: parsed.data.lowStockThreshold, salePrefix: parsed.data.salePrefix, receiptPrefix: parsed.data.receiptPrefix, purchasePrefix: parsed.data.purchasePrefix }
      });
      await tx.activityLog.create({ data: { shopId, userId, action: 'SETTINGS_UPDATED', entityType: 'ShopSetting', entityId: shopId, description: 'Updated shop settings.' } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to save settings.' }, { status: 500 });
  }
}
