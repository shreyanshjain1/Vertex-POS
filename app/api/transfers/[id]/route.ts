import { NextResponse } from 'next/server';
import { stockTransferActionSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import {
  cancelStockTransfer,
  getStockTransferDetailOrThrow,
  receiveStockTransfer,
  sendStockTransfer,
  StockTransferOperationError
} from '@/lib/stock-transfer-operations';
import { serializeStockTransfer } from '@/lib/stock-transfers';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const body = await request.json();
    const parsed = stockTransferActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid stock transfer action.' },
        { status: 400 }
      );
    }

    const { id } = await params;

    const stockTransfer = await prisma.$transaction(async (tx) => {
      const detail = await getStockTransferDetailOrThrow(tx, id, shopId);

      switch (parsed.data.action) {
        case 'SEND':
          if (detail.fromShopId !== shopId) {
            throw new StockTransferOperationError('Send this transfer from the source branch only.', 403);
          }
          await sendStockTransfer({ tx, stockTransfer: detail, userId });
          break;
        case 'RECEIVE':
          if (detail.toShopId !== shopId) {
            throw new StockTransferOperationError('Receive this transfer from the destination branch only.', 403);
          }
          await receiveStockTransfer({ tx, stockTransfer: detail, userId });
          break;
        case 'CANCEL':
          if (detail.fromShopId !== shopId) {
            throw new StockTransferOperationError('Cancel this transfer from the source branch only.', 403);
          }
          await cancelStockTransfer({ tx, stockTransfer: detail, userId });
          break;
      }

      return getStockTransferDetailOrThrow(tx, id, shopId);
    });

    return NextResponse.json({
      stockTransfer: serializeStockTransfer(stockTransfer)
    });
  } catch (error) {
    if (error instanceof StockTransferOperationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return apiErrorResponse(error, 'Unable to update stock transfer.');
  }
}
