import {
  CashSessionStatus,
  DocumentSequenceType,
  PrismaClient,
  PurchaseStatus,
  ShopRole,
  ShopType,
  WorkerJobType
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { INVENTORY_REASON_PRESETS } from '../lib/shop-config';
import { DEFAULT_UNITS_OF_MEASURE } from '../lib/uom';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 12);

  const owner = await prisma.user.upsert({
    where: { email: 'owner@vertexpos.local' },
    update: {},
    create: { email: 'owner@vertexpos.local', name: 'Store Owner', passwordHash }
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@vertexpos.local' },
    update: {},
    create: { email: 'manager@vertexpos.local', name: 'Store Manager', passwordHash }
  });

  const cashier = await prisma.user.upsert({
    where: { email: 'cashier@vertexpos.local' },
    update: {},
    create: { email: 'cashier@vertexpos.local', name: 'Main Cashier', passwordHash }
  });

  const existing = await prisma.shop.findFirst({ where: { ownerId: owner.id } });
  if (existing) {
    console.log('Seed already exists.');
    return;
  }

  const shop = await prisma.shop.create({
    data: {
      name: 'Paws & Beans Demo',
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
      currencySymbol: '₱',
      taxRate: 12,
      receiptHeader: 'Paws & Beans Demo',
      receiptFooter: 'Thank you for visiting Paws & Beans. See you again soon!',
      receiptWidth: '80mm',
      lowStockThreshold: 8,
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

  const purchase = await prisma.purchaseOrder.create({
    data: {
      shopId: shop.id,
      supplierId: coffeeSupplier.id,
      purchaseNumber: 'PO-20260325-0001',
      status: PurchaseStatus.RECEIVED,
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
      { shopId: shop.id, type: DocumentSequenceType.PURCHASE, dateKey: '20260325', value: 1 }
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
