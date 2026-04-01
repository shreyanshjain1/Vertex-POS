import { CashMovementType, CashSession, CashSessionStatus, User } from '@prisma/client';
import {
  RegisterDenominationSnapshot,
  RegisterSessionSummary,
  RegisterTimelineEntry,
  normalizeDenominationSnapshot
} from '@/lib/register';

type CashSessionWithUsers = CashSession & {
  user?: Pick<User, 'id' | 'name' | 'email'> | null;
  closedByUser?: Pick<User, 'id' | 'name' | 'email'> | null;
  reviewedByUser?: Pick<User, 'id' | 'name' | 'email'> | null;
  reopenedByUser?: Pick<User, 'id' | 'name' | 'email'> | null;
};

export type SerializedRegisterTimelineEntry = {
  id: string;
  type: RegisterTimelineEntry['type'];
  label: string;
  occurredAt: string;
  amount: string;
  note: string | null;
  reference: string | null;
  userName: string | null;
};

export type SerializedCashMovementSummary = {
  id: string;
  type: CashMovementType;
  amount: string;
  note: string | null;
  createdAt: string;
  createdByName: string | null;
};

export type SerializedRegisterSessionSummary = {
  expectedCash: string;
  salesCount: number;
  grossSalesTotal: string;
  cashSalesTotal: string;
  refundCashTotal: string;
  paymentBreakdown: Array<{ method: string; amount: string }>;
  movementTotals: Record<CashMovementType, string>;
  movements: SerializedCashMovementSummary[];
  timeline: SerializedRegisterTimelineEntry[];
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
  closedByName: string | null;
  closingExpected: string | null;
  closingActual: string | null;
  variance: string | null;
  denominationBreakdown: RegisterDenominationSnapshot;
  reviewedAt: string | null;
  reviewedByName: string | null;
  reviewNote: string | null;
  reopenedAt: string | null;
  reopenedByName: string | null;
  reopenReason: string | null;
  notes: string | null;
  status: CashSessionStatus;
};

export type SerializedActiveCashSession = SerializedCashSession & {
  expectedCash: string;
  canOverride: boolean;
  canReview: boolean;
  canReopen: boolean;
  summary: SerializedRegisterSessionSummary;
};

function getDisplayName(user?: Pick<User, 'name' | 'email'> | null) {
  return user?.name ?? user?.email ?? null;
}

export function serializeRegisterSessionSummary(
  summary: RegisterSessionSummary
): SerializedRegisterSessionSummary {
  return {
    expectedCash: summary.expectedCash.toFixed(2),
    salesCount: summary.salesCount,
    grossSalesTotal: summary.grossSalesTotal.toFixed(2),
    cashSalesTotal: summary.cashSalesTotal.toFixed(2),
    refundCashTotal: summary.refundCashTotal.toFixed(2),
    paymentBreakdown: summary.paymentBreakdown.map((entry) => ({
      method: entry.method,
      amount: entry.amount.toFixed(2)
    })),
    movementTotals: {
      PAYOUT: summary.movementTotals.PAYOUT.toFixed(2),
      CASH_DROP: summary.movementTotals.CASH_DROP.toFixed(2),
      PETTY_CASH: summary.movementTotals.PETTY_CASH.toFixed(2),
      MANUAL_CORRECTION: summary.movementTotals.MANUAL_CORRECTION.toFixed(2)
    },
    movements: summary.movements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      amount: movement.amount.toFixed(2),
      note: movement.note,
      createdAt: movement.createdAt.toISOString(),
      createdByName: movement.createdByName
    })),
    timeline: summary.timeline.map((entry) => ({
      id: entry.id,
      type: entry.type,
      label: entry.label,
      occurredAt: entry.occurredAt.toISOString(),
      amount: entry.amount.toFixed(2),
      note: entry.note,
      reference: entry.reference,
      userName: entry.userName
    }))
  };
}

export function serializeCashSession(session: CashSessionWithUsers): SerializedCashSession {
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
    closedByName: getDisplayName(session.closedByUser),
    closingExpected: session.closingExpected?.toString() ?? null,
    closingActual: session.closingActual?.toString() ?? null,
    variance: session.variance?.toString() ?? null,
    denominationBreakdown: normalizeDenominationSnapshot(session.denominationBreakdown),
    reviewedAt: session.reviewedAt?.toISOString() ?? null,
    reviewedByName: getDisplayName(session.reviewedByUser),
    reviewNote: session.reviewNote ?? null,
    reopenedAt: session.reopenedAt?.toISOString() ?? null,
    reopenedByName: getDisplayName(session.reopenedByUser),
    reopenReason: session.reopenReason ?? null,
    notes: session.notes ?? null,
    status: session.status
  };
}
