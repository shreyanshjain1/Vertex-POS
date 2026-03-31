import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const { shopId } = await requireRole('MANAGER');
    const [salesAggregate, refundAggregate, purchaseReceipts, settings] = await Promise.all([
      prisma.sale.aggregate({
        where: { shopId, status: 'COMPLETED' },
        _sum: { totalAmount: true },
        _count: true
      }),
      prisma.saleAdjustment.aggregate({
        where: { shopId },
        _sum: { totalAmount: true }
      }),
      prisma.purchaseReceipt.findMany({
        where: { shopId },
        select: {
          purchaseId: true,
          items: {
            select: {
              qtyReceived: true,
              purchaseItem: {
                select: {
                  unitCost: true
                }
              }
            }
          }
        }
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

    const purchaseSpend = purchaseReceipts.reduce(
      (sum, receipt) =>
        sum +
        receipt.items.reduce(
          (receiptSum, item) => receiptSum + item.qtyReceived * Number(item.purchaseItem.unitCost.toString()),
          0
        ),
      0
    );
    const purchaseCount = new Set(purchaseReceipts.map((receipt) => receipt.purchaseId)).size;

    return NextResponse.json({
      revenue: Number(salesAggregate._sum.totalAmount ?? 0) - Number(refundAggregate._sum.totalAmount ?? 0),
      salesCount: salesAggregate._count,
      purchaseSpend,
      purchaseCount,
      lowStockCount
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load summary.');
  }
}
