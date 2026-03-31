import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { getReportsOverviewData } from '@/lib/reporting';

export async function GET() {
  try {
    const { shopId } = await requirePermission('VIEW_REPORTS');
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29, 0, 0, 0, 0);
    const to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const overview = await getReportsOverviewData(shopId, { from, to });

    return NextResponse.json({
      revenue: overview.revenue,
      salesCount: overview.transactionCount,
      inventoryValuation: overview.inventoryValuation,
      grossProfit: overview.grossProfit,
      refundTotal: overview.refundTotal,
      voidTotal: overview.voidTotal
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load summary.');
  }
}
