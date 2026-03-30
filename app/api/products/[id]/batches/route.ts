import { NextResponse } from 'next/server';
import { productBatchSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { normalizeText } from '@/lib/inventory';
import { prisma } from '@/lib/prisma';

function serializeBatch<
  T extends {
    expiryDate: Date | null;
    receivedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }
>(batch: T) {
  return {
    ...batch,
    expiryDate: batch.expiryDate?.toISOString() ?? null,
    receivedAt: batch.receivedAt.toISOString(),
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString()
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const { id } = await params;
    const body = await request.json();
    const parsed = productBatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid batch payload.' },
        { status: 400 }
      );
    }

    const product = await prisma.product.findFirst({
      where: { id, shopId }
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    if (!product.trackBatches && !product.trackExpiry) {
      return NextResponse.json(
        { error: 'Enable batch or expiry tracking on this product first.' },
        { status: 400 }
      );
    }

    const expiryDate = parsed.data.expiryDate ? new Date(parsed.data.expiryDate) : null;
    if (parsed.data.expiryDate && Number.isNaN(expiryDate?.getTime())) {
      return NextResponse.json({ error: 'Enter a valid expiry date.' }, { status: 400 });
    }

    if (product.trackExpiry && !expiryDate) {
      return NextResponse.json(
        { error: 'Expiry-tracked products require an expiry date.' },
        { status: 400 }
      );
    }

    const lotNumber = parsed.data.lotNumber.trim().toUpperCase();
    const duplicate = await prisma.productBatch.findFirst({
      where: {
        productId: product.id,
        lotNumber
      },
      select: { id: true }
    });

    if (duplicate) {
      return NextResponse.json(
        { error: 'A batch with this lot number already exists for the product.' },
        { status: 409 }
      );
    }

    const batch = await prisma.$transaction(async (tx) => {
      const createdBatch = await tx.productBatch.create({
        data: {
          shopId,
          productId: product.id,
          lotNumber,
          expiryDate,
          quantity: parsed.data.quantity,
          notes: normalizeText(parsed.data.notes)
        },
        include: {
          product: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      await logActivity({
        tx,
        shopId,
        userId,
        action: 'PRODUCT_BATCH_CREATED',
        entityType: 'ProductBatch',
        entityId: createdBatch.id,
        description: `Created batch ${createdBatch.lotNumber} for ${product.name}.`,
        metadata: {
          productId: product.id,
          productName: product.name,
          quantity: createdBatch.quantity,
          expiryDate: createdBatch.expiryDate?.toISOString() ?? null
        }
      });

      return createdBatch;
    });

    return NextResponse.json(
      {
        batch: serializeBatch(batch)
      },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error, 'Unable to create product batch.');
  }
}
