import {
  PayableStatus,
  CashSessionStatus,
  CustomerCreditStatus,
  CustomerLoyaltyLedgerType,
  CustomerType,
  DocumentSequenceType,
  PrismaClient,
  PurchaseStatus,
  SupplierCreditMemoStatus,
  SupplierReturnDisposition,
  SupplierReturnReason,
  SupplierReturnStatus,
  ShopRole,
  ShopType,
  WorkerJobType
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { INVENTORY_REASON_PRESETS } from '../lib/shop-config';
import { DEFAULT_UNITS_OF_MEASURE } from '../lib/uom';

const prisma = new PrismaClient();

function createSeedImageDataUrl(label: string, accent: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><rect width="640" height="640" fill="#f5f5f4"/><rect x="48" y="48" width="544" height="544" rx="42" fill="${accent}"/><text x="320" y="290" text-anchor="middle" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#ffffff">${label}</text><text x="320" y="360" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="#fff7ed">Vertex POS Demo</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

async function main() {
  const passwordHash = await bcrypt.hash('password123', 12);

  const owner = await prisma.user.upsert({
    where: { email: 'owner@vertexpos.local' },
    update: {
      emailVerifiedAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
      forcePasswordReset: false
    },
    create: {
      email: 'owner@vertexpos.local',
      name: 'Store Owner',
      passwordHash,
      emailVerifiedAt: new Date()
    }
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@vertexpos.local' },
    update: {
      emailVerifiedAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
      forcePasswordReset: false
    },
    create: {
      email: 'manager@vertexpos.local',
      name: 'Store Manager',
      passwordHash,
      emailVerifiedAt: new Date()
    }
  });

  const cashier = await prisma.user.upsert({
    where: { email: 'cashier@vertexpos.local' },
    update: {
      emailVerifiedAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
      forcePasswordReset: false
    },
    create: {
      email: 'cashier@vertexpos.local',
      name: 'Main Cashier',
      passwordHash,
      emailVerifiedAt: new Date()
    }
  });

  const existing = await prisma.shop.findFirst({ where: { ownerId: owner.id } });
  if (existing) {
    console.log('Seed already exists.');
    return;
  }

  const shop = await prisma.shop.create({
    data: {
      name: 'Paws & Beans Demo',
      legalBusinessName: 'Paws and Beans Retail Ventures Inc.',
      slug: 'paws-and-beans-demo',
      posType: ShopType.FOOD_BEVERAGE,
      phone: '09171234567',
      email: 'hello@pawsandbeans.local',
      address: 'Quezon City, Metro Manila',
      ownerId: owner.id
    }
  });

  await prisma.shopSetting.create({
    data: {
      shopId: shop.id,
      currencyCode: 'PHP',
      timezone: 'Asia/Manila',
      taxMode: 'EXCLUSIVE',
      currencySymbol: '₱',
      taxRate: 12,
      defaultPaymentMethods: ['Cash', 'Card', 'E-Wallet'],
      receiptHeader: 'Paws & Beans Demo',
      receiptFooter: 'Thank you for visiting Paws & Beans. See you again soon!',
      receiptWidth: '80mm',
      printerName: 'Front Counter Thermal Printer',
      printerConnection: 'USB',
      barcodeScannerNotes: 'Scan the product barcode or SKU and press Enter at checkout.',
      lowStockThreshold: 8,
      openingFloatRequired: true,
      openingFloatAmount: 500,
      batchTrackingEnabled: true,
      expiryTrackingEnabled: true,
      fefoEnabled: true,
      expiryAlertDays: 7,
      salePrefix: 'SAL',
      receiptPrefix: 'RCP',
      purchasePrefix: 'PO'
    }
  });

  await prisma.inventoryReason.createMany({
    data: INVENTORY_REASON_PRESETS.map((reason) => ({
      shopId: shop.id,
      code: reason.code,
      label: reason.label,
      isActive: true
    }))
  });

  await prisma.unitOfMeasure.createMany({
    data: DEFAULT_UNITS_OF_MEASURE.map((unit) => ({
      shopId: shop.id,
      code: unit.code,
      name: unit.name,
      isBase: unit.isBase,
      isActive: true
    }))
  });

  const units = await prisma.unitOfMeasure.findMany({
    where: { shopId: shop.id }
  });
  const pieceUnit = units.find((unit) => unit.code === 'PIECE')!;
  const boxUnit = units.find((unit) => unit.code === 'BOX')!;
  const cartonUnit = units.find((unit) => unit.code === 'CARTON')!;
  const packUnit = units.find((unit) => unit.code === 'PACK')!;

  for (const [userId, role] of [
    [owner.id, ShopRole.ADMIN],
    [manager.id, ShopRole.MANAGER],
    [cashier.id, ShopRole.CASHIER]
  ] as const) {
    await prisma.userShop.create({
      data: {
        userId,
        shopId: shop.id,
        role,
        isActive: true,
        assignedAt: new Date()
      }
    });

    await prisma.user.update({
      where: { id: userId },
      data: { defaultShopId: shop.id }
    });
  }

  const branchShop = await prisma.shop.create({
    data: {
      name: 'Paws & Beans East Branch',
      legalBusinessName: 'Paws and Beans Retail Ventures Inc.',
      slug: 'paws-and-beans-east-branch',
      posType: ShopType.FOOD_BEVERAGE,
      phone: '09171234568',
      email: 'east@pawsandbeans.local',
      address: 'Marikina City, Metro Manila',
      ownerId: owner.id
    }
  });

  await prisma.shopSetting.create({
    data: {
      shopId: branchShop.id,
      currencyCode: 'PHP',
      currencySymbol: '₱',
      timezone: 'Asia/Manila',
      taxMode: 'EXCLUSIVE',
      taxRate: 12,
      defaultPaymentMethods: ['Cash', 'Card'],
      receiptHeader: 'Paws & Beans East Branch',
      receiptFooter: 'Thank you for visiting our east branch.',
      receiptWidth: '80mm',
      printerName: 'East Branch Counter Printer',
      printerConnection: 'NETWORK',
      barcodeScannerNotes: 'Use the wireless scanner cradle at the front counter.',
      lowStockThreshold: 6,
      openingFloatRequired: true,
      openingFloatAmount: 300,
      batchTrackingEnabled: true,
      expiryTrackingEnabled: true,
      fefoEnabled: true,
      expiryAlertDays: 7,
      salePrefix: 'SAL',
      receiptPrefix: 'RCP',
      purchasePrefix: 'PO'
    }
  });

  await prisma.inventoryReason.createMany({
    data: INVENTORY_REASON_PRESETS.map((reason) => ({
      shopId: branchShop.id,
      code: reason.code,
      label: reason.label,
      isActive: true
    }))
  });

  await prisma.unitOfMeasure.createMany({
    data: DEFAULT_UNITS_OF_MEASURE.map((unit) => ({
      shopId: branchShop.id,
      code: unit.code,
      name: unit.name,
      isBase: unit.isBase,
      isActive: true
    }))
  });

  for (const [userId, role] of [
    [owner.id, ShopRole.ADMIN],
    [manager.id, ShopRole.MANAGER]
  ] as const) {
    await prisma.userShop.create({
      data: {
        userId,
        shopId: branchShop.id,
        role,
        isActive: true,
        assignedAt: new Date()
      }
    });
  }

  const coffee = await prisma.category.create({
    data: { shopId: shop.id, name: 'Coffee', slug: 'coffee' }
  });
  const nonCoffee = await prisma.category.create({
    data: { shopId: shop.id, name: 'Non-Coffee', slug: 'non-coffee' }
  });
  const pastries = await prisma.category.create({
    data: { shopId: shop.id, name: 'Pastries', slug: 'pastries' }
  });
  const groomingPackages = await prisma.category.create({
    data: { shopId: shop.id, name: 'Grooming Packages', slug: 'grooming-packages' }
  });
  const groomingAddons = await prisma.category.create({
    data: { shopId: shop.id, name: 'Grooming Add-ons', slug: 'grooming-addons' }
  });
  const petCareRetail = await prisma.category.create({
    data: { shopId: shop.id, name: 'Pet Care Retail', slug: 'pet-care-retail' }
  });

  const coffeeSupplier = await prisma.supplier.create({
    data: {
      shopId: shop.id,
      name: 'Metro Coffee Supply',
      contactName: 'Lara Gomez',
      email: 'lara@metrocoffee.local',
      phone: '09170000001',
      address: 'Makati City',
      notes: 'Beans, syrups, milk, pastry essentials'
    }
  });

  await prisma.supplier.create({
    data: {
      shopId: shop.id,
      name: 'Pet Grooming Essentials Hub',
      contactName: 'Marc Dela Cruz',
      email: 'marc@petessentials.local',
      phone: '09170000002',
      address: 'Pasig City',
      notes: 'Grooming supplies and pet-care retail products'
    }
  });

  const annaCustomer = await prisma.customer.create({
    data: {
      shopId: shop.id,
      type: CustomerType.INDIVIDUAL,
      firstName: 'Anna',
      lastName: 'Reyes',
      phone: '09171230001',
      email: 'anna.reyes@demo.local',
      address: 'Mandaluyong City',
      notes: 'Regular retail customer who actively uses loyalty rewards.'
    }
  });

  const businessCustomer = await prisma.customer.create({
    data: {
      shopId: shop.id,
      type: CustomerType.BUSINESS,
      businessName: 'Happy Tails Rescue',
      contactPerson: 'Joan Santiago',
      taxId: 'TIN-8899-4455',
      phone: '09181230002',
      email: 'purchasing@happytails.local',
      address: 'Marikina City',
      notes: 'Approved for short-term customer credit on scheduled bulk orders.'
    }
  });

  await prisma.customer.create({
    data: {
      shopId: shop.id,
      type: CustomerType.INDIVIDUAL,
      firstName: 'Marco',
      lastName: 'Villanueva',
      phone: '09181230003',
      notes: 'Archived demo customer record.',
      isActive: false
    }
  });

  const productData = [
    { categoryId: coffee.id, sku: 'COF-001', barcode: '480100100001', name: 'Espresso', description: 'Single shot espresso', cost: 28, price: 90, stockQty: 50, reorderPoint: 10, trackBatches: false, trackExpiry: false },
    { categoryId: coffee.id, sku: 'COF-002', barcode: '480100100002', name: 'Americano', description: 'Hot americano', cost: 30, price: 110, stockQty: 45, reorderPoint: 10, trackBatches: false, trackExpiry: false },
    { categoryId: coffee.id, sku: 'COF-003', barcode: '480100100003', name: 'Latte', description: 'Cafe latte', cost: 42, price: 150, stockQty: 35, reorderPoint: 10, trackBatches: true, trackExpiry: true },
    { categoryId: coffee.id, sku: 'COF-004', barcode: '480100100004', name: 'Cappuccino', description: 'Classic cappuccino', cost: 40, price: 145, stockQty: 28, reorderPoint: 8, trackBatches: true, trackExpiry: true },
    { categoryId: coffee.id, sku: 'COF-005', barcode: '480100100005', name: 'Mocha', description: 'Chocolate coffee drink', cost: 48, price: 165, stockQty: 22, reorderPoint: 8, trackBatches: true, trackExpiry: true },
    { categoryId: nonCoffee.id, sku: 'NCO-001', barcode: '480100100006', name: 'Iced Tea', description: 'House iced tea', cost: 18, price: 75, stockQty: 30, reorderPoint: 8, trackBatches: true, trackExpiry: true },
    { categoryId: nonCoffee.id, sku: 'NCO-002', barcode: '480100100007', name: 'Matcha Latte', description: 'Creamy matcha latte', cost: 38, price: 155, stockQty: 18, reorderPoint: 6, trackBatches: true, trackExpiry: true },
    { categoryId: pastries.id, sku: 'PAS-001', barcode: '480100100008', name: 'Croissant', description: 'Butter croissant', cost: 28, price: 85, stockQty: 15, reorderPoint: 5, trackBatches: true, trackExpiry: true },
    { categoryId: pastries.id, sku: 'PAS-002', barcode: '480100100009', name: 'Blueberry Muffin', description: 'Blueberry muffin', cost: 32, price: 95, stockQty: 12, reorderPoint: 5, trackBatches: true, trackExpiry: true },
    { categoryId: groomingPackages.id, sku: 'GRM-001', barcode: '480100100010', name: 'Basic Bath', description: 'Dog bath and dry service', cost: 180, price: 450, stockQty: 999, reorderPoint: 0, trackBatches: false, trackExpiry: false },
    { categoryId: groomingPackages.id, sku: 'GRM-002', barcode: '480100100011', name: 'Full Grooming', description: 'Full grooming package', cost: 300, price: 850, stockQty: 999, reorderPoint: 0, trackBatches: false, trackExpiry: false },
    { categoryId: groomingAddons.id, sku: 'GRA-001', barcode: '480100100012', name: 'Nail Trimming', description: 'Quick nail trimming add-on', cost: 40, price: 120, stockQty: 999, reorderPoint: 0, trackBatches: false, trackExpiry: false },
    { categoryId: groomingAddons.id, sku: 'GRA-002', barcode: '480100100013', name: 'Ear Cleaning', description: 'Ear cleaning add-on', cost: 35, price: 100, stockQty: 999, reorderPoint: 0, trackBatches: false, trackExpiry: false },
    { categoryId: groomingAddons.id, sku: 'GRA-003', barcode: '480100100014', name: 'Tick & Flea Treatment', description: 'Treatment add-on', cost: 90, price: 220, stockQty: 999, reorderPoint: 0, trackBatches: false, trackExpiry: false },
    { categoryId: groomingAddons.id, sku: 'GRA-004', barcode: '480100100015', name: 'De-shedding Treatment', description: 'Premium de-shedding add-on', cost: 120, price: 280, stockQty: 999, reorderPoint: 0, trackBatches: false, trackExpiry: false },
    { categoryId: groomingAddons.id, sku: 'GRA-005', barcode: '480100100016', name: 'Teeth Brushing', description: 'Teeth brushing add-on', cost: 30, price: 90, stockQty: 999, reorderPoint: 0, trackBatches: false, trackExpiry: false },
    { categoryId: groomingAddons.id, sku: 'GRA-006', barcode: '480100100017', name: 'Paw Balm Treatment', description: 'Paw care add-on', cost: 25, price: 80, stockQty: 999, reorderPoint: 0, trackBatches: false, trackExpiry: false },
    { categoryId: petCareRetail.id, sku: 'PET-001', barcode: '480100100018', name: 'Pet Shampoo 250ml', description: 'Retail pet shampoo', cost: 120, price: 220, stockQty: 9, reorderPoint: 8, trackBatches: true, trackExpiry: true },
    { categoryId: petCareRetail.id, sku: 'PET-002', barcode: '480100100019', name: 'Dental Chew Pack', description: 'Dog dental chew pack', cost: 75, price: 145, stockQty: 11, reorderPoint: 6, trackBatches: true, trackExpiry: true }
  ];

  const products = [];
  for (const item of productData) {
    const product = await prisma.product.create({
      data: {
        shopId: shop.id,
        categoryId: item.categoryId,
        baseUnitOfMeasureId: pieceUnit.id,
        sku: item.sku,
        barcode: item.barcode,
        name: item.name,
        description: item.description,
        cost: item.cost,
        price: item.price,
        stockQty: item.stockQty,
        reorderPoint: item.reorderPoint,
        trackBatches: item.trackBatches,
        trackExpiry: item.trackExpiry
      }
    });
    products.push(product);
  }

  await prisma.productVariant.createMany({
    data: [
      {
        productId: products[2].id,
        size: '12oz',
        sku: 'COF-003-12OZ',
        barcode: '480100200301',
        priceOverride: 150,
        costOverride: 42
      },
      {
        productId: products[2].id,
        size: '16oz',
        sku: 'COF-003-16OZ',
        barcode: '480100200302',
        priceOverride: 175,
        costOverride: 48
      },
      {
        productId: products[17].id,
        flavor: 'Oatmeal',
        sku: 'PET-001-OAT',
        barcode: '480100300181',
        priceOverride: 220,
        costOverride: 120
      },
      {
        productId: products[17].id,
        flavor: 'Lavender',
        sku: 'PET-001-LAV',
        barcode: '480100300182',
        priceOverride: 235,
        costOverride: 126
      }
    ]
  });

  await prisma.productImage.createMany({
    data: [
      {
        productId: products[2].id,
        imageUrl: createSeedImageDataUrl('Latte', '#0f766e'),
        altText: 'Latte hero image',
        sortOrder: 0
      },
      {
        productId: products[7].id,
        imageUrl: createSeedImageDataUrl('Croissant', '#b45309'),
        altText: 'Croissant product image',
        sortOrder: 0
      },
      {
        productId: products[17].id,
        imageUrl: createSeedImageDataUrl('Pet Shampoo', '#1d4ed8'),
        altText: 'Pet shampoo product image',
        sortOrder: 0
      }
    ]
  });

  await prisma.productPriceHistory.createMany({
    data: [
      {
        productId: products[2].id,
        previousPrice: 145,
        newPrice: 150,
        effectiveDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
        changedByUserId: manager.id,
        note: 'Adjusted after updated milk cost.'
      }
    ]
  });

  await prisma.productCostHistory.createMany({
    data: [
      {
        productId: products[2].id,
        previousCost: 40,
        newCost: 42,
        effectiveDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12),
        changedByUserId: manager.id,
        note: 'Supplier increase on dairy inputs.'
      }
    ]
  });

  await prisma.productUomConversion.createMany({
    data: [
      { productId: products[7].id, unitOfMeasureId: boxUnit.id, ratioToBase: 6 },
      { productId: products[8].id, unitOfMeasureId: boxUnit.id, ratioToBase: 6 },
      { productId: products[17].id, unitOfMeasureId: boxUnit.id, ratioToBase: 12 },
      { productId: products[17].id, unitOfMeasureId: cartonUnit.id, ratioToBase: 144 },
      { productId: products[18].id, unitOfMeasureId: packUnit.id, ratioToBase: 8 }
    ]
  });

  const seededBatches = [
    {
      productId: products[7].id,
      lotNumber: 'PAS-OPEN-001',
      expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
      quantity: 15
    },
    {
      productId: products[8].id,
      lotNumber: 'PAS-OPEN-002',
      expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
      quantity: 12
    },
    {
      productId: products[17].id,
      lotNumber: 'PET-OPEN-001',
      expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45),
      quantity: 9
    }
  ];

  await prisma.productBatch.createMany({
    data: seededBatches.map((batch) => ({
      shopId: shop.id,
      productId: batch.productId,
      lotNumber: batch.lotNumber,
      expiryDate: batch.expiryDate,
      quantity: batch.quantity,
      receivedAt: new Date(),
      notes: 'Seed tracked batch'
    }))
  });

  for (const product of products) {
    if (product.stockQty > 0) {
      await prisma.inventoryMovement.create({
        data: {
          shopId: shop.id,
          productId: product.id,
          type: 'OPENING_STOCK',
          qtyChange: product.stockQty,
          userId: owner.id,
          notes: 'Seed opening stock'
        }
      });
    }
  }

  const branchPieceUnit = await prisma.unitOfMeasure.findFirstOrThrow({
    where: {
      shopId: branchShop.id,
      code: 'PIECE'
    }
  });

  const branchCoffee = await prisma.category.create({
    data: { shopId: branchShop.id, name: 'Coffee', slug: 'coffee' }
  });
  const branchPetCare = await prisma.category.create({
    data: { shopId: branchShop.id, name: 'Pet Care Retail', slug: 'pet-care-retail' }
  });

  const branchEspresso = await prisma.product.create({
    data: {
      shopId: branchShop.id,
      categoryId: branchCoffee.id,
      baseUnitOfMeasureId: branchPieceUnit.id,
      sku: 'COF-001',
      barcode: '480100100001',
      name: 'Espresso',
      description: 'Single shot espresso',
      cost: 28,
      price: 90,
      stockQty: 18,
      reorderPoint: 6
    }
  });

  const branchPetShampoo = await prisma.product.create({
    data: {
      shopId: branchShop.id,
      categoryId: branchPetCare.id,
      baseUnitOfMeasureId: branchPieceUnit.id,
      sku: 'PET-001',
      barcode: '480100100018',
      name: 'Pet Shampoo 250ml',
      description: 'Retail pet shampoo',
      cost: 120,
      price: 220,
      stockQty: 4,
      reorderPoint: 4,
      trackBatches: true,
      trackExpiry: true
    }
  });

  for (const branchProduct of [branchEspresso, branchPetShampoo]) {
    await prisma.inventoryMovement.create({
      data: {
        shopId: branchShop.id,
        productId: branchProduct.id,
        type: 'OPENING_STOCK',
        qtyChange: branchProduct.stockQty,
        userId: owner.id,
        notes: 'Seed opening stock for branch'
      }
    });
  }

  const purchase = await prisma.purchaseOrder.create({
    data: {
      shopId: shop.id,
      supplierId: coffeeSupplier.id,
      purchaseNumber: 'PO-20260325-0001',
      status: PurchaseStatus.FULLY_RECEIVED,
      totalAmount: 4160,
      receivedAt: new Date(),
      notes: 'Initial coffee and pastry stock load',
      items: {
        create: [
          { productId: products[0].id, unitOfMeasureId: pieceUnit.id, unitCode: pieceUnit.code, unitName: pieceUnit.name, productName: products[0].name, qty: 20, ratioToBase: 1, receivedBaseQty: 20, unitCost: 28, lineTotal: 560 },
          { productId: products[2].id, unitOfMeasureId: pieceUnit.id, unitCode: pieceUnit.code, unitName: pieceUnit.name, productName: products[2].name, qty: 10, ratioToBase: 1, receivedBaseQty: 10, unitCost: 42, lineTotal: 420 },
          { productId: products[7].id, unitOfMeasureId: boxUnit.id, unitCode: boxUnit.code, unitName: boxUnit.name, productName: products[7].name, qty: 10, ratioToBase: 6, receivedBaseQty: 60, unitCost: 168, lineTotal: 1680 },
          { productId: products[8].id, unitOfMeasureId: boxUnit.id, unitCode: boxUnit.code, unitName: boxUnit.name, productName: products[8].name, qty: 10, ratioToBase: 6, receivedBaseQty: 60, unitCost: 150, lineTotal: 1500 }
        ]
      },
      supplierInvoice: {
        create: {
          shopId: shop.id,
          supplierId: coffeeSupplier.id,
          invoiceNumber: 'MCS-INV-0001',
          invoiceDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
          dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
          totalAmount: 4160,
          paymentStatus: PayableStatus.PARTIALLY_PAID,
          notes: 'Seeded supplier invoice for opening replenishment'
        }
      }
    },
    include: {
      items: true,
      supplierInvoice: true
    }
  });

  await prisma.purchaseReceipt.create({
    data: {
      shopId: shop.id,
      purchaseId: purchase.id,
      receivedByUserId: manager.id,
      receivedAt: purchase.receivedAt ?? new Date(),
      notes: 'Seed full delivery for opening stock load',
      items: {
        create: purchase.items.map((item) => ({
          purchaseItemId: item.id,
          productId: item.productId,
          qtyReceived: item.qty
        }))
      }
    }
  });

  for (const [index, qty, costPerBase] of [
    [0, 20, 28],
    [2, 10, 42],
    [7, 60, 28],
    [8, 60, 25]
  ] as const) {
    await prisma.product.update({
      where: { id: products[index].id },
      data: {
        stockQty: { increment: qty },
        cost: costPerBase
      }
    });

    await prisma.inventoryMovement.create({
      data: {
          shopId: shop.id,
          productId: products[index].id,
          type: 'PURCHASE_RECEIVED',
          qtyChange: qty,
        referenceId: purchase.id,
        userId: manager.id,
        notes: 'Seed purchase'
      }
      });
    }

  await prisma.supplierPayment.create({
    data: {
      shopId: shop.id,
      supplierInvoiceId: purchase.supplierInvoice!.id,
      method: 'Bank Transfer',
      amount: 2000,
      referenceNumber: 'BT-OPEN-2000',
      paidAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      createdByUserId: manager.id
    }
  });

  await prisma.accountsPayableEntry.create({
    data: {
      shopId: shop.id,
      supplierId: coffeeSupplier.id,
      supplierInvoiceId: purchase.supplierInvoice!.id,
      amountDue: 4160,
      amountPaid: 2000,
      balance: 2160,
      status: PayableStatus.PARTIALLY_PAID,
      dueDate: purchase.supplierInvoice!.dueDate
    }
  });

  const supplierReturn = await prisma.supplierReturn.create({
    data: {
      shopId: shop.id,
      supplierId: coffeeSupplier.id,
      createdByUserId: manager.id,
      approvedByUserId: manager.id,
      status: SupplierReturnStatus.POSTED,
      returnNumber: 'RTS-20260325-0001',
      reasonSummary: 'Damaged pastry items from supplier delivery',
      notes: 'Three croissant units showed packaging damage on supplier turnover.',
      creditMemoNumber: 'CM-0001',
      creditMemoDate: new Date(Date.now() - 1000 * 60 * 60 * 18),
      creditAmount: 84,
      creditMemoStatus: SupplierCreditMemoStatus.ISSUED,
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 18),
      items: {
        create: [
          {
            productId: products[7].id,
            productNameSnapshot: products[7].name,
            qty: 3,
            unitCost: 28,
            lineTotal: 84,
            reason: SupplierReturnReason.DAMAGED_FROM_SUPPLIER,
            disposition: SupplierReturnDisposition.DAMAGED
          }
        ]
      }
    }
  });

  await prisma.product.update({
    where: { id: products[7].id },
    data: {
      stockQty: { decrement: 3 }
    }
  });

  await prisma.inventoryMovement.create({
    data: {
      shopId: shop.id,
      productId: products[7].id,
      type: 'SUPPLIER_RETURN_POSTED',
      qtyChange: -3,
      referenceId: supplierReturn.id,
      userId: manager.id,
      notes: 'Seed supplier return'
    }
  });

  const annaFirstSale = await prisma.sale.create({
    data: {
      shopId: shop.id,
      cashierUserId: cashier.id,
      customerId: annaCustomer.id,
      saleNumber: 'SAL-20260326-0001',
      receiptNumber: 'RCP-20260326-0001',
      customerName: 'Anna Reyes',
      customerPhone: annaCustomer.phone,
      subtotal: 470,
      taxAmount: 56.4,
      discountAmount: 0,
      totalAmount: 526.4,
      changeDue: 0,
      paymentMethod: 'Cash',
      isCreditSale: false,
      loyaltyPointsEarned: 5,
      loyaltyPointsRedeemed: 0,
      loyaltyDiscountAmount: 0,
      notes: 'Seed customer sale with loyalty earn.',
      cashierName: cashier.name,
      items: {
        create: [
          {
            productId: products[2].id,
            productName: products[2].name,
            qty: 2,
            unitPrice: 150,
            lineTotal: 300
          },
          {
            productId: products[7].id,
            productName: products[7].name,
            qty: 2,
            unitPrice: 85,
            lineTotal: 170
          }
        ]
      },
      payments: {
        create: [
          {
            method: 'Cash',
            amount: 526.4
          }
        ]
      }
    }
  });

  await prisma.customerLoyaltyLedger.create({
    data: {
      shopId: shop.id,
      customerId: annaCustomer.id,
      saleId: annaFirstSale.id,
      type: CustomerLoyaltyLedgerType.EARNED,
      points: 5,
      balanceAfter: 5,
      note: `Earned from sale ${annaFirstSale.saleNumber}.`
    }
  });

  await prisma.product.update({
    where: { id: products[2].id },
    data: {
      stockQty: { decrement: 2 }
    }
  });

  await prisma.inventoryMovement.create({
    data: {
      shopId: shop.id,
      productId: products[2].id,
      type: 'SALE_COMPLETED',
      qtyChange: -2,
      referenceId: annaFirstSale.id,
      userId: cashier.id,
      notes: 'Seed customer sale'
    }
  });

  await prisma.product.update({
    where: { id: products[7].id },
    data: {
      stockQty: { decrement: 2 }
    }
  });

  await prisma.inventoryMovement.create({
    data: {
      shopId: shop.id,
      productId: products[7].id,
      type: 'SALE_COMPLETED',
      qtyChange: -2,
      referenceId: annaFirstSale.id,
      userId: cashier.id,
      notes: 'Seed customer sale'
    }
  });

  const annaSecondSale = await prisma.sale.create({
    data: {
      shopId: shop.id,
      cashierUserId: cashier.id,
      customerId: annaCustomer.id,
      saleNumber: 'SAL-20260327-0001',
      receiptNumber: 'RCP-20260327-0001',
      customerName: 'Anna Reyes',
      customerPhone: annaCustomer.phone,
      subtotal: 265,
      taxAmount: 31.8,
      discountAmount: 3,
      totalAmount: 293.8,
      changeDue: 0,
      paymentMethod: 'Card',
      isCreditSale: false,
      loyaltyPointsEarned: 2,
      loyaltyPointsRedeemed: 3,
      loyaltyDiscountAmount: 3,
      notes: 'Seed customer sale with loyalty redemption.',
      cashierName: cashier.name,
      items: {
        create: [
          {
            productId: products[0].id,
            productName: products[0].name,
            qty: 2,
            unitPrice: 90,
            lineTotal: 180
          },
          {
            productId: products[7].id,
            productName: products[7].name,
            qty: 1,
            unitPrice: 85,
            lineTotal: 85
          }
        ]
      },
      payments: {
        create: [
          {
            method: 'Card',
            amount: 293.8,
            referenceNumber: 'CARD-20260327-2938'
          }
        ]
      }
    }
  });

  await prisma.customerLoyaltyLedger.create({
    data: {
      shopId: shop.id,
      customerId: annaCustomer.id,
      saleId: annaSecondSale.id,
      type: CustomerLoyaltyLedgerType.REDEEMED,
      points: 3,
      balanceAfter: 2,
      note: `Redeemed on sale ${annaSecondSale.saleNumber}.`
    }
  });

  await prisma.customerLoyaltyLedger.create({
    data: {
      shopId: shop.id,
      customerId: annaCustomer.id,
      saleId: annaSecondSale.id,
      type: CustomerLoyaltyLedgerType.EARNED,
      points: 2,
      balanceAfter: 4,
      note: `Earned from sale ${annaSecondSale.saleNumber}.`
    }
  });

  await prisma.product.update({
    where: { id: products[0].id },
    data: {
      stockQty: { decrement: 2 }
    }
  });

  await prisma.inventoryMovement.create({
    data: {
      shopId: shop.id,
      productId: products[0].id,
      type: 'SALE_COMPLETED',
      qtyChange: -2,
      referenceId: annaSecondSale.id,
      userId: cashier.id,
      notes: 'Seed loyalty redemption sale'
    }
  });

  await prisma.product.update({
    where: { id: products[7].id },
    data: {
      stockQty: { decrement: 1 }
    }
  });

  await prisma.inventoryMovement.create({
    data: {
      shopId: shop.id,
      productId: products[7].id,
      type: 'SALE_COMPLETED',
      qtyChange: -1,
      referenceId: annaSecondSale.id,
      userId: cashier.id,
      notes: 'Seed loyalty redemption sale'
    }
  });

  const businessCreditSale = await prisma.sale.create({
    data: {
      shopId: shop.id,
      cashierUserId: manager.id,
      customerId: businessCustomer.id,
      saleNumber: 'SAL-20260329-0001',
      receiptNumber: 'RCP-20260329-0001',
      customerName: businessCustomer.businessName,
      customerPhone: businessCustomer.phone,
      subtotal: 950,
      taxAmount: 114,
      discountAmount: 0,
      totalAmount: 1064,
      changeDue: 0,
      paymentMethod: 'Customer Credit',
      isCreditSale: true,
      loyaltyPointsEarned: 10,
      loyaltyPointsRedeemed: 0,
      loyaltyDiscountAmount: 0,
      notes: 'Seed credit sale for business customer.',
      cashierName: manager.name,
      items: {
        create: [
          {
            productId: products[17].id,
            productName: products[17].name,
            qty: 3,
            unitPrice: 220,
            lineTotal: 660
          },
          {
            productId: products[18].id,
            productName: products[18].name,
            qty: 2,
            unitPrice: 145,
            lineTotal: 290
          }
        ]
      }
    }
  });

  await prisma.customerLoyaltyLedger.create({
    data: {
      shopId: shop.id,
      customerId: businessCustomer.id,
      saleId: businessCreditSale.id,
      type: CustomerLoyaltyLedgerType.EARNED,
      points: 10,
      balanceAfter: 10,
      note: `Earned from sale ${businessCreditSale.saleNumber}.`
    }
  });

  const businessReceivable = await prisma.customerCreditLedger.create({
    data: {
      shopId: shop.id,
      customerId: businessCustomer.id,
      saleId: businessCreditSale.id,
      dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
      originalAmount: 1064,
      balance: 1064,
      status: CustomerCreditStatus.OPEN
    }
  });

  await prisma.receivablePayment.create({
    data: {
      shopId: shop.id,
      customerCreditLedgerId: businessReceivable.id,
      amount: 400,
      method: 'Bank Transfer',
      referenceNumber: 'AR-20260330-0400',
      paidAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4),
      createdByUserId: manager.id
    }
  });

  await prisma.customerCreditLedger.update({
    where: { id: businessReceivable.id },
    data: {
      balance: 664,
      status: CustomerCreditStatus.OVERDUE
    }
  });

  await prisma.product.update({
    where: { id: products[17].id },
    data: {
      stockQty: { decrement: 3 }
    }
  });

  await prisma.inventoryMovement.create({
    data: {
      shopId: shop.id,
      productId: products[17].id,
      type: 'SALE_COMPLETED',
      qtyChange: -3,
      referenceId: businessCreditSale.id,
      userId: manager.id,
      notes: 'Seed business credit sale'
    }
  });

  await prisma.product.update({
    where: { id: products[18].id },
    data: {
      stockQty: { decrement: 2 }
    }
  });

  await prisma.inventoryMovement.create({
    data: {
      shopId: shop.id,
      productId: products[18].id,
      type: 'SALE_COMPLETED',
      qtyChange: -2,
      referenceId: businessCreditSale.id,
      userId: manager.id,
      notes: 'Seed business credit sale'
    }
  });

  const stockTransfer = await prisma.stockTransfer.create({
    data: {
      fromShopId: shop.id,
      toShopId: branchShop.id,
      createdByUserId: manager.id,
      receivedByUserId: manager.id,
      transferNumber: 'TRF-20260330-0001',
      status: 'RECEIVED',
      notes: 'Rebalanced espresso inventory to the east branch after a strong morning rush.',
      sentAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
      receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 10),
      items: {
        create: [
          {
            fromProductId: products[0].id,
            toProductId: branchEspresso.id,
            productNameSnapshot: products[0].name,
            destinationProductNameSnapshot: branchEspresso.name,
            qty: 4
          }
        ]
      }
    }
  });

  await prisma.product.update({
    where: { id: products[0].id },
    data: {
      stockQty: { decrement: 4 }
    }
  });

  await prisma.inventoryMovement.create({
    data: {
      shopId: shop.id,
      productId: products[0].id,
      type: 'TRANSFER_OUT',
      qtyChange: -4,
      referenceId: stockTransfer.id,
      userId: manager.id,
      notes: 'Seed branch transfer out'
    }
  });

  await prisma.product.update({
    where: { id: branchEspresso.id },
    data: {
      stockQty: { increment: 4 }
    }
  });

  await prisma.inventoryMovement.create({
    data: {
      shopId: branchShop.id,
      productId: branchEspresso.id,
      type: 'TRANSFER_IN',
      qtyChange: 4,
      referenceId: stockTransfer.id,
      userId: manager.id,
      notes: 'Seed branch transfer in'
    }
  });

  const seededCashSession = await prisma.cashSession.create({
    data: {
      shopId: shop.id,
      userId: cashier.id,
      openedAt: new Date(Date.now() - 1000 * 60 * 60 * 9),
      openingFloat: 500,
      closedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
      closingExpected: 500,
      closingActual: 495,
      variance: -5,
      notes: 'Seeded closeout with a small short count after the drawer recount.',
      status: CashSessionStatus.CLOSED
    }
  });

  await prisma.activityLog.createMany({
    data: [
      {
        shopId: shop.id,
        userId: owner.id,
        action: 'SHOP_ONBOARDED',
        entityType: 'Shop',
        entityId: shop.id,
        description: `Completed onboarding for ${shop.name}.`
      },
      {
        shopId: shop.id,
        userId: manager.id,
        action: 'PURCHASE_RECEIVED',
        entityType: 'PurchaseOrder',
        entityId: purchase.id,
        description: `Received purchase ${purchase.purchaseNumber}.`
      },
      {
        shopId: shop.id,
        userId: manager.id,
        action: 'SUPPLIER_RETURN_POSTED',
        entityType: 'SupplierReturn',
        entityId: supplierReturn.id,
        description: `Posted supplier return ${supplierReturn.returnNumber}.`
      },
      {
        shopId: shop.id,
        userId: manager.id,
        action: 'STOCK_TRANSFER_SENT',
        entityType: 'StockTransfer',
        entityId: stockTransfer.id,
        description: `Sent stock transfer ${stockTransfer.transferNumber}.`
      },
      {
        shopId: shop.id,
        userId: cashier.id,
        action: 'REGISTER_CLOSED',
        entityType: 'CashSession',
        entityId: seededCashSession.id,
        description: 'Closed a seeded register session after end-of-day count.'
      }
    ]
  });

  await prisma.authAuditLog.createMany({
    data: [
      {
        userId: owner.id,
        shopId: shop.id,
        action: 'LOGIN_SUCCESS',
        email: owner.email,
        createdAt: new Date(Date.now() - 1000 * 60 * 20)
      },
      {
        userId: manager.id,
        shopId: shop.id,
        action: 'LOGIN_SUCCESS',
        email: manager.email,
        createdAt: new Date(Date.now() - 1000 * 60 * 70)
      },
      {
        userId: cashier.id,
        shopId: shop.id,
        action: 'LOGIN_SUCCESS',
        email: cashier.email,
        createdAt: new Date(Date.now() - 1000 * 60 * 140)
      }
    ]
  });

  await prisma.documentSequence.createMany({
    data: [
      { shopId: shop.id, type: DocumentSequenceType.SALE, dateKey: '20260325', value: 0 },
      { shopId: shop.id, type: DocumentSequenceType.RECEIPT, dateKey: '20260325', value: 0 },
      { shopId: shop.id, type: DocumentSequenceType.PURCHASE, dateKey: '20260325', value: 1 },
      { shopId: shop.id, type: DocumentSequenceType.TRANSFER, dateKey: '20260330', value: 1 },
      { shopId: branchShop.id, type: DocumentSequenceType.TRANSFER, dateKey: '20260330', value: 0 }
    ]
  });

  await prisma.workerJob.createMany({
    data: [
      { shopId: shop.id, type: WorkerJobType.LOW_STOCK_SCAN },
      { shopId: shop.id, type: WorkerJobType.DAILY_SUMMARY }
    ]
  });

  console.log('Seeded successfully');
  console.log('Owner: owner@vertexpos.local / password123');
  console.log('Manager: manager@vertexpos.local / password123');
  console.log('Cashier: cashier@vertexpos.local / password123');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
