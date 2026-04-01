import type { PaymentMethod } from '@/lib/payments';

export type OfflineQueuedSaleStatus = 'PENDING' | 'SYNCING' | 'CONFLICT' | 'ERROR';

export type OfflineSaleConflict = {
  type: 'INSUFFICIENT_STOCK' | 'PRICE_CHANGED' | 'PRODUCT_UNAVAILABLE';
  productId: string;
  variantId: string | null;
  productName: string;
  message: string;
  requestedQty?: number;
  availableQty?: number;
  queuedPrice?: number | null;
  currentPrice?: number | null;
};

export type OfflineReceiptPayment = {
  id: string;
  method: string;
  amount: string;
  referenceNumber: string | null;
  createdAt: string;
};

export type OfflineReceiptSale = {
  id: string;
  saleNumber: string;
  receiptNumber: string;
  paymentMethod: string;
  cashierName: string | null;
  customerEmail?: string | null;
  customerBusinessName?: string | null;
  customerName: string | null;
  customerPhone: string | null;
  isCreditSale: boolean;
  creditDueDate: string | null;
  loyaltyPointsEarned: number;
  loyaltyPointsRedeemed: number;
  loyaltyDiscountAmount: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  totalPaid: string;
  cashReceived: string;
  changeDue: string;
  notes: string | null;
  createdAt: string;
  payments: OfflineReceiptPayment[];
  items: Array<{
    id: string;
    productName: string;
    qty: number;
    unitPrice: string;
    lineTotal: string;
  }>;
};

export type OfflineQueuedSaleItem = {
  optionId: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantLabel: string | null;
  qty: number;
  priceSnapshot: number | null;
};

export type OfflineQueuedSalePayload = {
  clientRequestId: string;
  occurredAt: string;
  cashSessionId: string | null;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  loyaltyPointsToRedeem: number;
  isCreditSale: boolean;
  creditDueDate: string | null;
  discountAmount: number;
  notes: string | null;
  payments: Array<{
    method: PaymentMethod;
    amount: number;
    referenceNumber: string | null;
  }>;
  items: OfflineQueuedSaleItem[];
};

export type OfflineQueuedSale = {
  id: string;
  shopId: string;
  userId: string;
  localReceiptNumber: string;
  queuedAt: string;
  status: OfflineQueuedSaleStatus;
  payload: OfflineQueuedSalePayload;
  receipt: OfflineReceiptSale;
  conflicts: OfflineSaleConflict[];
  lastError: string | null;
};

export type OfflineCheckoutDraft = {
  version: 1;
  updatedAt: string;
  selectedCategory: string;
  query: string;
  cart: Array<{
    optionId: string;
    qty: number;
  }>;
  discountAmount: string;
  customerSearch: string;
  selectedCustomerId: string | null;
  customerName: string;
  customerPhone: string;
  loyaltyPointsToRedeem: string;
  isCreditSale: boolean;
  creditDueDate: string;
  notes: string;
  payments: Array<{
    id: string;
    method: PaymentMethod;
    amount: string;
    referenceNumber: string;
  }>;
};

const STORAGE_PREFIX = 'vertex-pos';

function pad(value: number) {
  return value.toString().padStart(2, '0');
}

function getTimestampParts(value = new Date()) {
  return {
    year: value.getFullYear(),
    month: pad(value.getMonth() + 1),
    day: pad(value.getDate()),
    hours: pad(value.getHours()),
    minutes: pad(value.getMinutes()),
    seconds: pad(value.getSeconds())
  };
}

function getRandomSuffix() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 8).toUpperCase();
  }

  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

export function buildOfflineCheckoutDraftStorageKey(shopId: string, userId: string) {
  return `${STORAGE_PREFIX}:checkout-draft:${shopId}:${userId}`;
}

export function buildOfflineSalesQueueStorageKey(shopId: string, userId: string) {
  return `${STORAGE_PREFIX}:sales-queue:${shopId}:${userId}`;
}

export function createOfflineReceiptNumber(value = new Date()) {
  const parts = getTimestampParts(value);
  return `OFF-${parts.year}${parts.month}${parts.day}-${parts.hours}${parts.minutes}${parts.seconds}-${getRandomSuffix()}`;
}

export function createOfflineClientRequestId(shopId: string, userId: string, value = new Date()) {
  const parts = getTimestampParts(value);
  const shopPart = shopId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase() || 'SHOP';
  const userPart = userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase() || 'USER';
  return `OFFSYNC-${shopPart}-${userPart}-${parts.year}${parts.month}${parts.day}${parts.hours}${parts.minutes}${parts.seconds}-${getRandomSuffix()}`;
}

export function getStockSnapshotAgeMinutes(capturedAt: string, now = Date.now()) {
  const parsed = new Date(capturedAt);
  if (Number.isNaN(parsed.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max((now - parsed.getTime()) / 60_000, 0);
}

export function readLocalStorageValue<T>(key: string, fallback: T) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeLocalStorageValue<T>(key: string, value: T) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function removeLocalStorageValue(key: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(key);
}
