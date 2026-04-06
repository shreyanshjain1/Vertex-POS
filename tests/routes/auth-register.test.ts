import { beforeEach, describe, expect, it, vi } from 'vitest';

const isMailConfigured = vi.fn();
const sendEmailVerificationEmail = vi.fn();
const buildAppUrl = vi.fn();
const getRequestMetadata = vi.fn();
const logAuthAudit = vi.fn();
const findUnique = vi.fn();
const txUserCreate = vi.fn();
const txTokenCreate = vi.fn();
const txTokenDeleteMany = vi.fn();
const txUserDelete = vi.fn();
const transaction = vi.fn();
const hashPassword = vi.fn();
const createEmailVerificationToken = vi.fn();
const hashEmailVerificationToken = vi.fn();

vi.mock('@/lib/email', () => ({
  isMailConfigured,
  sendEmailVerificationEmail,
  buildAppUrl
}));

vi.mock('@/lib/auth/audit', () => ({
  getRequestMetadata,
  logAuthAudit
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique
    },
    $transaction: transaction
  }
}));

vi.mock('@/lib/auth/password', () => ({
  hashPassword
}));

vi.mock('@/lib/auth/email-verification', () => ({
  createEmailVerificationToken,
  hashEmailVerificationToken
}));

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    getRequestMetadata.mockReturnValue({ ipAddress: '127.0.0.1', userAgent: 'Vitest' });
    buildAppUrl.mockReturnValue('https://app.test/verify-email?token=verify-token');
    hashPassword.mockResolvedValue('hashed-password');
    createEmailVerificationToken.mockReturnValue('verify-token');
    hashEmailVerificationToken.mockReturnValue('verify-token-hash');
    sendEmailVerificationEmail.mockResolvedValue(undefined);
    logAuthAudit.mockResolvedValue(undefined);

    transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) =>
      callback({
        user: {
          create: txUserCreate,
          delete: txUserDelete
        },
        emailVerificationToken: {
          create: txTokenCreate,
          deleteMany: txTokenDeleteMany
        }
      })
    );

    txUserCreate.mockResolvedValue({
      id: 'user-1',
      email: 'new@example.com',
      name: 'New User'
    });
    txTokenCreate.mockResolvedValue({ id: 'verify-1' });
  });

  it('returns 503 when signup email delivery is not configured', async () => {
    isMailConfigured.mockReturnValue(false);

    const { POST } = await import('@/app/api/auth/register/route');
    const response = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'New User',
          email: 'new@example.com',
          password: 'strongpass123',
          confirmPassword: 'strongpass123'
        })
      })
    );

    expect(response.status).toBe(503);
  });

  it('returns 409 when the email already exists', async () => {
    isMailConfigured.mockReturnValue(true);
    findUnique.mockResolvedValue({ id: 'existing-1' });

    const { POST } = await import('@/app/api/auth/register/route');
    const response = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Existing User',
          email: 'existing@example.com',
          password: 'strongpass123',
          confirmPassword: 'strongpass123'
        })
      })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'An account with this email already exists.'
    });
  });

  it('creates the user and sends a verification email', async () => {
    isMailConfigured.mockReturnValue(true);
    findUnique.mockResolvedValue(null);

    const { POST } = await import('@/app/api/auth/register/route');
    const response = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'New User',
          email: 'new@example.com',
          password: 'strongpass123',
          confirmPassword: 'strongpass123'
        })
      })
    );

    expect(response.status).toBe(201);
    expect(txUserCreate).toHaveBeenCalled();
    expect(txTokenCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tokenHash: 'verify-token-hash'
        })
      })
    );
    expect(sendEmailVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: expect.objectContaining({ email: 'new@example.com' }),
        verificationUrl: 'https://app.test/verify-email?token=verify-token'
      })
    );
  });
});
