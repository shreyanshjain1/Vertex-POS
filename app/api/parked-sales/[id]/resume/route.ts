import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import {
  canManageAllParkedSales,
  cleanupExpiredParkedSales,
  serializeParkedSale
} from '@/lib/parked-sales';
import { prisma } from '@/lib/prisma';

export async function POST(
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
        cashier: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        items: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!parkedSale) {
      return NextResponse.json({ error: 'Held cart not found.' }, { status: 404 });
    }

    if (parkedSale.cashierUserId !== userId && !canManageAllParkedSales(role)) {
      return NextResponse.json({ error: 'You do not have access to this held cart.' }, { status: 403 });
    }

    const resumedParkedSale = await prisma.$transaction(async (tx) => {
      const updatedParkedSale = await tx.parkedSale.update({
        where: { id: parkedSale.id },
        data: {
          status: 'RESUMED',
          resumedAt: new Date()
        },
        include: {
          cashier: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          items: {
            orderBy: { createdAt: 'asc' }
          }
        }
      });

      await logActivity({
        tx,
        shopId,
        userId,
        action: 'PARKED_SALE_RESUMED',
        entityType: 'ParkedSale',
        entityId: parkedSale.id,
        description: `Resumed held cart for ${parkedSale.cashier.name ?? parkedSale.cashier.email ?? 'cashier'}.`,
        metadata: {
          itemCount: parkedSale.items.reduce((sum, item) => sum + item.qty, 0),
          totalAmount: Number(parkedSale.totalAmount)
        }
      });

      return updatedParkedSale;
    });

    return NextResponse.json({
      parkedSale: serializeParkedSale(resumedParkedSale)
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to resume the held cart.');
  }
}
