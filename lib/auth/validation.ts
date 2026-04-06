import { z } from 'zod';
import { PAYMENT_METHODS } from '@/lib/payments';
import { PERMISSION_KEYS } from '@/lib/permissions';
import { CREATE_PURCHASE_STATUS_OPTIONS, MANUAL_PURCHASE_STATUS_OPTIONS } from '@/lib/purchases';
import { SHOP_TYPE_OPTIONS } from '@/lib/shop-config';
import {
  DEFAULT_PAYMENT_METHODS,
  PRINTER_CONNECTION_OPTIONS,
  TAX_MODE_OPTIONS
} from '@/lib/shop-settings';
import {
  SUPPLIER_CREDIT_MEMO_STATUS_OPTIONS,
  SUPPLIER_RETURN_CREATE_STATUS_OPTIONS,
  SUPPLIER_RETURN_DISPOSITION_OPTIONS,
  SUPPLIER_RETURN_REASON_OPTIONS
} from '@/lib/supplier-returns';
import {
  CUSTOMER_TYPE_OPTIONS
} from '@/lib/customers';

const shopRoleSchema = z.enum(['ADMIN', 'MANAGER', 'CASHIER']);
const permissionSchema = z.enum(PERMISSION_KEYS);
const optionalText = () => z.string().trim().optional().nullable();
const shopTypeSchema = z.enum(SHOP_TYPE_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const paymentMethodSchema = z.enum(PAYMENT_METHODS);
const imageUrlSchema = z
  .string()
  .trim()
  .min(1, 'Image is required.')
  .max(2048, 'Image path is too long.')
  .refine(
    (value) =>
      value.startsWith('/uploads/products/') ||
      value.startsWith('data:image/') ||
      /^https?:\/\//i.test(value),
    'Use an uploaded image path or a valid image URL.'
  );

const productVariantSchema = z.object({
  color: optionalText(),
  size: optionalText(),
  flavor: optionalText(),
  model: optionalText(),
  sku: z.string().trim().max(50).optional().nullable(),
  barcode: z.string().trim().max(60).optional().nullable(),
  priceOverride: z.coerce.number().min(0).optional().nullable(),
  costOverride: z.coerce.number().min(0).optional().nullable(),
  isActive: z.coerce.boolean().default(true)
}).refine(
  (input) => Boolean(input.color || input.size || input.flavor || input.model || input.sku || input.barcode),
  'Add at least one variant identifier.'
);

const productImageSchema = z.object({
  imageUrl: imageUrlSchema,
  altText: z.string().trim().max(120).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0)
});

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email').transform((value) => value.toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().email('Enter a valid email').transform((value) => value.toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
  confirmPassword: z.string().min(8, 'Confirm your password')
}).refine((input) => input.password === input.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Passwords do not match'
});

export const onboardSchema = z.object({
  shopName: z.string().trim().min(2).max(120),
  legalBusinessName: z.string().trim().min(2).max(160),
  posType: shopTypeSchema,
  phone: optionalText(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  address: optionalText(),
  taxId: optionalText(),
  timezone: z.string().trim().min(2).max(80),
  currencyCode: z.string().trim().min(3).max(3),
  currencySymbol: z.string().trim().min(1).max(5),
  taxMode: z.enum(TAX_MODE_OPTIONS).default('EXCLUSIVE'),
  taxRate: z.coerce.number().min(0).max(100),
  receiptHeader: optionalText(),
  receiptFooter: optionalText(),
  receiptWidth: z.enum(['58mm', '80mm']).default('80mm'),
  lowStockThreshold: z.coerce.number().int().min(0).max(9999),
  defaultPaymentMethods: z.array(paymentMethodSchema).min(1).default(DEFAULT_PAYMENT_METHODS),
  openingFloatRequired: z.coerce.boolean().default(true),
  openingFloatAmount: z.coerce.number().min(0).max(999999.99).default(0),
  printerName: optionalText(),
  printerConnection: z.enum(PRINTER_CONNECTION_OPTIONS).default('MANUAL'),
  barcodeScannerNotes: z.string().trim().max(500).optional().nullable(),
  categories: z.array(z.object({ name: z.string().trim().min(2).max(60) })).default([]),
  suppliers: z.array(z.object({
    name: z.string().trim().min(2).max(120),
    contactName: optionalText(),
    phone: z.string().trim().max(40).optional().nullable()
  })).default([]),
  products: z.array(z.object({
    name: z.string().trim().min(2).max(120),
    categoryName: optionalText(),
    sku: z.string().trim().max(50).optional().nullable(),
    barcode: z.string().trim().max(60).optional().nullable(),
    cost: z.coerce.number().min(0),
    price: z.coerce.number().min(0),
    stockQty: z.coerce.number().int().min(0),
    reorderPoint: z.coerce.number().int().min(0),
    trackBatches: z.coerce.boolean().optional().default(false),
    trackExpiry: z.coerce.boolean().optional().default(false)
  })).default([])
});

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  parentId: optionalText()
});

export const categoryUpdateSchema = categoryCreateSchema.extend({
  isActive: z.coerce.boolean().optional()
});

export const productSchema = z.object({
  categoryId: optionalText(),
  baseUnitOfMeasureId: z.string().trim().min(1, 'Select a base unit.'),
  sku: z.string().trim().max(50).optional().nullable(),
  barcode: z.string().trim().max(60).optional().nullable(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  cost: z.coerce.number().min(0),
  price: z.coerce.number().min(0),
  stockQty: z.coerce.number().int().min(0),
  reorderPoint: z.coerce.number().int().min(0),
  trackBatches: z.coerce.boolean().default(false),
  trackExpiry: z.coerce.boolean().default(false),
  changeNote: z.string().trim().max(300).optional().nullable(),
  uomConversions: z.array(z.object({
    unitOfMeasureId: z.string().trim().min(1),
    ratioToBase: z.coerce.number().int().positive('Pack conversion must be greater than zero.')
  })).default([]),
  variants: z.array(productVariantSchema).default([]),
  images: z.array(productImageSchema).max(6).default([]),
  isActive: z.coerce.boolean().default(true)
});

export const productUpdateSchema = productSchema.partial().extend({
  id: z.string().trim().min(1)
});

export const inventoryAdjustmentSchema = z.object({
  productId: z.string().trim().min(1),
  reasonId: z.string().trim().min(1, 'Select an adjustment reason.'),
  qtyChange: z.coerce.number().int().refine((value) => value !== 0, 'Quantity change must not be zero'),
  notes: optionalText()
});

export const productBatchSchema = z.object({
  lotNumber: z.string().trim().min(2, 'Lot number is required.').max(80),
  expiryDate: z.string().trim().optional().nullable().or(z.literal('')),
  quantity: z.coerce.number().int().min(0),
  notes: z.string().trim().max(300).optional().nullable()
});

export const stockCountCreateSchema = z.object({
  title: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  isBlind: z.coerce.boolean().default(false)
});

export const stockCountUpdateSchema = z.object({
  action: z.enum(['SAVE', 'SUBMIT', 'APPROVE', 'POST', 'CANCEL']),
  notes: z.string().trim().max(500).optional().nullable(),
  items: z.array(z.object({
    id: z.string().trim().min(1),
    actualQty: z.coerce.number().int().min(0).nullable(),
    note: z.string().trim().max(300).optional().nullable()
  })).optional().default([])
});

export const supplierSchema = z.object({
  name: z.string().trim().min(2).max(120),
  contactName: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  phone: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  isActive: z.coerce.boolean().optional().default(true)
});

export const customerSchema = z.object({
  type: z.enum(CUSTOMER_TYPE_OPTIONS).default('INDIVIDUAL'),
  firstName: z.string().trim().max(80).optional().nullable(),
  lastName: z.string().trim().max(80).optional().nullable(),
  businessName: z.string().trim().max(160).optional().nullable(),
  contactPerson: z.string().trim().max(120).optional().nullable(),
  taxId: z.string().trim().max(80).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  address: z.string().trim().max(255).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  isActive: z.coerce.boolean().optional().default(true)
}).superRefine((input, ctx) => {
  if (input.type === 'BUSINESS') {
    if (!input.businessName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['businessName'],
        message: 'Business customers need a business name.'
      });
    }
    return;
  }

  if (!input.firstName?.trim() && !input.lastName?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['firstName'],
      message: 'Enter at least a first name or last name.'
    });
  }
});

export const supplierReturnSchema = z.object({
  supplierId: z.string().trim().min(1),
  status: z.enum(SUPPLIER_RETURN_CREATE_STATUS_OPTIONS).default('DRAFT'),
  reasonSummary: z.string().trim().min(3, 'Return summary is required.').max(160),
  notes: z.string().trim().max(500).optional().nullable(),
  creditMemoNumber: z.string().trim().max(80).optional().nullable(),
  creditMemoDate: z.string().trim().optional().nullable().or(z.literal('')),
  creditAmount: z.coerce.number().min(0).max(999999.99).default(0),
  creditMemoStatus: z.enum(SUPPLIER_CREDIT_MEMO_STATUS_OPTIONS).default('PENDING'),
  items: z.array(z.object({
    productId: z.string().trim().min(1),
    qty: z.coerce.number().int().positive('Return quantity must be greater than zero.'),
    unitCost: z.coerce.number().min(0).max(999999.99),
    reason: z.enum(SUPPLIER_RETURN_REASON_OPTIONS),
    disposition: z.enum(SUPPLIER_RETURN_DISPOSITION_OPTIONS)
  })).min(1, 'Add at least one return line.')
});

export const supplierReturnPostSchema = z.object({
  action: z.literal('POST')
});

export const supplierReturnCancelSchema = z.object({
  action: z.literal('CANCEL')
});

export const supplierReturnCreditSchema = z.object({
  action: z.literal('UPDATE_CREDIT'),
  creditMemoNumber: z.string().trim().max(80).optional().nullable(),
  creditMemoDate: z.string().trim().optional().nullable().or(z.literal('')),
  creditAmount: z.coerce.number().min(0).max(999999.99).default(0),
  creditMemoStatus: z.enum(SUPPLIER_CREDIT_MEMO_STATUS_OPTIONS).default('PENDING'),
  notes: z.string().trim().max(500).optional().nullable()
});

export const salePaymentSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  amount: z.coerce.number().positive('Payment amount must be greater than zero.').max(999999.99),
  referenceNumber: z.string().trim().max(80).optional().nullable()
});

export const saleSchema = z.object({
  clientRequestId: z.string().trim().min(12).max(80).optional().nullable(),
  occurredAt: z.string().trim().optional().nullable().or(z.literal('')),
  cashSessionId: z.string().trim().optional().nullable(),
  customerId: z.string().trim().optional().nullable(),
  customerName: z.string().trim().max(120).optional().nullable(),
  customerPhone: z.string().trim().max(40).optional().nullable(),
  loyaltyPointsToRedeem: z.coerce.number().int().min(0).max(999999).default(0),
  isCreditSale: z.coerce.boolean().default(false),
  creditDueDate: z.string().trim().optional().nullable().or(z.literal('')),
  discountAmount: z.coerce.number().min(0).default(0),
  notes: z.string().trim().max(300).optional().nullable(),
  payments: z.array(salePaymentSchema).default([]),
  items: z.array(z.object({
    productId: z.string().trim().min(1),
    variantId: z.string().trim().min(1).optional().nullable(),
    priceSnapshot: z.coerce.number().min(0).optional().nullable(),
    qty: z.coerce.number().int().positive()
  })).min(1)
}).superRefine((input, ctx) => {
  if (input.isCreditSale) {
    if (!input.customerId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customerId'],
        message: 'Credit sales require an attached customer.'
      });
    }

    if (!input.creditDueDate || !input.creditDueDate.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['creditDueDate'],
        message: 'Credit sales require a due date.'
      });
    }

    if (input.payments.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['payments'],
        message: 'Credit sales should not include checkout payment lines.'
      });
    }
  }

  if (input.loyaltyPointsToRedeem > 0 && !input.customerId?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['customerId'],
      message: 'Attach a customer before redeeming loyalty points.'
    });
  }
});

const approvalSchema = z.object({
  approverEmail: z.string().trim().email('Enter a valid approver email.').transform((value) => value.toLowerCase()),
  approverPassword: z.string().min(1, 'Approver password is required.').max(72)
});

const saleAdjustmentReturnItemSchema = z.object({
  saleItemId: z.string().trim().min(1),
  qty: z.coerce.number().int().positive(),
  disposition: z.enum(['RESTOCK', 'DAMAGED'])
});

const saleAdjustmentReplacementItemSchema = z.object({
  productId: z.string().trim().min(1),
  qty: z.coerce.number().int().positive()
});

export const saleVoidSchema = approvalSchema.extend({
  reason: z.string().trim().min(3, 'Refund reason is required.').max(300),
  notes: z.string().trim().max(300).optional().nullable(),
  refundPayments: z.array(salePaymentSchema).min(1, 'Add at least one refund payment line.')
});

export const saleRefundSchema = approvalSchema.extend({
  type: z.enum(['REFUND', 'EXCHANGE']).default('REFUND'),
  reason: z.string().trim().min(3, 'Refund reason is required.').max(300),
  notes: z.string().trim().max(300).optional().nullable(),
  items: z.array(saleAdjustmentReturnItemSchema).min(1, 'Select at least one returned item.'),
  replacementItems: z.array(saleAdjustmentReplacementItemSchema).optional().default([]),
  refundPayments: z.array(salePaymentSchema).optional().default([]),
  exchangePayments: z.array(salePaymentSchema).optional().default([])
});

export const parkedSaleCreateSchema = z.object({
  customerId: z.string().trim().optional().nullable(),
  customerName: z.string().trim().max(120).optional().nullable(),
  customerPhone: z.string().trim().max(40).optional().nullable(),
  discountAmount: z.coerce.number().min(0).default(0),
  notes: z.string().trim().max(300).optional().nullable(),
  items: z.array(z.object({
    productId: z.string().trim().min(1),
    variantId: z.string().trim().min(1).optional().nullable(),
    qty: z.coerce.number().int().positive()
  })).min(1, 'Add at least one item before holding the cart.')
});

export const receivablePaymentSchema = z.object({
  action: z.literal('RECORD_PAYMENT'),
  customerCreditLedgerId: z.string().trim().min(1),
  amount: z.coerce.number().positive('Payment amount must be greater than zero.').max(999999.99),
  method: z.enum(PAYMENT_METHODS),
  referenceNumber: z.string().trim().max(80).optional().nullable(),
  paidAt: z.string().trim().min(1, 'Payment date is required.')
});

export const purchaseSchema = z.object({
  supplierId: z.string().trim().min(1),
  status: z.enum(CREATE_PURCHASE_STATUS_OPTIONS).default('DRAFT'),
  notes: z.string().trim().max(300).optional().nullable(),
  items: z.array(z.object({
    productId: z.string().trim().min(1),
    unitOfMeasureId: z.string().trim().min(1, 'Select a purchase unit.'),
    qty: z.coerce.number().int().positive(),
    unitCost: z.coerce.number().min(0)
  })).min(1)
});

export const stockTransferSchema = z.object({
  toShopId: z.string().trim().min(1, 'Select a destination branch.'),
  notes: z.string().trim().max(500).optional().nullable(),
  items: z.array(z.object({
    fromProductId: z.string().trim().min(1),
    toProductId: z.string().trim().min(1),
    qty: z.coerce.number().int().positive('Transfer quantity must be greater than zero.')
  })).min(1, 'Add at least one transfer line.')
});

export const stockTransferActionSchema = z.object({
  action: z.enum(['SEND', 'RECEIVE', 'CANCEL'])
});

export const purchaseStatusUpdateSchema = z.object({
  action: z.literal('UPDATE_STATUS'),
  status: z.enum(MANUAL_PURCHASE_STATUS_OPTIONS),
  notes: z.string().trim().max(300).optional().nullable()
});

export const purchaseReceiptSchema = z.object({
  action: z.literal('RECEIVE'),
  receivedAt: z.string().trim().optional().nullable().or(z.literal('')),
  notes: z.string().trim().max(300).optional().nullable(),
  items: z.array(z.object({
    purchaseItemId: z.string().trim().min(1),
    qtyReceived: z.coerce.number().int().positive('Received quantity must be greater than zero.')
  })).min(1, 'Add at least one received item.')
});

export const supplierInvoiceSchema = z.object({
  action: z.literal('UPSERT_INVOICE'),
  invoiceNumber: z.string().trim().min(1, 'Invoice number is required.').max(80),
  invoiceDate: z.string().trim().min(1, 'Invoice date is required.'),
  dueDate: z.string().trim().min(1, 'Due date is required.'),
  totalAmount: z.coerce.number().positive('Invoice total must be greater than zero.').max(999999.99),
  notes: z.string().trim().max(500).optional().nullable()
});

export const supplierPaymentSchema = z.object({
  action: z.literal('RECORD_PAYMENT'),
  method: z.enum(PAYMENT_METHODS),
  amount: z.coerce.number().positive('Payment amount must be greater than zero.').max(999999.99),
  referenceNumber: z.string().trim().max(80).optional().nullable(),
  paidAt: z.string().trim().min(1, 'Payment date is required.')
});

export const settingSchema = z.object({
  shopName: z.string().trim().min(2).max(120),
  legalBusinessName: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  address: z.string().trim().max(255).optional().nullable(),
  taxId: z.string().trim().max(60).optional().nullable(),
  timezone: z.string().trim().min(2).max(80),
  currencyCode: z.string().trim().min(3).max(3),
  currencySymbol: z.string().trim().min(1).max(5),
  taxMode: z.enum(TAX_MODE_OPTIONS).default('EXCLUSIVE'),
  taxRate: z.coerce.number().min(0).max(100),
  receiptHeader: z.string().trim().max(255).optional().nullable(),
  receiptFooter: z.string().trim().max(255).optional().nullable(),
  receiptWidth: z.enum(['58mm', '80mm']),
  receiptShowBrandMark: z.coerce.boolean().default(false),
  printerSafeMode: z.coerce.boolean().default(true),
  defaultPaymentMethods: z.array(paymentMethodSchema).min(1).default(DEFAULT_PAYMENT_METHODS),
  printerName: z.string().trim().max(120).optional().nullable(),
  printerConnection: z.enum(PRINTER_CONNECTION_OPTIONS).default('MANUAL'),
  cashDrawerKickEnabled: z.coerce.boolean().default(false),
  barcodeScannerNotes: z.string().trim().max(500).optional().nullable(),
  lowStockEnabled: z.coerce.boolean(),
  lowStockThreshold: z.coerce.number().int().min(0).max(9999),
  reorderSafetyStock: z.coerce.number().int().min(0).max(365).default(3),
  offlineStockStrict: z.coerce.boolean().default(false),
  offlineStockMaxAgeMinutes: z.coerce.number().int().min(5).max(1440).default(240),
  openingFloatRequired: z.coerce.boolean(),
  openingFloatAmount: z.coerce.number().min(0).max(999999.99),
  salePrefix: z.string().trim().min(2).max(10).regex(/^[A-Za-z0-9]+$/, 'Use letters or numbers only for the sale prefix'),
  receiptPrefix: z.string().trim().min(2).max(10).regex(/^[A-Za-z0-9]+$/, 'Use letters or numbers only for the receipt prefix'),
  purchasePrefix: z.string().trim().min(2).max(10).regex(/^[A-Za-z0-9]+$/, 'Use letters or numbers only for the purchase prefix')
});

export const staffCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(72),
  role: shopRoleSchema,
  shopId: z.string().trim().min(1)
});

export const staffUpdateSchema = z.object({
  role: shopRoleSchema,
  shopId: z.string().trim().min(1),
  isActive: z.coerce.boolean(),
  customPermissions: z.array(permissionSchema).optional().default([])
});

export const staffPinSchema = z.object({
  pin: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, 'PIN must be 4 to 8 digits.')
    .nullable()
});

export const passwordResetGenerateSchema = z.object({
  expiresInHours: z.coerce.number().int().min(1).max(72).default(24)
});

export const passwordResetConsumeSchema = z.object({
  token: z.string().trim().min(20, 'Reset token is required.'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
  confirmPassword: z.string().min(8, 'Confirm your password')
}).refine((input) => input.password === input.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Passwords do not match'
});

export const cashSessionOpenSchema = z.object({
  openingFloat: z.coerce.number().min(0, 'Opening float must be zero or greater.').max(999999.99),
  notes: z.string().trim().max(500).optional().nullable()
});

export const cashSessionCloseSchema = z.object({
  closingActual: z.coerce.number().min(0, 'Actual counted cash must be zero or greater.').max(999999.99),
  denominationBreakdown: z.record(z.string(), z.coerce.number().int().min(0).max(9999)).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable()
});

export const cashMovementSchema = z.object({
  type: z.enum(['PAYOUT', 'CASH_DROP', 'PETTY_CASH', 'MANUAL_CORRECTION']),
  amount: z.coerce.number().positive('Cash movement amount must be greater than zero.').max(999999.99),
  note: z.string().trim().min(3, 'Add a short note for the cash movement.').max(300)
});

export const cashSessionReviewSchema = z.object({
  reviewNote: z.string().trim().max(500).optional().nullable()
});

export const cashSessionReopenSchema = z.object({
  reason: z.string().trim().min(3, 'Reopen reason is required.').max(500)
});
