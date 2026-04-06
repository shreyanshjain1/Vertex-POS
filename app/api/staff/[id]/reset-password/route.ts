import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { logAuthAudit } from '@/lib/auth/audit';
import { createPasswordResetToken, hashPasswordResetToken } from '@/lib/auth/password-reset';
import { passwordResetGenerateSchema } from '@/lib/auth/validation';
import { prisma } from '@/lib/prisma';
import { assertManagedShopAccess } from '@/lib/staff';
import { buildAppUrl, isMailConfigured, sendPasswordResetEmail } from '@/lib/email';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isMailConfigured()) {
      return NextResponse.json(
        {
          error:
            'Email delivery is not configured yet. Set the SMTP and mail environment variables before issuing staff password resets.'
        },
        { status: 503 }
      );
    }

    const { id } = await params;
    const { userId } = await requirePermission('MANAGE_STAFF');
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
            email: true,
            forcePasswordReset: true,
            failedLoginAttempts: true,
            lockedUntil: true
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

    const issuedBy = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true
      }
    });

    const rawToken = createPasswordResetToken();
    const tokenHash = hashPasswordResetToken(rawToken);
    const expiresAt = new Date(Date.now() + parsed.data.expiresInHours * 60 * 60 * 1000);

    const created = await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: {
          userId: membership.userId,
          usedAt: null
        },
        data: {
          usedAt: new Date()
        }
      });

      const token = await tx.passwordResetToken.create({
        data: {
          userId: membership.userId,
          shopId: membership.shopId,
          createdById: userId,
          tokenHash,
          expiresAt
        },
        select: {
          id: true
        }
      });

      await tx.user.update({
        where: { id: membership.userId },
        data: {
          forcePasswordReset: true,
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      });

      await logActivity({
        tx,
        shopId: membership.shopId,
        userId,
        action: 'STAFF_PASSWORD_RESET_ISSUED',
        entityType: 'User',
        entityId: membership.userId,
        description: `Issued a password reset email for ${membership.user.name ?? membership.user.email}.`
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

      return token;
    });

    const resetUrl = buildAppUrl(`/reset-password?token=${rawToken}`, request);

    try {
      await sendPasswordResetEmail({
        to: {
          email: membership.user.email,
          name: membership.user.name
        },
        resetUrl,
        expiresAt,
        issuedByName: issuedBy?.name ?? issuedBy?.email ?? 'your administrator',
        shopName: membership.shop.name
      });
    } catch (mailError) {
      console.error('Failed to send password reset email.', mailError);

      await prisma.$transaction(async (tx) => {
        await tx.passwordResetToken.updateMany({
          where: {
            id: created.id,
            userId: membership.userId,
            usedAt: null
          },
          data: {
            usedAt: new Date()
          }
        });

        await tx.user.update({
          where: { id: membership.userId },
          data: {
            forcePasswordReset: membership.user.forcePasswordReset,
            failedLoginAttempts: membership.user.failedLoginAttempts,
            lockedUntil: membership.user.lockedUntil
          }
        });
      });

      return NextResponse.json(
        {
          error: 'Unable to send the password reset email right now. Please check your mail settings and try again.'
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      emailSent: true,
      expiresAt: expiresAt.toISOString(),
      message: `A password reset email has been sent to ${membership.user.email}.`
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to create a password reset email.');
  }
}
