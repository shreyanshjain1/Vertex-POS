import { beforeEach, describe, expect, it, vi } from 'vitest';

const isMailConfigured = vi.fn();
const buildAppUrl = vi.fn();
const sendPasswordResetEmail = vi.fn();
const findUnique = vi.fn();
const txUpdateMany = vi.fn();
const txCreate = vi.fn();
const txUserUpdate = vi.fn();
const transaction = vi.fn();
const logAuthAudit = vi.fn();
const createPasswordResetToken = vi.fn();
const hashPasswordResetToken = vi.fn();

vi.mock('@/lib/email', () => ({
  isMailConfigured,
  buildAppUrl,
  sendPasswordResetEmail
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique
    },
    $transaction: transaction
  }
}));

vi.mock('@/lib/auth/audit', () => ({
  logAuthAudit
}));

vi.mock('@/lib/auth/password-reset', () => ({
  createPasswordResetToken,
  hashPasswordResetToken
}));

describe('POST /api/auth/request-password-reset', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    buildAppUrl.mockReturnValue('https://app.test/reset-password?token=raw-token');
    createPasswordResetToken.mockReturnValue('raw-token');
    hashPasswordResetToken.mockReturnValue('hashed-token');

    transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) =>
      callback({
        passwordResetToken: {
          updateMany: txUpdateMany,
          create: txCreate
        },
        user: {
          update: txUserUpdate
        }
      })
    );

    txCreate.mockResolvedValue({ id: 'reset-token-1' });
    txUpdateMany.mockResolvedValue({ count: 1 });
    txUserUpdate.mockResolvedValue({ id: 'user-1' });
    logAuthAudit.mockResolvedValue(undefined);
    sendPasswordResetEmail.mockResolvedValue(undefined);
  });

  it('returns 503 when mail delivery is not configured', async () => {
    isMailConfigured.mockReturnValue(false);

    const { POST } = await import('@/app/api/auth/request-password-reset/route');
    const response = await POST(
      new Request('http://localhost/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'cashier@example.com' })
      })
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('Email delivery is not configured yet')
      })
    );
  });

  it('returns the generic success payload when the user does not exist', async () => {
    isMailConfigured.mockReturnValue(true);
    findUnique.mockResolvedValue(null);

    const { POST } = await import('@/app/api/auth/request-password-reset/route');
    const response = await POST(
      new Request('http://localhost/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'missing@example.com' })
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      message: 'If the email exists in the system, a password reset link has been sent.'
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('creates a reset token and sends an email for an existing user', async () => {
    isMailConfigured.mockReturnValue(true);
    findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Cashier One',
      email: 'cashier@example.com',
      forcePasswordReset: false,
      failedLoginAttempts: 2,
      lockedUntil: null
    });

    const { POST } = await import('@/app/api/auth/request-password-reset/route');
    const response = await POST(
      new Request('http://localhost/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'cashier@example.com' })
      })
    );

    expect(response.status).toBe(200);
    expect(txCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          tokenHash: 'hashed-token'
        })
      })
    );
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: expect.objectContaining({ email: 'cashier@example.com' }),
        resetUrl: 'https://app.test/reset-password?token=raw-token'
      })
    );
  });
});
