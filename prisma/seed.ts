import { PrismaClient, PurchaseStatus, ShopRole, ShopType, WorkerJobType } from '@prisma/client';
import bcrypt from 'bcryptjs';

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
      name: 'Vertex Demo Store',
      slug: 'vertex-demo-store',
      posType: ShopType.RETAIL,
      phone: '09171234567',
      email: 'store@vertexpos.local',
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
      receiptHeader: 'Vertex Demo Store',
      receiptFooter: 'Thank you for shopping with Vertex POS.',
      lowStockThreshold: 10,
      salePrefix: 'SAL',
      receiptPrefix: 'RCP',
      purchasePrefix: 'PO'
    }
  });

  for (const [userId, role] of [[owner.id, ShopRole.ADMIN], [manager.id, ShopRole.MANAGER], [cashier.id, ShopRole.CASHIER]] as const) {
    await prisma.userShop.create({ data: { userId, shopId: shop.id, role } });
    await prisma.user.update({ where: { id: userId }, data: { defaultShopId: shop.id } });
  }

  const beverages = await prisma.category.create({ data: { shopId: shop.id, name: 'Beverages', slug: 'beverages' } });
  const snacks = await prisma.category.create({ data: { shopId: shop.id, name: 'Snacks', slug: 'snacks' } });
  const instant = await prisma.category.create({ data: { shopId: shop.id, name: 'Instant Noodles', slug: 'instant-noodles', parentId: snacks.id } });

  const supplier = await prisma.supplier.create({ data: { shopId: shop.id, name: 'Metro Supply Hub', contactName: 'Lara Gomez', email: 'lara@metrosupply.local', phone: '09170000000', address: 'Manila' } });

  const products = await Promise.all([
    prisma.product.create({ data: { shopId: shop.id, categoryId: beverages.id, sku: 'BEV-001', barcode: '480001000001', name: 'Mineral Water 500ml', description: 'Sample bottled water', cost: 10, price: 18, stockQty: 42, reorderPoint: 10 } }),
    prisma.product.create({ data: { shopId: shop.id, categoryId: beverages.id, sku: 'BEV-002', barcode: '480001000002', name: 'Iced Tea Bottle', description: 'Ready-to-drink iced tea', cost: 18, price: 32, stockQty: 8, reorderPoint: 10 } }),
    prisma.product.create({ data: { shopId: shop.id, categoryId: instant.id, sku: 'SNK-001', barcode: '480001000003', name: 'Instant Noodles Cup', description: 'Cup noodle snack meal', cost: 14, price: 25, stockQty: 30, reorderPoint: 8 } })
  ]);

  for (const product of products) {
    await prisma.inventoryMovement.create({ data: { shopId: shop.id, productId: product.id, type: 'OPENING_STOCK', qtyChange: product.stockQty, notes: 'Seed opening stock' } });
  }

  const purchase = await prisma.purchaseOrder.create({
    data: {
      shopId: shop.id,
      supplierId: supplier.id,
      purchaseNumber: 'PO-20260323-1001',
      status: PurchaseStatus.RECEIVED,
      totalAmount: 560,
      receivedAt: new Date(),
      notes: 'Initial stock load',
      items: {
        create: [
          { productId: products[0].id, productName: products[0].name, qty: 20, unitCost: 10, lineTotal: 200 },
          { productId: products[1].id, productName: products[1].name, qty: 20, unitCost: 18, lineTotal: 360 }
        ]
      }
    }
  });

  await prisma.inventoryMovement.createMany({
    data: [
      { shopId: shop.id, productId: products[0].id, type: 'PURCHASE_RECEIVED', qtyChange: 20, referenceId: purchase.id, notes: 'Seed purchase' },
      { shopId: shop.id, productId: products[1].id, type: 'PURCHASE_RECEIVED', qtyChange: 20, referenceId: purchase.id, notes: 'Seed purchase' }
    ]
  });

  await prisma.workerJob.createMany({ data: [ { shopId: shop.id, type: WorkerJobType.LOW_STOCK_SCAN }, { shopId: shop.id, type: WorkerJobType.DAILY_SUMMARY } ] });

  console.log('Seeded successfully');
  console.log('Owner: owner@vertexpos.local / password123');
  console.log('Manager: manager@vertexpos.local / password123');
  console.log('Cashier: cashier@vertexpos.local / password123');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
