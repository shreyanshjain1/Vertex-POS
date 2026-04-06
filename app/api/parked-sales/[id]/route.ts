import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import {
  canManageAllParkedSales,
  cleanupExpiredParkedSales
} from '@/lib/parked-sales';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { shopId, userId, role } = await requireRole('CASHIER');

    await cleanupExpiredParkedSales(prisma, shopId);

    const parkedSale = await prisma.parkedSale.findFirst({
      where: {
        id,
        shopId,
        status: 'HELD',
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        items: true,
        cashier: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!parkedSale) {
      return NextResponse.json({ error: 'Saved checkout entry not found.' }, { status: 404 });
    }

    if (parkedSale.cashierUserId !== userId && !canManageAllParkedSales(role)) {
      return NextResponse.json({ error: 'You do not have access to this saved checkout entry.' }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.parkedSale.update({
        where: { id: parkedSale.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date()
        }
      });

      await logActivity({
        tx,
        shopId,
        userId,
        action: 'PARKED_SALE_CANCELLED',
        entityType: 'ParkedSale',
        entityId: parkedSale.id,
        description: `Cancelled ${parkedSale.type === 'QUOTE' ? 'quote' : 'saved cart'} for ${parkedSale.cashier.name ?? parkedSale.cashier.email ?? 'cashier'}.`,
        metadata: {
          itemCount: parkedSale.items.reduce((sum, item) => sum + item.qty, 0),
          totalAmount: Number(parkedSale.totalAmount),
          type: parkedSale.type,
          quoteReference: parkedSale.quoteReference
        }
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to cancel the saved checkout entry.');
  }
}
