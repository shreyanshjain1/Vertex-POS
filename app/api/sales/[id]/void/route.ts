import { NextResponse } from 'next/server';
import { saleVoidSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import {
  createVoidSaleAdjustment,
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
    const parsed = saleVoidSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid void payload.' },
        { status: 400 }
      );
    }

    const adjustment = await createVoidSaleAdjustment({
      shopId,
      saleId: id,
      createdByUserId: userId,
      createdByName: session.user.name ?? session.user.email ?? 'Cashier',
      reason: parsed.data.reason,
      notes: parsed.data.notes,
      approverEmail: parsed.data.approverEmail,
      approverPassword: parsed.data.approverPassword,
      refundPayments: parsed.data.refundPayments
    });

    return NextResponse.json({
      adjustment: serializeSaleAdjustment(adjustment)
    });
  } catch (error) {
    if (error instanceof SaleAdjustmentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return apiErrorResponse(error, 'Unable to void the sale.');
  }
}
