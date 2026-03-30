import { NextResponse } from 'next/server';
import { stockCountUpdateSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import {
  saveStockCountSheet,
  serializeStockCount,
  StockCountError,
  transitionStockCount
} from '@/lib/stock-counts';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { shopId, userId, role } = await requireRole('CASHIER');
    const body = await request.json();
    const parsed = stockCountUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid stock count update.' },
        { status: 400 }
      );
    }

    const stockCount =
      parsed.data.action === 'SAVE'
        ? await saveStockCountSheet({
            shopId,
            stockCountId: id,
            actorUserId: userId,
            actorRole: role,
            notes: parsed.data.notes,
            items: parsed.data.items
          })
        : await transitionStockCount({
            shopId,
            stockCountId: id,
            actorUserId: userId,
            actorRole: role,
            action: parsed.data.action
          });

    return NextResponse.json({
      stockCount: serializeStockCount(stockCount)
    });
  } catch (error) {
    if (error instanceof StockCountError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return apiErrorResponse(error, 'Unable to update stock count.');
  }
}
