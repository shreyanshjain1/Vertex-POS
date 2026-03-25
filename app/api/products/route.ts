import { NextResponse } from 'next/server';
import { productSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { normalizeText } from '@/lib/inventory';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const { shopId } = await requireRole('CASHIER');
    const products = await prisma.product.findMany({
      where: { shopId },
      include: { category: true },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }]
    });

    return NextResponse.json({ products });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load products.');
  }
}

export async function POST(request: Request) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
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
      categoryId: normalizeText(parsed.data.categoryId)
    };

    const [category, duplicateByName, duplicateBySku, duplicateByBarcode] = await Promise.all([
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
      return NextResponse.json(
        { error: 'A product with this barcode already exists.' },
        { status: 409 }
      );
    }

    const product = await prisma.$transaction(async (tx) => {
      const createdProduct = await tx.product.create({
        data: {
          shopId,
          categoryId: payload.categoryId,
          sku: payload.sku,
          barcode: payload.barcode,
          name: payload.name,
          description: payload.description,
          cost: payload.cost,
          price: payload.price,
          stockQty: payload.stockQty,
          reorderPoint: payload.reorderPoint,
          isActive: payload.isActive
        },
        include: {
          category: {
            select: {
              id: true,
              name: true
            }
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
          stockQty: createdProduct.stockQty
        }
      });

      return createdProduct;
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to create product.');
  }
}
