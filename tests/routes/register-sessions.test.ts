import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireRole = vi.fn();
const apiErrorResponse = vi.fn();
const logActivity = vi.fn();
const getActiveCashSession = vi.fn();
const acquireCashSessionOpenLock = vi.fn();
const serializeCashSession = vi.fn();
const shopSettingFindUnique = vi.fn();
const transaction = vi.fn();
const txCashSessionCreate = vi.fn();

vi.mock('@/lib/authz', () => ({
  requireRole
}));

vi.mock('@/lib/api', () => ({
  apiErrorResponse
}));

vi.mock('@/lib/activity', () => ({
  logActivity
}));

vi.mock('@/lib/register', () => ({
  getActiveCashSession,
  acquireCashSessionOpenLock
}));

vi.mock('@/lib/serializers/register', () => ({
  serializeCashSession
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    shopSetting: {
      findUnique: shopSettingFindUnique
    },
    $transaction: transaction
  }
}));

describe('POST /api/register/sessions', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    requireRole.mockResolvedValue({
      shopId: 'shop-1',
      userId: 'user-1',
      session: {
        user: {
          name: 'Cashier One',
          email: 'cashier@example.com'
        }
      }
    });

    shopSettingFindUnique.mockResolvedValue({
      openingFloatRequired: true,
      openingFloatAmount: { toString: () => '500' }
    });

    transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) =>
      callback({
        cashSession: {
          create: txCashSessionCreate
        }
      })
    );

    txCashSessionCreate.mockResolvedValue({ id: 'session-1', status: 'OPEN' });
    serializeCashSession.mockReturnValue({ id: 'session-1', status: 'OPEN' });
    logActivity.mockResolvedValue(undefined);
    acquireCashSessionOpenLock.mockResolvedValue(undefined);
    apiErrorResponse.mockImplementation((_error: unknown, message: string) =>
      Response.json({ error: message }, { status: 500 })
    );
  });

  it('returns 409 when the cashier already has an active session', async () => {
    getActiveCashSession.mockResolvedValue({ id: 'existing-session' });

    const { POST } = await import('@/app/api/register/sessions/route');
    const response = await POST(
      new Request('http://localhost/api/register/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ openingFloat: 500, notes: 'start of day' })
      })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'You already have an active register session in this shop.'
    });
  });

  it('returns 400 when the opening float is below the branch minimum', async () => {
    getActiveCashSession.mockResolvedValue(null);

    const { POST } = await import('@/app/api/register/sessions/route');
    const response = await POST(
      new Request('http://localhost/api/register/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ openingFloat: 300, notes: 'short till' })
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Opening float must be at least 500 for this branch.'
    });
  });

  it('creates and serializes a new register session when validation passes', async () => {
    getActiveCashSession.mockResolvedValue(null);

    const { POST } = await import('@/app/api/register/sessions/route');
    const response = await POST(
      new Request('http://localhost/api/register/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ openingFloat: 500, notes: 'start of day' })
      })
    );

    expect(response.status).toBe(201);
    expect(acquireCashSessionOpenLock).toHaveBeenCalled();
    expect(txCashSessionCreate).toHaveBeenCalled();
    expect(serializeCashSession).toHaveBeenCalledWith({ id: 'session-1', status: 'OPEN' });
  });
});
