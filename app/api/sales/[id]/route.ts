import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { prisma } from '@/lib/prisma';

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { shopId } = await requireRole('CASHIER');
    const { id } = await params;

    const sale = await prisma.sale.findFirst({
      where: { id, shopId },
      include: { items: true }
    });

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found.' }, { status: 404 });
    }

    return NextResponse.json({
      sale: {
        ...sale,
        subtotal: sale.subtotal.toString(),
        taxAmount: sale.taxAmount.toString(),
        discountAmount: sale.discountAmount.toString(),
        totalAmount: sale.totalAmount.toString(),
        createdAt: sale.createdAt.toISOString(),
        updatedAt: sale.updatedAt.toISOString(),
        items: sale.items.map((item) => ({
          ...item,
          unitPrice: item.unitPrice.toString(),
          lineTotal: item.lineTotal.toString()
        }))
      }
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load sale.');
  }
}
