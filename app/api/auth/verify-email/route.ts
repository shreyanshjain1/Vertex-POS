import { NextResponse } from 'next/server';
import { getRequestMetadata, logAuthAudit } from '@/lib/auth/audit';
import { hashEmailVerificationToken } from '@/lib/auth/email-verification';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token.trim() : '';

    if (!token) {
      return NextResponse.json({ error: 'Verification token is required.' }, { status: 400 });
    }

    const tokenHash = hashEmailVerificationToken(token);
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            emailVerifiedAt: true
          }
        }
      }
    });

    if (!verificationToken || verificationToken.usedAt || verificationToken.expiresAt <= new Date()) {
      return NextResponse.json(
        { error: 'This verification link is invalid or has expired.' },
        { status: 400 }
      );
    }

    const requestMetadata = getRequestMetadata(request);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: verificationToken.userId },
        data: {
          emailVerifiedAt: verificationToken.user.emailVerifiedAt ?? new Date()
        }
      });

      await tx.emailVerificationToken.updateMany({
        where: { userId: verificationToken.userId, usedAt: null },
        data: { usedAt: new Date() }
      });

      await logAuthAudit({
        tx,
        action: 'EMAIL_VERIFIED',
        userId: verificationToken.userId,
        email: verificationToken.user.email,
        ...requestMetadata
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to verify the email address.' }, { status: 500 });
  }
}
