import { NextResponse } from 'next/server';
import { stockCountCreateSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import {
  createStockCount,
  serializeStockCount,
  StockCountError
} from '@/lib/stock-counts';

export async function POST(request: Request) {
  try {
    const { shopId, userId } = await requireRole('CASHIER');
    const body = await request.json();
    const parsed = stockCountCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid stock count.' },
        { status: 400 }
      );
    }

    const stockCount = await createStockCount({
      shopId,
      createdByUserId: userId,
      title: parsed.data.title,
      notes: parsed.data.notes,
      isBlind: parsed.data.isBlind
    });

    return NextResponse.json(
      {
        stockCount: serializeStockCount(stockCount)
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof StockCountError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return apiErrorResponse(error, 'Unable to create stock count.');
  }
}
