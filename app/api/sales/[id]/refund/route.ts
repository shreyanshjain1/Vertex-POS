import { NextResponse } from 'next/server';
import { saleRefundSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import {
  createRefundSaleAdjustment,
  SaleAdjustmentError,
  serializeSaleAdjustment
} from '@/lib/sale-adjustments';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { shopId, userId, session } = await requireRole('CASHIER');
    const body = await request.json();
    const parsed = saleRefundSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid refund payload.' },
        { status: 400 }
      );
    }

    const adjustment = await createRefundSaleAdjustment({
      shopId,
      saleId: id,
      createdByUserId: userId,
      createdByName: session.user.name ?? session.user.email ?? 'Cashier',
      type: parsed.data.type,
      reason: parsed.data.reason,
      notes: parsed.data.notes,
      approverEmail: parsed.data.approverEmail,
      approverPassword: parsed.data.approverPassword,
      items: parsed.data.items,
      replacementItems: parsed.data.replacementItems,
      refundPayments: parsed.data.refundPayments,
      exchangePayments: parsed.data.exchangePayments
    });

    return NextResponse.json({
      adjustment: serializeSaleAdjustment(adjustment)
    });
  } catch (error) {
    if (error instanceof SaleAdjustmentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return apiErrorResponse(error, 'Unable to process the refund.');
  }
}
