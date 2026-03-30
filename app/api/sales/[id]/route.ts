import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { saleDetailInclude, serializeSaleDetail } from '@/lib/sale-adjustments';

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { shopId } = await requireRole('CASHIER');
    const { id } = await params;

    const sale = await prisma.sale.findFirst({
      where: { id, shopId },
      include: saleDetailInclude
    });

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found.' }, { status: 404 });
    }

    return NextResponse.json({
      sale: serializeSaleDetail(sale)
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load sale.');
  }
}
