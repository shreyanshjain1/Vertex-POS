import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const { shopId } = await requireRole('MANAGER');
    const [salesAggregate, refundAggregate, purchaseAggregate, settings] = await Promise.all([
      prisma.sale.aggregate({
        where: { shopId, status: 'COMPLETED' },
        _sum: { totalAmount: true },
        _count: true
      }),
      prisma.saleAdjustment.aggregate({
        where: { shopId },
        _sum: { totalAmount: true }
      }),
      prisma.purchaseOrder.aggregate({
        where: { shopId, status: 'RECEIVED' },
        _sum: { totalAmount: true },
        _count: true
      }),
      prisma.shopSetting.findUnique({ where: { shopId } })
    ]);

    const lowStockCount = await prisma.product.count({
      where: {
        shopId,
        isActive: true,
        stockQty: {
          lte: settings?.lowStockThreshold ?? 5
        }
      }
    });

    return NextResponse.json({
      revenue: Number(salesAggregate._sum.totalAmount ?? 0) - Number(refundAggregate._sum.totalAmount ?? 0),
      salesCount: salesAggregate._count,
      purchaseSpend: Number(purchaseAggregate._sum.totalAmount ?? 0),
      purchaseCount: purchaseAggregate._count,
      lowStockCount
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load summary.');
  }
}
