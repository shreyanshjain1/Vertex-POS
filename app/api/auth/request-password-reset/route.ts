import { NextResponse } from 'next/server';
import { logAuthAudit } from '@/lib/auth/audit';
import { createPasswordResetToken, hashPasswordResetToken } from '@/lib/auth/password-reset';
import { passwordResetRequestSchema } from '@/lib/auth/validation';
import { prisma } from '@/lib/prisma';
import { buildAppUrl, isMailConfigured, sendPasswordResetEmail } from '@/lib/email';

const GENERIC_SUCCESS_MESSAGE =
  'If the email exists in the system, a password reset link has been sent.';

export async function POST(request: Request) {
  try {
    if (!isMailConfigured()) {
      return NextResponse.json(
        {
          error:
            'Email delivery is not configured yet. Set the SMTP and mail environment variables before requesting password resets.'
        },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = passwordResetRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid password reset request.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: {
        id: true,
        name: true,
        email: true,
        forcePasswordReset: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        userShops: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          select: {
            shopId: true,
            shop: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ ok: true, message: GENERIC_SUCCESS_MESSAGE });
    }

    const rawToken = createPasswordResetToken();
    const tokenHash = hashPasswordResetToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const primaryMembership = user.userShops[0] ?? null;
    const shopId = primaryMembership?.shopId ?? null;
    const shopName = primaryMembership?.shop.name ?? null;

    const created = await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null
        },
        data: {
          usedAt: new Date()
        }
      });

      const token = await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          shopId,
          createdById: null,
          tokenHash,
          expiresAt
        },
        select: { id: true }
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          forcePasswordReset: true,
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      });

      await logAuthAudit({
        tx,
        action: 'PASSWORD_RESET_REQUESTED',
        userId: user.id,
        shopId,
        email: user.email,
        metadata: {
          selfService: true
        }
      });

      return token;
    });

    const resetUrl = buildAppUrl(`/reset-password?token=${rawToken}`, request);

    try {
      await sendPasswordResetEmail({
        to: {
          email: user.email,
          name: user.name
        },
        resetUrl,
        expiresAt,
        issuedByName: 'Vertex POS',
        shopName
      });
    } catch (mailError) {
      console.error('Failed to send self-service password reset email.', mailError);

      await prisma.$transaction(async (tx) => {
        await tx.passwordResetToken.updateMany({
          where: {
            id: created.id,
            userId: user.id,
            usedAt: null
          },
          data: {
            usedAt: new Date()
          }
        });

        await tx.user.update({
          where: { id: user.id },
          data: {
            forcePasswordReset: user.forcePasswordReset,
            failedLoginAttempts: user.failedLoginAttempts,
            lockedUntil: user.lockedUntil
          }
        });
      });

      return NextResponse.json(
        {
          error: 'Unable to send the password reset email right now. Please try again later.'
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, message: GENERIC_SUCCESS_MESSAGE });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Unable to create a password reset request.' },
      { status: 500 }
    );
  }
}
