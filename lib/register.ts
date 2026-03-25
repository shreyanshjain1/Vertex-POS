import { CashSession, CashSessionStatus, Prisma } from '@prisma/client';
import { roundCurrency } from '@/lib/inventory';
import { prisma } from '@/lib/prisma';

type RegisterDb = Prisma.TransactionClient | typeof prisma;

export const CASH_PAYMENT_METHOD = 'Cash';

export function isOpenCashSessionStatus(status: CashSessionStatus) {
  return status === 'OPEN';
}

export async function getActiveCashSession(db: RegisterDb, shopId: string, userId: string) {
  return db.cashSession.findFirst({
    where: {
      shopId,
      userId,
      status: 'OPEN'
    },
    orderBy: { openedAt: 'desc' }
  });
}

export async function getActiveCashSessionsForShop(db: RegisterDb, shopId: string) {
  return db.cashSession.findMany({
    where: {
      shopId,
      status: 'OPEN'
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    },
    orderBy: { openedAt: 'asc' }
  });
}

export async function computeClosingExpectedCash(
  db: RegisterDb,
  session: Pick<CashSession, 'shopId' | 'userId' | 'openedAt' | 'openingFloat'>,
  closingAt: Date
) {
  const cashSales = await db.sale.aggregate({
    where: {
      shopId: session.shopId,
      cashierUserId: session.userId,
      paymentMethod: CASH_PAYMENT_METHOD,
      status: 'COMPLETED',
      createdAt: {
        gte: session.openedAt,
        lte: closingAt
      }
    },
    _sum: {
      totalAmount: true
    }
  });

  const openingFloat = Number(session.openingFloat);
  const cashSalesTotal = Number(cashSales._sum.totalAmount ?? 0);
  return roundCurrency(openingFloat + cashSalesTotal);
}

export function appendRegisterNotes(
  existingNotes: string | null | undefined,
  nextNotes: string | null | undefined
) {
  const existing = existingNotes?.trim() ?? '';
  const next = nextNotes?.trim() ?? '';

  if (!existing) {
    return next || null;
  }

  if (!next) {
    return existing;
  }

  return `${existing}\n\n${next}`;
}
