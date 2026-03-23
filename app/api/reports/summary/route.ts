import { NextResponse } from 'next/server';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const { shopId } = await getActiveShopContext();
    const [salesAggregate, purchaseAggregate, settings] = await Promise.all([
      prisma.sale.aggregate({ where: { shopId }, _sum: { totalAmount: true }, _count: true }),
      prisma.purchaseOrder.aggregate({ where: { shopId }, _sum: { totalAmount: true }, _count: true }),
      prisma.shopSetting.findUnique({ where: { shopId } })
    ]);
    const lowStockCount = await prisma.product.count({ where: { shopId, isActive: true, stockQty: { lte: settings?.lowStockThreshold ?? 5 } } });
    return NextResponse.json({ revenue: Number(salesAggregate._sum.totalAmount ?? 0), salesCount: salesAggregate._count, purchaseSpend: Number(purchaseAggregate._sum.totalAmount ?? 0), purchaseCount: purchaseAggregate._count, lowStockCount });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to load summary.' }, { status: 500 });
  }
}
