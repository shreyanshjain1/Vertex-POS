import AppHeader from '@/components/layout/AppHeader';
import ProductManager from '@/components/products/ProductManager';
import { requirePageRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { ensureUnitsOfMeasure } from '@/lib/uom';

export default async function ProductsPage() {
  const { shopId } = await requirePageRole('MANAGER');
  const units = await ensureUnitsOfMeasure(shopId);
  const [products, categories, settings] = await Promise.all([
    prisma.product.findMany({
      where: { shopId },
      include: {
        category: true,
        baseUnitOfMeasure: true,
        uomConversions: {
          include: {
            unitOfMeasure: true
          },
          orderBy: {
            ratioToBase: 'asc'
          }
        },
        variants: {
          orderBy: { createdAt: 'asc' }
        },
        images: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
        },
        priceHistory: {
          include: {
            changedByUser: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: { effectiveDate: 'desc' },
          take: 5
        },
        costHistory: {
          include: {
            changedByUser: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: { effectiveDate: 'desc' },
          take: 5
        },
        batches: {
          orderBy: [{ expiryDate: 'asc' }, { receivedAt: 'desc' }]
        }
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }]
    }),
    prisma.category.findMany({
      where: { shopId },
      orderBy: { name: 'asc' }
    }),
    prisma.shopSetting.findUnique({ where: { shopId } })
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Products"
        subtitle="Maintain products, pricing, archive status, and reorder behavior without bypassing stock controls."
      />
      <ProductManager
        initialProducts={products.map((product) => ({
          ...product,
          cost: product.cost.toString(),
          price: product.price.toString(),
          baseUnitOfMeasure: product.baseUnitOfMeasure,
          variants: product.variants.map((variant) => ({
            ...variant,
            priceOverride: variant.priceOverride?.toString() ?? null,
            costOverride: variant.costOverride?.toString() ?? null,
            createdAt: variant.createdAt.toISOString(),
            updatedAt: variant.updatedAt.toISOString()
          })),
          images: product.images.map((image) => ({
            ...image,
            createdAt: image.createdAt.toISOString()
          })),
          priceHistory: product.priceHistory.map((entry) => ({
            ...entry,
            previousPrice: entry.previousPrice.toString(),
            newPrice: entry.newPrice.toString(),
            effectiveDate: entry.effectiveDate.toISOString(),
            createdAt: entry.createdAt.toISOString()
          })),
          costHistory: product.costHistory.map((entry) => ({
            ...entry,
            previousCost: entry.previousCost.toString(),
            newCost: entry.newCost.toString(),
            effectiveDate: entry.effectiveDate.toISOString(),
            createdAt: entry.createdAt.toISOString()
          })),
          uomConversions: product.uomConversions.map((conversion) => ({
            id: conversion.id,
            unitOfMeasureId: conversion.unitOfMeasureId,
            ratioToBase: conversion.ratioToBase,
            unitOfMeasure: conversion.unitOfMeasure
          })),
          batches: product.batches.map((batch) => ({
            id: batch.id,
            lotNumber: batch.lotNumber,
            expiryDate: batch.expiryDate?.toISOString() ?? null,
            quantity: batch.quantity
          }))
        }))}
        categories={categories}
        units={units}
        currencySymbol={settings?.currencySymbol ?? '₱'}
        lowStockThreshold={settings?.lowStockThreshold ?? 5}
        inventoryDefaults={{
          batchTrackingEnabled: settings?.batchTrackingEnabled ?? false,
          expiryTrackingEnabled: settings?.expiryTrackingEnabled ?? false,
          expiryAlertDays: settings?.expiryAlertDays ?? 30
        }}
      />
    </div>
  );
}
