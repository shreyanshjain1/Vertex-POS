import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { cashSessionReviewSchema } from '@/lib/auth/validation';
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
    const parsed = cashSessionReviewSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid register review payload.' },
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
        { error: 'Close the register session before manager review.' },
        { status: 409 }
      );
    }

    const reviewedSession = await prisma.$transaction(async (tx) => {
      const updated = await tx.cashSession.update({
        where: { id: cashSession.id },
        data: {
          reviewedByUserId: userId,
          reviewedAt: new Date(),
          reviewNote: parsed.data.reviewNote?.trim() || null
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
        action: 'REGISTER_REVIEWED',
        entityType: 'CashSession',
        entityId: cashSession.id,
        description: `Manager reviewed register session ${cashSession.id}.`,
        metadata: {
          reviewedAt: updated.reviewedAt?.toISOString() ?? null,
          reviewNote: updated.reviewNote
        }
      });

      return updated;
    });

    return NextResponse.json({ session: serializeCashSession(reviewedSession) });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to review register session.');
  }
}
