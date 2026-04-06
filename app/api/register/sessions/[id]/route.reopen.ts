import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { cashSessionReopenSchema } from '@/lib/auth/validation';
import { acquireCashSessionOpenLock, appendRegisterNotes, getActiveCashSession } from '@/lib/register';
import { prisma } from '@/lib/prisma';
import { serializeCashSession } from '@/lib/serializers/register';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { shopId, userId } = await requireRole('MANAGER');
    const body = await request.json();
    const parsed = cashSessionReopenSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid reopen payload.' },
        { status: 400 }
      );
    }

    const cashSession = await prisma.cashSession.findFirst({
      where: {
        id,
        shopId
      }
    });

    if (!cashSession) {
      return NextResponse.json({ error: 'Register session not found.' }, { status: 404 });
    }

    if (cashSession.status === 'OPEN') {
      return NextResponse.json(
        { error: 'This register session is already open.' },
        { status: 409 }
      );
    }

    const conflictingOpenSession = await prisma.cashSession.findFirst({
      where: {
        shopId,
        userId: cashSession.userId,
        status: 'OPEN',
        id: {
          not: cashSession.id
        }
      },
      select: {
        id: true
      }
    });

    if (conflictingOpenSession) {
      return NextResponse.json(
        { error: 'The cashier already has another open register session in this branch.' },
        { status: 409 }
      );
    }

    const reopenedSession = await prisma.$transaction(async (tx) => {
      await acquireCashSessionOpenLock(tx, shopId, cashSession.userId);

      const conflictingOpenSessionInTx = await getActiveCashSession(tx, shopId, cashSession.userId);
      if (conflictingOpenSessionInTx && conflictingOpenSessionInTx.id !== cashSession.id) {
        throw new Prisma.PrismaClientKnownRequestError(
          'A cashier can only have one open register session per shop.',
          {
            code: 'P2002',
            clientVersion: Prisma.prismaVersion.client
          }
        );
      }

      const updated = await tx.cashSession.update({
        where: { id: cashSession.id },
        data: {
          status: 'OPEN',
          closedAt: null,
          closedByUserId: null,
          closingExpected: null,
          closingActual: null,
          variance: null,
          denominationBreakdown: Prisma.DbNull,
          reviewedByUserId: null,
          reviewedAt: null,
          reviewNote: null,
          reopenedByUserId: userId,
          reopenedAt: new Date(),
          reopenReason: parsed.data.reason.trim(),
          notes: appendRegisterNotes(
            cashSession.notes,
            `Shift reopened: ${parsed.data.reason.trim()}`
          )
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          closedByUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          reviewedByUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          reopenedByUser: {
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
        action: 'REGISTER_REOPENED',
        entityType: 'CashSession',
        entityId: cashSession.id,
        description: `Reopened register session ${cashSession.id}.`,
        metadata: {
          reopenReason: parsed.data.reason.trim()
        }
      });

      return updated;
    });

    return NextResponse.json({ session: serializeCashSession(reopenedSession) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'The cashier already has another open register session in this branch.' },
        { status: 409 }
      );
    }

    return apiErrorResponse(error, 'Unable to reopen register session.');
  }
}
