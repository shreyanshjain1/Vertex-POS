import { NextResponse } from 'next/server';
import { getRequestMetadata, logAuthAudit } from '@/lib/auth/audit';
import { createPasswordResetToken, hashPasswordResetToken } from '@/lib/auth/password-reset';
import { passwordResetRequestSchema } from '@/lib/auth/validation';
import { prisma } from '@/lib/prisma';
import { buildAppUrl, isMailConfigured, sendPasswordResetEmail } from '@/lib/email';

const GENERIC_SUCCESS_MESSAGE =
  'If an account exists for that email, a password reset link has been sent.';

export async function POST(request: Request) {
  try {
    if (!isMailConfigured()) {
      return NextResponse.json(
        {
          error:
            'Password reset email delivery is not configured yet. Set the SMTP and mail environment variables first.'
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const parsed = passwordResetRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid password reset request.' },
        { status: 400 }
      );
    }

    const email = parsed.data.email;
    const requestMetadata = getRequestMetadata(request);
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerifiedAt: true,
        defaultShopId: true,
        memberships: {
          where: { isActive: true },
          select: {
            shopId: true,
            role: true,
            shop: {
              select: {
                name: true
              }
            }
          },
          orderBy: { assignedAt: 'asc' }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ ok: true, message: GENERIC_SUCCESS_MESSAGE });
    }

    const preferredMembership =
      user.memberships.find((membership) => membership.shopId === user.defaultShopId) ??
      user.memberships[0] ??
      null;

    const shopId = preferredMembership?.shopId ?? user.defaultShopId ?? null;
    const shopName = preferredMembership?.shop.name ?? null;

    const rawToken = createPasswordResetToken();
    const tokenHash = hashPasswordResetToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

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
        select: {
          id: true
        }
      });

      await logAuthAudit({
        tx,
        action: 'PASSWORD_RESET_ISSUED',
        userId: user.id,
        shopId,
        email: user.email,
        ...requestMetadata,
        metadata: {
          source: 'self_service',
          emailVerified: Boolean(user.emailVerifiedAt)
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

      await prisma.passwordResetToken.updateMany({
        where: {
          id: created.id,
          userId: user.id,
          usedAt: null
        },
        data: {
          usedAt: new Date()
        }
      });

      return NextResponse.json(
        { error: 'Unable to send the password reset email right now. Please try again later.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, message: GENERIC_SUCCESS_MESSAGE });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to request a password reset.' }, { status: 500 });
  }
}
