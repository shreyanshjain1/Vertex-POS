import { NextResponse } from 'next/server';
import { settingSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { normalizeText } from '@/lib/inventory';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const { shopId } = await requireRole('MANAGER');
    const [shop, settings] = await Promise.all([
      prisma.shop.findUnique({ where: { id: shopId } }),
      prisma.shopSetting.findUnique({ where: { shopId } })
    ]);

    return NextResponse.json({ shop, settings });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load settings.');
  }
}

export async function PUT(request: Request) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const body = await request.json();
    const parsed = settingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid settings.' },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.shop.update({
        where: { id: shopId },
        data: {
          name: parsed.data.shopName.trim(),
          phone: normalizeText(parsed.data.phone),
          email: normalizeText(parsed.data.email),
          address: normalizeText(parsed.data.address),
          taxId: normalizeText(parsed.data.taxId)
        }
      });

      await tx.shopSetting.upsert({
        where: { shopId },
        update: {
          currencyCode: parsed.data.currencyCode.trim().toUpperCase(),
          currencySymbol: parsed.data.currencySymbol.trim(),
          taxRate: parsed.data.taxRate,
          receiptHeader: normalizeText(parsed.data.receiptHeader),
          receiptFooter: normalizeText(parsed.data.receiptFooter),
          receiptWidth: parsed.data.receiptWidth,
          lowStockEnabled: parsed.data.lowStockEnabled,
          lowStockThreshold: parsed.data.lowStockThreshold,
          salePrefix: parsed.data.salePrefix.trim().toUpperCase(),
          receiptPrefix: parsed.data.receiptPrefix.trim().toUpperCase(),
          purchasePrefix: parsed.data.purchasePrefix.trim().toUpperCase()
        },
        create: {
          shopId,
          currencyCode: parsed.data.currencyCode.trim().toUpperCase(),
          currencySymbol: parsed.data.currencySymbol.trim(),
          taxRate: parsed.data.taxRate,
          receiptHeader: normalizeText(parsed.data.receiptHeader),
          receiptFooter: normalizeText(parsed.data.receiptFooter),
          receiptWidth: parsed.data.receiptWidth,
          lowStockEnabled: parsed.data.lowStockEnabled,
          lowStockThreshold: parsed.data.lowStockThreshold,
          salePrefix: parsed.data.salePrefix.trim().toUpperCase(),
          receiptPrefix: parsed.data.receiptPrefix.trim().toUpperCase(),
          purchasePrefix: parsed.data.purchasePrefix.trim().toUpperCase()
        }
      });

      await logActivity({
        tx,
        shopId,
        userId,
        action: 'SETTINGS_UPDATED',
        entityType: 'ShopSetting',
        entityId: shopId,
        description: 'Updated shop settings.'
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to save settings.');
  }
}
