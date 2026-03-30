import { NextResponse } from 'next/server';
import { productUpdateSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { normalizeText } from '@/lib/inventory';
import { prisma } from '@/lib/prisma';
import { ensureUnitsOfMeasure } from '@/lib/uom';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const units = await ensureUnitsOfMeasure(shopId);
    const { id } = await params;
    const body = await request.json();
    const parsed = productUpdateSchema.safeParse({ ...body, id });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid update.' },
        { status: 400 }
      );
    }

    const existing = await prisma.product.findFirst({
      where: { id, shopId },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        baseUnitOfMeasure: true,
        uomConversions: true
      }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    const nextName = parsed.data.name?.trim() ?? existing.name;
    const nextBaseUnitId = parsed.data.baseUnitOfMeasureId ?? existing.baseUnitOfMeasureId;
    const nextCategoryId =
      parsed.data.categoryId === undefined
        ? existing.categoryId
        : normalizeText(parsed.data.categoryId);
    const nextSku =
      parsed.data.sku === undefined ? existing.sku : normalizeText(parsed.data.sku);
    const nextBarcode =
      parsed.data.barcode === undefined ? existing.barcode : normalizeText(parsed.data.barcode);
    const unitMap = new Map(units.map((unit) => [unit.id, unit]));
    const normalizedConversions =
      parsed.data.uomConversions === undefined
        ? existing.uomConversions.map((conversion) => ({
            unitOfMeasureId: conversion.unitOfMeasureId,
            ratioToBase: conversion.ratioToBase
          }))
        : parsed.data.uomConversions
            .filter((conversion) => conversion.unitOfMeasureId !== nextBaseUnitId)
            .filter((conversion, index, array) =>
              array.findIndex((entry) => entry.unitOfMeasureId === conversion.unitOfMeasureId) === index
            );

    if (parsed.data.stockQty !== undefined && parsed.data.stockQty !== existing.stockQty) {
      return NextResponse.json(
        { error: 'Change stock using inventory adjustments or purchases instead.' },
        { status: 400 }
      );
    }

    const [category, duplicateByName, duplicateBySku, duplicateByBarcode] = await Promise.all([
      nextCategoryId
        ? prisma.category.findFirst({
            where: { id: nextCategoryId, shopId, isActive: true },
            select: { id: true }
          })
        : Promise.resolve(null),
      prisma.product.findFirst({
        where: {
          shopId,
          id: { not: id },
          name: {
            equals: nextName,
            mode: 'insensitive'
          }
        },
        select: { id: true }
      }),
      nextSku
        ? prisma.product.findFirst({
            where: { shopId, id: { not: id }, sku: nextSku },
            select: { id: true }
          })
        : Promise.resolve(null),
      nextBarcode
        ? prisma.product.findFirst({
            where: { shopId, id: { not: id }, barcode: nextBarcode },
            select: { id: true }
          })
        : Promise.resolve(null)
    ]);

    if (nextCategoryId && !category) {
      return NextResponse.json({ error: 'Selected category was not found.' }, { status: 404 });
    }

    if (!nextBaseUnitId || !unitMap.has(nextBaseUnitId)) {
      return NextResponse.json({ error: 'Selected base unit was not found.' }, { status: 404 });
    }

    for (const conversion of normalizedConversions) {
      if (!unitMap.has(conversion.unitOfMeasureId)) {
        return NextResponse.json({ error: 'One or more selected units were not found.' }, { status: 404 });
      }
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
      return NextResponse.json(
        { error: 'A product with this barcode already exists.' },
        { status: 409 }
      );
    }

    const updatedProduct = await prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id },
        data: {
          categoryId: nextCategoryId,
          baseUnitOfMeasureId: nextBaseUnitId,
          sku: nextSku,
          barcode: nextBarcode,
          name: nextName,
          description:
            parsed.data.description === undefined
              ? existing.description
              : normalizeText(parsed.data.description),
          cost: parsed.data.cost ?? existing.cost,
          price: parsed.data.price ?? existing.price,
          reorderPoint: parsed.data.reorderPoint ?? existing.reorderPoint,
          trackBatches: parsed.data.trackBatches ?? existing.trackBatches,
          trackExpiry: parsed.data.trackExpiry ?? existing.trackExpiry,
          uomConversions: {
            deleteMany: {},
            create: normalizedConversions.map((conversion) => ({
              unitOfMeasureId: conversion.unitOfMeasureId,
              ratioToBase: conversion.ratioToBase
            }))
          },
          isActive: parsed.data.isActive ?? existing.isActive
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
          }
        }
      });

      await logActivity({
        tx,
        shopId,
        userId,
        action:
          existing.isActive !== product.isActive
            ? product.isActive
              ? 'PRODUCT_UNARCHIVED'
              : 'PRODUCT_ARCHIVED'
            : 'PRODUCT_UPDATED',
        entityType: 'Product',
        entityId: product.id,
        description:
          existing.isActive !== product.isActive
            ? `${product.isActive ? 'Restored' : 'Archived'} product ${product.name}.`
            : `Updated product ${product.name}.`,
        metadata: {
          previousName: existing.name,
          isActive: product.isActive,
          baseUnit: product.baseUnitOfMeasure?.code ?? null,
          trackBatches: product.trackBatches,
          trackExpiry: product.trackExpiry
        }
      });

      return product;
    });

    return NextResponse.json({ product: updatedProduct });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to update product.');
  }
}
