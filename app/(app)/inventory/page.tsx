import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import InventoryManager from '@/components/inventory/InventoryManager';
import Button from '@/components/ui/Button';
import { requirePageRole } from '@/lib/authz';
import { ensureInventoryReasons } from '@/lib/inventory-reasons';
import { prisma } from '@/lib/prisma';
import { ensureUnitsOfMeasure } from '@/lib/uom';

export default async function InventoryPage() {
  const { shopId } = await requirePageRole('MANAGER');
  const reasons = await ensureInventoryReasons(shopId);
  await ensureUnitsOfMeasure(shopId);

  const [settings, products, movements, batches] = await Promise.all([
    prisma.shopSetting.findUnique({ where: { shopId } }),
    prisma.product.findMany({
      where: { shopId },
      include: {
        baseUnitOfMeasure: true,
        uomConversions: {
          include: {
            unitOfMeasure: true
          },
          orderBy: {
            ratioToBase: 'asc'
          }
        },
        batches: {
          orderBy: [{ expiryDate: 'asc' }, { receivedAt: 'desc' }]
        }
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }]
    }),
    prisma.inventoryMovement.findMany({
      where: { shopId },
      include: {
        product: true,
        reason: true
      },
      orderBy: { createdAt: 'desc' },
      take: 80
    }),
    prisma.productBatch.findMany({
      where: { shopId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            trackBatches: true,
            trackExpiry: true
          }
        }
      },
      orderBy: [{ expiryDate: 'asc' }, { receivedAt: 'desc' }],
      take: 120
    })
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Inventory"
        subtitle="Adjust stock manually, export the live catalog, and review the full movement history with clear status signals."
        actions={
          <Link href="/api/inventory/export">
            <Button type="button" variant="secondary">
              Export inventory CSV
            </Button>
          </Link>
        }
      />

      <InventoryManager
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          stockQty: product.stockQty,
          reorderPoint: product.reorderPoint,
          baseUnitOfMeasure: product.baseUnitOfMeasure,
          uomConversions: product.uomConversions.map((conversion) => ({
            id: conversion.id,
            unitOfMeasureId: conversion.unitOfMeasureId,
            ratioToBase: conversion.ratioToBase,
            unitOfMeasure: conversion.unitOfMeasure
          })),
          trackBatches: product.trackBatches,
          trackExpiry: product.trackExpiry,
          batches: product.batches.map((batch) => ({
            id: batch.id,
            lotNumber: batch.lotNumber,
            expiryDate: batch.expiryDate?.toISOString() ?? null,
            quantity: batch.quantity
          })),
          isActive: product.isActive
        }))}
        reasons={reasons.map((reason) => ({
          id: reason.id,
          code: reason.code,
          label: reason.label
        }))}
        batches={batches.map((batch) => ({
          id: batch.id,
          lotNumber: batch.lotNumber,
          expiryDate: batch.expiryDate?.toISOString() ?? null,
          quantity: batch.quantity,
          receivedAt: batch.receivedAt.toISOString(),
          notes: batch.notes,
          product: {
            id: batch.product.id,
            name: batch.product.name,
            sku: batch.product.sku,
            trackBatches: batch.product.trackBatches,
            trackExpiry: batch.product.trackExpiry
          }
        }))}
        movements={movements.map((movement) => ({
          id: movement.id,
          type: movement.type,
          qtyChange: movement.qtyChange,
          referenceId: movement.referenceId,
          notes: movement.notes,
          reasonLabel: movement.reason?.label ?? null,
          reasonCode: movement.reason?.code ?? null,
          createdAt: movement.createdAt.toISOString(),
          product: {
            id: movement.product.id,
            name: movement.product.name,
            sku: movement.product.sku,
            barcode: movement.product.barcode
          }
        }))}
        lowStockThreshold={settings?.lowStockThreshold ?? 5}
        inventoryFeatures={{
          batchTrackingEnabled: settings?.batchTrackingEnabled ?? false,
          expiryTrackingEnabled: settings?.expiryTrackingEnabled ?? false,
          fefoEnabled: settings?.fefoEnabled ?? false,
          expiryAlertDays: settings?.expiryAlertDays ?? 30
        }}
      />
    </div>
  );
}
