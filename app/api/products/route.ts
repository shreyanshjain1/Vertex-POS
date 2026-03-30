import { NextResponse } from 'next/server';
import { productSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { normalizeText } from '@/lib/inventory';
import { prisma } from '@/lib/prisma';
import { ensureUnitsOfMeasure } from '@/lib/uom';

function serializeProduct(product: {
  cost: { toString(): string };
  price: { toString(): string };
  createdAt: Date;
  updatedAt: Date;
  variants: Array<{
    priceOverride: { toString(): string } | null;
    costOverride: { toString(): string } | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  priceHistory: Array<{
    previousPrice: { toString(): string };
    newPrice: { toString(): string };
    effectiveDate: Date;
    createdAt: Date;
  }>;
  costHistory: Array<{
    previousCost: { toString(): string };
    newCost: { toString(): string };
    effectiveDate: Date;
    createdAt: Date;
  }>;
  images: Array<{ createdAt: Date }>;
}) {
  return {
    ...product,
    cost: product.cost.toString(),
    price: product.price.toString(),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    variants: product.variants.map((variant) => ({
      ...variant,
      priceOverride: variant.priceOverride?.toString() ?? null,
      costOverride: variant.costOverride?.toString() ?? null,
      createdAt: variant.createdAt.toISOString(),
      updatedAt: variant.updatedAt.toISOString()
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
    images: product.images.map((image) => ({
      ...image,
      createdAt: image.createdAt.toISOString()
    }))
  };
}

export async function GET() {
  try {
    const { shopId } = await requireRole('CASHIER');
    const products = await prisma.product.findMany({
      where: { shopId },
      include: {
        category: true,
        baseUnitOfMeasure: true,
        variants: {
          orderBy: { createdAt: 'asc' }
        },
        images: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
        },
        priceHistory: {
          include: {
            changedByUser: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { effectiveDate: 'desc' },
          take: 5
        },
        costHistory: {
          include: {
            changedByUser: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { effectiveDate: 'desc' },
          take: 5
        }
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }]
    });

    return NextResponse.json({ products: products.map(serializeProduct) });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load products.');
  }
}

export async function POST(request: Request) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const units = await ensureUnitsOfMeasure(shopId);
    const body = await request.json();
    const parsed = productSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid product data.' },
        { status: 400 }
      );
    }

    const payload = {
      ...parsed.data,
      name: parsed.data.name.trim(),
      description: normalizeText(parsed.data.description),
      sku: normalizeText(parsed.data.sku),
      barcode: normalizeText(parsed.data.barcode),
      categoryId: normalizeText(parsed.data.categoryId),
      changeNote: normalizeText(parsed.data.changeNote),
      variants: parsed.data.variants.map((variant) => ({
        color: normalizeText(variant.color),
        size: normalizeText(variant.size),
        flavor: normalizeText(variant.flavor),
        model: normalizeText(variant.model),
        sku: normalizeText(variant.sku),
        barcode: normalizeText(variant.barcode),
        priceOverride: variant.priceOverride ?? null,
        costOverride: variant.costOverride ?? null,
        isActive: variant.isActive
      })),
      images: parsed.data.images.map((image) => ({
        imageUrl: image.imageUrl.trim(),
        altText: normalizeText(image.altText),
        sortOrder: image.sortOrder
      }))
    };

    const unitMap = new Map(units.map((unit) => [unit.id, unit]));
    if (!unitMap.has(payload.baseUnitOfMeasureId)) {
      return NextResponse.json({ error: 'Selected base unit was not found.' }, { status: 404 });
    }

    const normalizedConversions = payload.uomConversions
      .filter((conversion) => conversion.unitOfMeasureId !== payload.baseUnitOfMeasureId)
      .filter((conversion, index, array) =>
        array.findIndex((entry) => entry.unitOfMeasureId === conversion.unitOfMeasureId) === index
      );

    for (const conversion of normalizedConversions) {
      if (!unitMap.has(conversion.unitOfMeasureId)) {
        return NextResponse.json({ error: 'One or more selected units were not found.' }, { status: 404 });
      }
    }

    const variantSkus = payload.variants.map((variant) => variant.sku).filter(Boolean) as string[];
    const variantBarcodes = payload.variants.map((variant) => variant.barcode).filter(Boolean) as string[];

    if (new Set(variantSkus.map((value) => value.toLowerCase())).size !== variantSkus.length) {
      return NextResponse.json({ error: 'Variant SKUs must be unique.' }, { status: 409 });
    }

    if (new Set(variantBarcodes).size !== variantBarcodes.length) {
      return NextResponse.json({ error: 'Variant barcodes must be unique.' }, { status: 409 });
    }

    if (payload.sku && variantSkus.some((value) => value.toLowerCase() === payload.sku!.toLowerCase())) {
      return NextResponse.json({ error: 'Base product SKU conflicts with a variant SKU.' }, { status: 409 });
    }

    if (payload.barcode && variantBarcodes.includes(payload.barcode)) {
      return NextResponse.json({ error: 'Base product barcode conflicts with a variant barcode.' }, { status: 409 });
    }

    const [category, duplicateByName, duplicateBySku, duplicateByBarcode, duplicateVariantSku, duplicateVariantBarcode, productSkuConflictWithVariant, productBarcodeConflictWithVariant] = await Promise.all([
      payload.categoryId
        ? prisma.category.findFirst({
            where: { id: payload.categoryId, shopId, isActive: true },
            select: { id: true }
          })
        : Promise.resolve(null),
      prisma.product.findFirst({
        where: {
          shopId,
          name: {
            equals: payload.name,
            mode: 'insensitive'
          }
        },
        select: { id: true }
      }),
      payload.sku
        ? prisma.product.findFirst({
            where: { shopId, sku: payload.sku },
            select: { id: true }
          })
        : Promise.resolve(null),
      payload.barcode
        ? prisma.product.findFirst({
            where: { shopId, barcode: payload.barcode },
            select: { id: true }
          })
        : Promise.resolve(null),
      variantSkus.length
        ? prisma.productVariant.findFirst({
            where: {
              sku: { in: variantSkus },
              product: { shopId }
            },
            select: { id: true, sku: true }
          })
        : Promise.resolve(null),
      variantBarcodes.length
        ? prisma.productVariant.findFirst({
            where: {
              barcode: { in: variantBarcodes },
              product: { shopId }
            },
            select: { id: true, barcode: true }
          })
        : Promise.resolve(null),
      variantSkus.length
        ? prisma.product.findFirst({
            where: {
              shopId,
              sku: { in: variantSkus }
            },
            select: { id: true, sku: true }
          })
        : Promise.resolve(null),
      variantBarcodes.length
        ? prisma.product.findFirst({
            where: {
              shopId,
              barcode: { in: variantBarcodes }
            },
            select: { id: true, barcode: true }
          })
        : Promise.resolve(null)
    ]);

    if (payload.categoryId && !category) {
      return NextResponse.json({ error: 'Selected category was not found.' }, { status: 404 });
    }

    if (duplicateByName) {
      return NextResponse.json(
        { error: 'A product with this name already exists in this shop.' },
        { status: 409 }
      );
    }

    if (duplicateBySku) {
      return NextResponse.json({ error: 'A product with this SKU already exists.' }, { status: 409 });
    }

    if (duplicateByBarcode) {
      return NextResponse.json({ error: 'A product with this barcode already exists.' }, { status: 409 });
    }

    if (duplicateVariantSku || productSkuConflictWithVariant) {
      return NextResponse.json({ error: 'A variant SKU already exists in this shop.' }, { status: 409 });
    }

    if (duplicateVariantBarcode || productBarcodeConflictWithVariant) {
      return NextResponse.json({ error: 'A variant barcode already exists in this shop.' }, { status: 409 });
    }

    const product = await prisma.$transaction(async (tx) => {
      const createdProduct = await tx.product.create({
        data: {
          shopId,
          categoryId: payload.categoryId,
          baseUnitOfMeasureId: payload.baseUnitOfMeasureId,
          sku: payload.sku,
          barcode: payload.barcode,
          name: payload.name,
          description: payload.description,
          cost: payload.cost,
          price: payload.price,
          stockQty: payload.stockQty,
          reorderPoint: payload.reorderPoint,
          trackBatches: payload.trackBatches,
          trackExpiry: payload.trackExpiry,
          uomConversions: {
            create: normalizedConversions.map((conversion) => ({
              unitOfMeasureId: conversion.unitOfMeasureId,
              ratioToBase: conversion.ratioToBase
            }))
          },
          variants: {
            create: payload.variants.map((variant) => ({
              color: variant.color,
              size: variant.size,
              flavor: variant.flavor,
              model: variant.model,
              sku: variant.sku,
              barcode: variant.barcode,
              priceOverride: variant.priceOverride,
              costOverride: variant.costOverride,
              isActive: variant.isActive
            }))
          },
          images: {
            create: payload.images.map((image) => ({
              imageUrl: image.imageUrl,
              altText: image.altText,
              sortOrder: image.sortOrder
            }))
          },
          isActive: payload.isActive
        },
        include: {
          category: {
            select: {
              id: true,
              name: true
            }
          },
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
                select: { id: true, name: true, email: true }
              }
            },
            orderBy: { effectiveDate: 'desc' },
            take: 5
          },
          costHistory: {
            include: {
              changedByUser: {
                select: { id: true, name: true, email: true }
              }
            },
            orderBy: { effectiveDate: 'desc' },
            take: 5
          }
        }
      });

      if (payload.stockQty > 0) {
        await tx.inventoryMovement.create({
          data: {
            shopId,
            productId: createdProduct.id,
            type: 'OPENING_STOCK',
            qtyChange: payload.stockQty,
            userId,
            notes: 'Opening stock from product creation'
          }
        });
      }

      await logActivity({
        tx,
        shopId,
        userId,
        action: 'PRODUCT_CREATED',
        entityType: 'Product',
        entityId: createdProduct.id,
        description: `Created product ${createdProduct.name}.`,
        metadata: {
          isActive: createdProduct.isActive,
          stockQty: createdProduct.stockQty,
          baseUnit: createdProduct.baseUnitOfMeasure?.code ?? null,
          variantCount: createdProduct.variants.length,
          imageCount: createdProduct.images.length,
          trackBatches: createdProduct.trackBatches,
          trackExpiry: createdProduct.trackExpiry
        }
      });

      return createdProduct;
    });

    return NextResponse.json({ product: serializeProduct(product) }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to create product.');
  }
}
