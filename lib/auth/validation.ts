import { z } from 'zod';

const shopRoleSchema = z.enum(['ADMIN', 'MANAGER', 'CASHIER']);
const optionalText = () => z.string().trim().optional().nullable();

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
  posType: z.enum(['RETAIL', 'COFFEE', 'FOOD', 'BUILDING_MATERIALS', 'SERVICES']),
  phone: optionalText(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  address: optionalText(),
  taxId: optionalText(),
  currencyCode: z.string().trim().min(3).max(3),
  currencySymbol: z.string().trim().min(1).max(5),
  taxRate: z.coerce.number().min(0).max(100),
  receiptHeader: optionalText(),
  receiptFooter: optionalText(),
  lowStockThreshold: z.coerce.number().int().min(0).max(9999),
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
    reorderPoint: z.coerce.number().int().min(0)
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
  sku: z.string().trim().max(50).optional().nullable(),
  barcode: z.string().trim().max(60).optional().nullable(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  cost: z.coerce.number().min(0),
  price: z.coerce.number().min(0),
  stockQty: z.coerce.number().int().min(0),
  reorderPoint: z.coerce.number().int().min(0),
  isActive: z.coerce.boolean().default(true)
});

export const productUpdateSchema = productSchema.partial().extend({
  id: z.string().trim().min(1)
});

export const inventoryAdjustmentSchema = z.object({
  productId: z.string().trim().min(1),
  qtyChange: z.coerce.number().int().refine((value) => value !== 0, 'Quantity change must not be zero'),
  notes: optionalText()
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

export const saleSchema = z.object({
  customerName: z.string().trim().max(120).optional().nullable(),
  customerPhone: z.string().trim().max(40).optional().nullable(),
  paymentMethod: z.enum(['Cash', 'Card', 'E-Wallet', 'Bank Transfer']),
  discountAmount: z.coerce.number().min(0).default(0),
  notes: z.string().trim().max(300).optional().nullable(),
  items: z.array(z.object({
    productId: z.string().trim().min(1),
    qty: z.coerce.number().int().positive()
  })).min(1)
});

export const purchaseSchema = z.object({
  supplierId: z.string().trim().min(1),
  status: z.enum(['DRAFT', 'RECEIVED', 'CANCELLED']).default('DRAFT'),
  notes: z.string().trim().max(300).optional().nullable(),
  items: z.array(z.object({
    productId: z.string().trim().min(1),
    qty: z.coerce.number().int().positive(),
    unitCost: z.coerce.number().min(0)
  })).min(1)
});

export const settingSchema = z.object({
  shopName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  address: z.string().trim().max(255).optional().nullable(),
  taxId: z.string().trim().max(60).optional().nullable(),
  currencyCode: z.string().trim().min(3).max(3),
  currencySymbol: z.string().trim().min(1).max(5),
  taxRate: z.coerce.number().min(0).max(100),
  receiptHeader: z.string().trim().max(255).optional().nullable(),
  receiptFooter: z.string().trim().max(255).optional().nullable(),
  receiptWidth: z.enum(['58mm', '80mm']),
  lowStockEnabled: z.coerce.boolean(),
  lowStockThreshold: z.coerce.number().int().min(0).max(9999),
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
  isActive: z.coerce.boolean()
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
  notes: z.string().trim().max(500).optional().nullable()
});
