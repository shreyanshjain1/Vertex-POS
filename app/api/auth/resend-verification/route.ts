import { NextResponse } from 'next/server';
import { getRequestMetadata, logAuthAudit } from '@/lib/auth/audit';
import { createEmailVerificationToken, hashEmailVerificationToken } from '@/lib/auth/email-verification';
import { prisma } from '@/lib/prisma';
import { buildAppUrl, isMailConfigured, sendEmailVerificationEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    if (!isMailConfigured()) {
      return NextResponse.json(
        {
          error:
            'Email delivery is not configured yet. Set the SMTP and mail environment variables before resending verification emails.'
        },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerifiedAt: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'No account was found for that email address.' }, { status: 404 });
    }

    if (user.emailVerifiedAt) {
      return NextResponse.json({ error: 'This email address has already been verified.' }, { status: 409 });
    }

    const rawToken = createEmailVerificationToken();
    const tokenHash = hashEmailVerificationToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const requestMetadata = getRequestMetadata(request);

    const createdToken = await prisma.$transaction(async (tx) => {
      await tx.emailVerificationToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null
        },
        data: {
          usedAt: new Date()
        }
      });

      const token = await tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt
        },
        select: {
          id: true
        }
      });

      await logAuthAudit({
        tx,
        action: 'EMAIL_VERIFICATION_ISSUED',
        userId: user.id,
        email: user.email,
        ...requestMetadata,
        metadata: {
          reason: 'MANUAL_RESEND'
        }
      });

      return token;
    });

    const verificationUrl = buildAppUrl(`/verify-email?token=${rawToken}`, request);

    try {
      await sendEmailVerificationEmail({
        to: {
          email: user.email,
          name: user.name
        },
        verificationUrl,
        expiresAt
      });
    } catch (mailError) {
      console.error('Failed to resend verification email.', mailError);

      await prisma.emailVerificationToken.updateMany({
        where: {
          id: createdToken.id,
          userId: user.id,
          usedAt: null
        },
        data: {
          usedAt: new Date()
        }
      });

      return NextResponse.json(
        {
          error: 'Unable to resend the verification email right now. Please try again after checking your mail settings.'
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      emailSent: true,
      expiresAt: expiresAt.toISOString(),
      message: 'A fresh verification email has been sent.'
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to resend the verification email.' }, { status: 500 });
  }
}
