import { NextResponse } from 'next/server';
import { logActivity } from '@/lib/activity';
import { getRequestMetadata, logAuthAudit } from '@/lib/auth/audit';
import { hashPassword } from '@/lib/auth/password';
import { hashPasswordResetToken } from '@/lib/auth/password-reset';
import { passwordResetConsumeSchema } from '@/lib/auth/validation';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = passwordResetConsumeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid password reset request.' },
        { status: 400 }
      );
    }

    const tokenHash = hashPasswordResetToken(parsed.data.token);
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
      return NextResponse.json(
        { error: 'This reset link is invalid or has expired.' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const requestMetadata = getRequestMetadata(request);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash }
      });

      await tx.passwordResetToken.updateMany({
        where: {
          userId: resetToken.userId,
          usedAt: null
        },
        data: {
          usedAt: new Date()
        }
      });

      if (resetToken.shopId) {
        await logActivity({
          tx,
          shopId: resetToken.shopId,
          userId: resetToken.userId,
          action: 'STAFF_PASSWORD_RESET_COMPLETED',
          entityType: 'User',
          entityId: resetToken.userId,
          description: `Password was reset for ${resetToken.user.name ?? resetToken.user.email}.`
        });
      }

      await logAuthAudit({
        tx,
        action: 'PASSWORD_RESET_COMPLETED',
        userId: resetToken.userId,
        shopId: resetToken.shopId,
        email: resetToken.user.email,
        ...requestMetadata
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to reset password.' }, { status: 500 });
  }
}
