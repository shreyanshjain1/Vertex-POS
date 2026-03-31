import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type AuthAuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGIN_BLOCKED_INACTIVE'
  | 'LOGIN_BLOCKED_LOCKED'
  | 'LOGIN_BLOCKED_UNVERIFIED'
  | 'LOGIN_BLOCKED_PASSWORD_RESET_REQUIRED'
  | 'LOGOUT'
  | 'PASSWORD_RESET_ISSUED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'EMAIL_VERIFICATION_ISSUED'
  | 'EMAIL_VERIFIED';

type RequestMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type AuthAuditInput = RequestMetadata & {
  tx?: Prisma.TransactionClient;
  action: AuthAuditAction;
  userId?: string | null;
  shopId?: string | null;
  email?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

function getClientIp(forwardedFor: string | null, realIp: string | null) {
  const forwarded = forwardedFor?.split(',')[0]?.trim();
  return forwarded || realIp?.trim() || null;
}

export function getRequestMetadata(request?: Request | null): RequestMetadata {
  if (!request) {
    return {};
  }

  return {
    ipAddress: getClientIp(
      request.headers.get('x-forwarded-for'),
      request.headers.get('x-real-ip')
    ),
    userAgent: request.headers.get('user-agent')
  };
}

export async function logAuthAudit(input: AuthAuditInput) {
  const db = input.tx ?? prisma;

  return db.authAuditLog.create({
    data: {
      action: input.action,
      userId: input.userId ?? null,
      shopId: input.shopId ?? null,
      email: input.email ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata ?? undefined
    }
  });
}
