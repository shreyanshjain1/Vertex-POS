import { CashSession, CashSessionStatus, User } from '@prisma/client';

type CashSessionWithUser = CashSession & {
  user?: Pick<User, 'id' | 'name' | 'email'> | null;
};

export type SerializedCashSession = {
  id: string;
  shopId: string;
  userId: string;
  cashierName: string;
  cashierEmail: string | null;
  openedAt: string;
  openingFloat: string;
  closedAt: string | null;
  closingExpected: string | null;
  closingActual: string | null;
  variance: string | null;
  notes: string | null;
  status: CashSessionStatus;
};

export type SerializedActiveCashSession = SerializedCashSession & {
  expectedCash: string;
  canOverride: boolean;
};

export function serializeCashSession(session: CashSessionWithUser): SerializedCashSession {
  const cashierName =
    session.user?.name ??
    session.user?.email?.split('@')[0] ??
    'Cashier';

  return {
    id: session.id,
    shopId: session.shopId,
    userId: session.userId,
    cashierName,
    cashierEmail: session.user?.email ?? null,
    openedAt: session.openedAt.toISOString(),
    openingFloat: session.openingFloat.toString(),
    closedAt: session.closedAt?.toISOString() ?? null,
    closingExpected: session.closingExpected?.toString() ?? null,
    closingActual: session.closingActual?.toString() ?? null,
    variance: session.variance?.toString() ?? null,
    notes: session.notes ?? null,
    status: session.status
  };
}
