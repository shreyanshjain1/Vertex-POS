import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { logAuthAudit } from '@/lib/auth/audit';
import { createPasswordResetToken, hashPasswordResetToken } from '@/lib/auth/password-reset';
import { passwordResetGenerateSchema } from '@/lib/auth/validation';
import { prisma } from '@/lib/prisma';
import { assertManagedShopAccess } from '@/lib/staff';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await requireRole('ADMIN');
    const body = await request.json().catch(() => ({}));
    const parsed = passwordResetGenerateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid reset request.' },
        { status: 400 }
      );
    }

    const membership = await prisma.userShop.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        shop: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!membership) {
      return NextResponse.json({ error: 'Staff assignment not found.' }, { status: 404 });
    }

    const hasAccess = await assertManagedShopAccess(userId, membership.shopId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'You do not have access to that staff record.' }, { status: 403 });
    }

    const rawToken = createPasswordResetToken();
    const tokenHash = hashPasswordResetToken(rawToken);
    const expiresAt = new Date(Date.now() + parsed.data.expiresInHours * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: {
          userId: membership.userId,
          usedAt: null
        },
        data: {
          usedAt: new Date()
        }
      });

      await tx.passwordResetToken.create({
        data: {
          userId: membership.userId,
          shopId: membership.shopId,
          createdById: userId,
          tokenHash,
          expiresAt
        }
      });

      await logActivity({
        tx,
        shopId: membership.shopId,
        userId,
        action: 'STAFF_PASSWORD_RESET_ISSUED',
        entityType: 'User',
        entityId: membership.userId,
        description: `Issued a password reset link for ${membership.user.name ?? membership.user.email}.`
      });

      await logAuthAudit({
        tx,
        action: 'PASSWORD_RESET_ISSUED',
        userId: membership.userId,
        shopId: membership.shopId,
        email: membership.user.email,
        metadata: {
          issuedByUserId: userId
        }
      });
    });

    const resetUrl = new URL('/reset-password', request.url);
    resetUrl.searchParams.set('token', rawToken);

    return NextResponse.json({
      ok: true,
      resetUrl: resetUrl.toString(),
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to create a password reset link.');
  }
}
