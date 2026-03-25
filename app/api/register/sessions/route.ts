import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { cashSessionOpenSchema } from '@/lib/auth/validation';
import { normalizeText } from '@/lib/inventory';
import { prisma } from '@/lib/prisma';
import { getActiveCashSession } from '@/lib/register';
import { serializeCashSession } from '@/lib/serializers/register';

export async function POST(request: Request) {
  try {
    const { shopId, userId, session } = await requireRole('CASHIER');
    const body = await request.json();
    const parsed = cashSessionOpenSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid register opening payload.' },
        { status: 400 }
      );
    }

    const currentSession = await getActiveCashSession(prisma, shopId, userId);
    if (currentSession) {
      return NextResponse.json(
        { error: 'You already have an active register session in this shop.' },
        { status: 409 }
      );
    }

    const createdSession = await prisma.$transaction(async (tx) => {
      const cashSession = await tx.cashSession.create({
        data: {
          shopId,
          userId,
          openingFloat: parsed.data.openingFloat,
          notes: normalizeText(parsed.data.notes),
          status: 'OPEN'
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      await logActivity({
        tx,
        shopId,
        userId,
        action: 'REGISTER_OPENED',
        entityType: 'CashSession',
        entityId: cashSession.id,
        description: `Opened register session for ${session.user.name ?? session.user.email ?? 'cashier'}.`,
        metadata: {
          openingFloat: parsed.data.openingFloat
        }
      });

      return cashSession;
    });

    return NextResponse.json(
      { session: serializeCashSession(createdSession) },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'You already have an active register session in this shop.' },
        { status: 409 }
      );
    }

    return apiErrorResponse(error, 'Unable to open register session.');
  }
}
