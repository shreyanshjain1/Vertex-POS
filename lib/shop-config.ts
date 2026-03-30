export const SHOP_TYPE_OPTIONS = [
  {
    value: 'GENERAL_RETAIL',
    label: 'General Retail',
    description: 'Simple stock controls with optional batch and expiry tracking.'
  },
  {
    value: 'GROCERY_CONVENIENCE',
    label: 'Grocery / Convenience',
    description: 'Expiry-aware stock with FEFO cues for fast-moving shelf items.'
  },
  {
    value: 'PHARMACY',
    label: 'Pharmacy',
    description: 'Batch and expiry tracking with longer safety windows for near-expiry alerts.'
  },
  {
    value: 'FOOD_BEVERAGE',
    label: 'Food / Beverage',
    description: 'Expiry tracking and FEFO support for consumables and prepared goods.'
  },
  {
    value: 'COSMETICS_BEAUTY',
    label: 'Cosmetics / Beauty',
    description: 'Lot and expiry tracking for shelf-life-sensitive beauty products.'
  },
  {
    value: 'MEDICAL_SUPPLIES',
    label: 'Medical Supplies',
    description: 'Expiry-aware inventory with batch support for clinical stock.'
  },
  {
    value: 'HARDWARE',
    label: 'Hardware',
    description: 'Straightforward stock controls with simpler defaults and optional tracking.'
  }
] as const;

export type SupportedShopType = (typeof SHOP_TYPE_OPTIONS)[number]['value'];

type StarterProduct = {
  name: string;
  categoryName: string;
  sku: string;
  barcode: string;
  cost: number;
  price: number;
  stockQty: number;
  reorderPoint: number;
  trackBatches: boolean;
  trackExpiry: boolean;
};

type ShopTypeDefaults = {
  lowStockThreshold: number;
  batchTrackingEnabled: boolean;
  expiryTrackingEnabled: boolean;
  fefoEnabled: boolean;
  expiryAlertDays: number;
  starterCategories: string[];
  starterSuppliers: Array<{
    name: string;
    contactName: string;
    phone: string;
  }>;
  starterProducts: StarterProduct[];
  hints: string[];
};

export const INVENTORY_REASON_PRESETS = [
  { code: 'DAMAGED', label: 'Damaged' },
  { code: 'EXPIRED', label: 'Expired' },
  { code: 'LOST', label: 'Lost' },
  { code: 'SHRINKAGE', label: 'Shrinkage' },
  { code: 'OPENING_BALANCE_CORRECTION', label: 'Opening balance correction' },
  { code: 'SUPPLIER_RETURN', label: 'Supplier return' },
  { code: 'INTERNAL_USE', label: 'Internal use' }
] as const;

const SHOP_TYPE_DEFAULTS: Record<SupportedShopType, ShopTypeDefaults> = {
  GENERAL_RETAIL: {
    lowStockThreshold: 5,
    batchTrackingEnabled: false,
    expiryTrackingEnabled: false,
    fefoEnabled: false,
    expiryAlertDays: 30,
    starterCategories: ['General Merchandise', 'Household', 'Accessories'],
    starterSuppliers: [{ name: 'Main Trade Supplier', contactName: '', phone: '' }],
    starterProducts: [
      {
        name: 'Everyday Tote Bag',
        categoryName: 'Accessories',
        sku: 'RET-001',
        barcode: '',
        cost: 80,
        price: 149,
        stockQty: 18,
        reorderPoint: 4,
        trackBatches: false,
        trackExpiry: false
      }
    ],
    hints: [
      'Batch and expiry tracking start optional so the catalog stays simple.',
      'Reason-coded adjustments help explain losses, damage, and internal use clearly.'
    ]
  },
  GROCERY_CONVENIENCE: {
    lowStockThreshold: 10,
    batchTrackingEnabled: true,
    expiryTrackingEnabled: true,
    fefoEnabled: true,
    expiryAlertDays: 14,
    starterCategories: ['Beverages', 'Snacks', 'Pantry'],
    starterSuppliers: [{ name: 'Neighborhood Distributor', contactName: '', phone: '' }],
    starterProducts: [
      {
        name: 'Mineral Water 500ml',
        categoryName: 'Beverages',
        sku: 'GRC-001',
        barcode: '',
        cost: 10,
        price: 18,
        stockQty: 24,
        reorderPoint: 6,
        trackBatches: true,
        trackExpiry: true
      }
    ],
    hints: [
      'FEFO is emphasized so near-expiry stock surfaces first in inventory review.',
      'Expiry alerts use a shorter window suited for convenience and grocery turnover.'
    ]
  },
  PHARMACY: {
    lowStockThreshold: 8,
    batchTrackingEnabled: true,
    expiryTrackingEnabled: true,
    fefoEnabled: true,
    expiryAlertDays: 90,
    starterCategories: ['Medicines', 'Supplements', 'Personal Care'],
    starterSuppliers: [{ name: 'Pharma Distributor', contactName: '', phone: '' }],
    starterProducts: [
      {
        name: 'Paracetamol 500mg',
        categoryName: 'Medicines',
        sku: 'PHA-001',
        barcode: '',
        cost: 35,
        price: 58,
        stockQty: 20,
        reorderPoint: 5,
        trackBatches: true,
        trackExpiry: true
      }
    ],
    hints: [
      'Batch and expiry tracking start enabled for safety-sensitive stock.',
      'Alert windows are longer so near-expiry medicine is flagged earlier.'
    ]
  },
  FOOD_BEVERAGE: {
    lowStockThreshold: 8,
    batchTrackingEnabled: true,
    expiryTrackingEnabled: true,
    fefoEnabled: true,
    expiryAlertDays: 7,
    starterCategories: ['Beverages', 'Food', 'Desserts'],
    starterSuppliers: [{ name: 'Main Food Supplier', contactName: '', phone: '' }],
    starterProducts: [
      {
        name: 'Cold Brew Bottle',
        categoryName: 'Beverages',
        sku: 'FDB-001',
        barcode: '',
        cost: 55,
        price: 120,
        stockQty: 12,
        reorderPoint: 4,
        trackBatches: true,
        trackExpiry: true
      }
    ],
    hints: [
      'Expiry tracking and FEFO start enabled for perishable stock.',
      'Shorter alert windows help operators react to daily shelf-life pressure.'
    ]
  },
  COSMETICS_BEAUTY: {
    lowStockThreshold: 6,
    batchTrackingEnabled: true,
    expiryTrackingEnabled: true,
    fefoEnabled: true,
    expiryAlertDays: 60,
    starterCategories: ['Skincare', 'Makeup', 'Hair Care'],
    starterSuppliers: [{ name: 'Beauty Supply Partner', contactName: '', phone: '' }],
    starterProducts: [
      {
        name: 'Hydrating Facial Cleanser',
        categoryName: 'Skincare',
        sku: 'COS-001',
        barcode: '',
        cost: 120,
        price: 240,
        stockQty: 10,
        reorderPoint: 3,
        trackBatches: true,
        trackExpiry: true
      }
    ],
    hints: [
      'Lot and expiry support are available for shelf-life-sensitive beauty goods.',
      'FEFO visibility helps older cosmetic batches move first.'
    ]
  },
  MEDICAL_SUPPLIES: {
    lowStockThreshold: 8,
    batchTrackingEnabled: true,
    expiryTrackingEnabled: true,
    fefoEnabled: true,
    expiryAlertDays: 120,
    starterCategories: ['Consumables', 'Diagnostics', 'Protective Equipment'],
    starterSuppliers: [{ name: 'Clinical Supply Partner', contactName: '', phone: '' }],
    starterProducts: [
      {
        name: 'Sterile Gauze Pads',
        categoryName: 'Consumables',
        sku: 'MED-001',
        barcode: '',
        cost: 65,
        price: 110,
        stockQty: 15,
        reorderPoint: 4,
        trackBatches: true,
        trackExpiry: true
      }
    ],
    hints: [
      'Expiry-aware stock control starts enabled for regulated supplies.',
      'Longer near-expiry windows help avoid waste on critical inventory.'
    ]
  },
  HARDWARE: {
    lowStockThreshold: 5,
    batchTrackingEnabled: false,
    expiryTrackingEnabled: false,
    fefoEnabled: false,
    expiryAlertDays: 30,
    starterCategories: ['Fasteners', 'Hand Tools', 'Electrical'],
    starterSuppliers: [{ name: 'Hardware Trade Supplier', contactName: '', phone: '' }],
    starterProducts: [
      {
        name: 'Steel Hammer 16oz',
        categoryName: 'Hand Tools',
        sku: 'HDW-001',
        barcode: '',
        cost: 180,
        price: 320,
        stockQty: 8,
        reorderPoint: 2,
        trackBatches: false,
        trackExpiry: false
      }
    ],
    hints: [
      'Batch and expiry tracking stay optional for durable-goods workflows.',
      'Inventory defaults remain simple unless a product specifically needs tighter traceability.'
    ]
  }
};

const LEGACY_SHOP_TYPE_MAP: Record<string, SupportedShopType> = {
  RETAIL: 'GENERAL_RETAIL',
  COFFEE: 'FOOD_BEVERAGE',
  FOOD: 'FOOD_BEVERAGE',
  BUILDING_MATERIALS: 'HARDWARE',
  SERVICES: 'GENERAL_RETAIL'
};

export function normalizeShopType(shopType: string): SupportedShopType {
  if (shopType in SHOP_TYPE_DEFAULTS) {
    return shopType as SupportedShopType;
  }

  return LEGACY_SHOP_TYPE_MAP[shopType] ?? 'GENERAL_RETAIL';
}

export function getShopTypeDefaults(shopType: string) {
  return SHOP_TYPE_DEFAULTS[normalizeShopType(shopType)];
}
