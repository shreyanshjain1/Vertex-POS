import { roundCurrency } from '@/lib/inventory';

export const PAYMENT_METHODS = ['Cash', 'Card', 'E-Wallet', 'Bank Transfer'] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type PaymentInput = {
  method: PaymentMethod;
  amount: number;
  referenceNumber?: string | null;
};

export type PaymentSummary = {
  totalPaid: number;
  remainingAmount: number;
  changeDue: number;
  cashReceived: number;
  hasCashPayment: boolean;
};

export function requiresReferenceNumber(method: PaymentMethod) {
  return method === 'Card' || method === 'E-Wallet';
}

export function normalizePaymentInput(payment: PaymentInput): PaymentInput {
  const referenceNumber = payment.referenceNumber?.trim() ?? '';

  return {
    method: payment.method,
    amount: roundCurrency(Number(payment.amount ?? 0)),
    referenceNumber: referenceNumber || null
  };
}

export function getPaymentSummary(totalAmount: number, payments: PaymentInput[]): PaymentSummary {
  const normalizedPayments = payments.map(normalizePaymentInput);
  const totalPaid = roundCurrency(
    normalizedPayments.reduce((sum, payment) => sum + payment.amount, 0)
  );
  const cashReceived = roundCurrency(
    normalizedPayments
      .filter((payment) => payment.method === 'Cash')
      .reduce((sum, payment) => sum + payment.amount, 0)
  );
  const hasCashPayment = cashReceived > 0;
  const remainingAmount = roundCurrency(Math.max(totalAmount - totalPaid, 0));
  const changeDue = hasCashPayment
    ? roundCurrency(Math.max(totalPaid - totalAmount, 0))
    : 0;

  return {
    totalPaid,
    remainingAmount,
    changeDue,
    cashReceived,
    hasCashPayment
  };
}

export function validatePaymentsForSale(totalAmount: number, payments: PaymentInput[]) {
  const normalizedPayments = payments.map(normalizePaymentInput);

  if (!normalizedPayments.length) {
    return { ok: false as const, error: 'Add at least one payment line.' };
  }

  if (normalizedPayments.some((payment) => payment.amount <= 0)) {
    return { ok: false as const, error: 'Each payment amount must be greater than zero.' };
  }

  for (const payment of normalizedPayments) {
    if (requiresReferenceNumber(payment.method) && !payment.referenceNumber) {
      return {
        ok: false as const,
        error: `${payment.method} payments require a reference number.`
      };
    }
  }

  const summary = getPaymentSummary(totalAmount, normalizedPayments);
  const nonCashTotal = roundCurrency(
    normalizedPayments
      .filter((payment) => payment.method !== 'Cash')
      .reduce((sum, payment) => sum + payment.amount, 0)
  );

  if (summary.totalPaid < totalAmount) {
    return {
      ok: false as const,
      error: 'Total paid must cover the sale total before checkout can finish.'
    };
  }

  if (summary.hasCashPayment && nonCashTotal > totalAmount) {
    return {
      ok: false as const,
      error: 'Only cash can exceed the remaining amount when change is due.'
    };
  }

  if (!summary.hasCashPayment && summary.totalPaid !== totalAmount) {
    return {
      ok: false as const,
      error: 'Non-cash payments must match the sale total exactly.'
    };
  }

  return {
    ok: true as const,
    payments: normalizedPayments,
    summary
  };
}

export function getSalePaymentSummaryLabel(payments: Array<Pick<PaymentInput, 'method'>>) {
  const uniqueMethods = [...new Set(payments.map((payment) => payment.method))];
  return uniqueMethods.length === 1 ? uniqueMethods[0] : 'Split';
}

function roundUpToStep(amount: number, step: number) {
  return roundCurrency(Math.ceil(amount / step) * step);
}

export function getQuickCashAmounts(amountDue: number) {
  if (amountDue <= 0) {
    return [];
  }

  const exactAmount = roundCurrency(amountDue);
  const candidates = [
    exactAmount,
    roundUpToStep(amountDue, 20),
    roundUpToStep(amountDue, 50),
    roundUpToStep(amountDue, 100),
    roundUpToStep(amountDue, 200),
    roundUpToStep(amountDue, 500),
    roundUpToStep(amountDue, 1000)
  ];

  return [...new Set(candidates)].sort((left, right) => left - right);
}
