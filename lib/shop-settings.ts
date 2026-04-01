import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/payments';
import { roundCurrency } from '@/lib/inventory';

export const TAX_MODE_OPTIONS = ['EXCLUSIVE', 'INCLUSIVE', 'NON_TAXABLE'] as const;
export const PRINTER_CONNECTION_OPTIONS = ['USB', 'NETWORK', 'BLUETOOTH', 'MANUAL'] as const;
export const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'Card'];
export const DEFAULT_TIMEZONE = 'Asia/Manila';
export const DEFAULT_OFFLINE_STOCK_MAX_AGE_MINUTES = 240;
export const DEFAULT_REORDER_SAFETY_STOCK = 3;

export type TaxModeValue = (typeof TAX_MODE_OPTIONS)[number];
export type PrinterConnectionValue = (typeof PRINTER_CONNECTION_OPTIONS)[number];

export function sanitizeOfflineStockMaxAgeMinutes(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_OFFLINE_STOCK_MAX_AGE_MINUTES;
  }

  return Math.min(Math.max(Math.round(parsed), 5), 1440);
}

export function sanitizeReorderSafetyStock(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_REORDER_SAFETY_STOCK;
  }

  return Math.min(Math.max(Math.round(parsed), 0), 365);
}

export function sanitizeDefaultPaymentMethods(value: unknown) {
  if (!Array.isArray(value)) {
    return DEFAULT_PAYMENT_METHODS;
  }

  const methods = value.filter((entry): entry is PaymentMethod =>
    typeof entry === 'string' && PAYMENT_METHODS.includes(entry as PaymentMethod)
  );

  return [...new Set(methods)].length ? [...new Set(methods)] : DEFAULT_PAYMENT_METHODS;
}

export function getTaxModeLabel(value: TaxModeValue | string) {
  switch (value) {
    case 'INCLUSIVE':
      return 'Tax inclusive';
    case 'NON_TAXABLE':
      return 'Non-taxable';
    default:
      return 'Tax exclusive';
  }
}

export function getPrinterConnectionLabel(value: PrinterConnectionValue | string) {
  switch (value) {
    case 'NETWORK':
      return 'Network printer';
    case 'BLUETOOTH':
      return 'Bluetooth printer';
    case 'MANUAL':
      return 'Manual / browser print';
    default:
      return 'USB printer';
  }
}

export function calculateTaxBreakdown({
  subtotal,
  discountAmount,
  taxRate,
  taxMode
}: {
  subtotal: number;
  discountAmount: number;
  taxRate: number;
  taxMode: TaxModeValue | string;
}) {
  const roundedSubtotal = roundCurrency(subtotal);
  const roundedDiscount = roundCurrency(discountAmount);
  const taxableSubtotal = roundCurrency(Math.max(roundedSubtotal - roundedDiscount, 0));

  if (taxMode === 'NON_TAXABLE') {
    return {
      subtotal: roundedSubtotal,
      taxAmount: 0,
      totalAmount: taxableSubtotal
    };
  }

  if (taxMode === 'INCLUSIVE') {
    const divisor = 1 + taxRate / 100;
    const taxAmount = taxRate > 0 ? roundCurrency(taxableSubtotal - taxableSubtotal / divisor) : 0;
    return {
      subtotal: roundedSubtotal,
      taxAmount,
      totalAmount: taxableSubtotal
    };
  }

  const taxAmount = roundCurrency(roundedSubtotal * (taxRate / 100));
  return {
    subtotal: roundedSubtotal,
    taxAmount,
    totalAmount: roundCurrency(roundedSubtotal + taxAmount - roundedDiscount)
  };
}
