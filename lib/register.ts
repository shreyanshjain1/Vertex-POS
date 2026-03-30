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
  const baseSaleFilter = {
    shopId: session.shopId,
    cashierUserId: session.userId,
    status: 'COMPLETED' as const,
    createdAt: {
      gte: session.openedAt,
      lte: closingAt
    }
  };

  const [cashPayments, cashSalesWithChange, legacyCashSales, cashRefunds] = await Promise.all([
    db.salePayment.aggregate({
      where: {
        method: CASH_PAYMENT_METHOD,
        sale: baseSaleFilter
      },
      _sum: {
        amount: true
      }
    }),
    db.sale.aggregate({
      where: {
        ...baseSaleFilter,
        payments: {
          some: {
            method: CASH_PAYMENT_METHOD
          }
        }
      },
      _sum: {
        changeDue: true
      }
    }),
    db.sale.aggregate({
      where: {
        ...baseSaleFilter,
        paymentMethod: CASH_PAYMENT_METHOD,
        payments: {
          none: {}
        }
      },
      _sum: {
        totalAmount: true
      }
    }),
    db.refundPayment.aggregate({
      where: {
        method: CASH_PAYMENT_METHOD,
        saleAdjustment: {
          shopId: session.shopId,
          createdByUserId: session.userId,
          createdAt: {
            gte: session.openedAt,
            lte: closingAt
          }
        }
      },
      _sum: {
        amount: true
      }
    })
  ]);

  const openingFloat = Number(session.openingFloat);
  const cashReceivedTotal = Number(cashPayments._sum.amount ?? 0);
  const changeDueTotal = Number(cashSalesWithChange._sum.changeDue ?? 0);
  const legacyCashSalesTotal = Number(legacyCashSales._sum.totalAmount ?? 0);
  const cashRefundTotal = Number(cashRefunds._sum.amount ?? 0);

  return roundCurrency(
    openingFloat + cashReceivedTotal - changeDueTotal + legacyCashSalesTotal - cashRefundTotal
  );
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
