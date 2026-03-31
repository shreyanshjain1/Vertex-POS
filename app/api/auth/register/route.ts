import { NextResponse } from 'next/server';
import { getRequestMetadata, logAuthAudit } from '@/lib/auth/audit';
import { createEmailVerificationToken, hashEmailVerificationToken } from '@/lib/auth/email-verification';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { registerSchema } from '@/lib/auth/validation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid registration data' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
    if (existing) return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });

    const verificationToken = createEmailVerificationToken();
    const verificationHash = hashEmailVerificationToken(verificationToken);
    const requestMetadata = getRequestMetadata(request);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          passwordHash: await hashPassword(parsed.data.password)
        },
        select: { id: true, email: true, name: true }
      });

      await tx.emailVerificationToken.create({
        data: {
          userId: createdUser.id,
          tokenHash: verificationHash,
          expiresAt
        }
      });

      await logAuthAudit({
        tx,
        action: 'EMAIL_VERIFICATION_ISSUED',
        userId: createdUser.id,
        email: createdUser.email,
        ...requestMetadata
      });

      return createdUser;
    });

    const verificationUrl = new URL('/verify-email', request.url);
    verificationUrl.searchParams.set('token', verificationToken);

    return NextResponse.json(
      {
        ok: true,
        user,
        verificationUrl: verificationUrl.toString(),
        expiresAt: expiresAt.toISOString()
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to create account.' }, { status: 500 });
  }
}
