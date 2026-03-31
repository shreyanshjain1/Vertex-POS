import { DocumentSequenceType, SupplierCreditMemoStatus } from '@prisma/client';
import { NextResponse } from 'next/server';
import { supplierReturnSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { getNextDocumentNumber } from '@/lib/document-sequence';
import { normalizeText, roundCurrency } from '@/lib/inventory';
import { prisma } from '@/lib/prisma';
import {
  getSupplierReturnDetailOrThrow,
  postSupplierReturn,
  supplierReturnDetailInclude,
  SupplierReturnOperationError,
  validateSupplierCreditMemoInput
} from '@/lib/supplier-return-operations';
import { serializeSupplierReturn } from '@/lib/supplier-returns';

function parseOptionalDateInput(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new SupplierReturnOperationError('Enter a valid credit memo date.');
  }

  return parsed;
}

export async function GET() {
  try {
    const { shopId } = await requireRole('MANAGER');
    const supplierReturns = await prisma.supplierReturn.findMany({
      where: { shopId },
      include: supplierReturnDetailInclude,
      orderBy: [{ createdAt: 'desc' }]
    });

    return NextResponse.json({
      supplierReturns: supplierReturns.map(serializeSupplierReturn)
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load supplier returns.');
  }
}

export async function POST(request: Request) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const body = await request.json();
    const parsed = supplierReturnSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid supplier return payload.' },
        { status: 400 }
      );
    }

    const creditMemoDate = parseOptionalDateInput(parsed.data.creditMemoDate);
    validateSupplierCreditMemoInput({
      creditMemoNumber: parsed.data.creditMemoNumber,
      creditMemoDate,
      creditAmount: parsed.data.creditAmount,
      creditMemoStatus: parsed.data.creditMemoStatus as SupplierCreditMemoStatus
    });

    const [supplier, products] = await Promise.all([
      prisma.supplier.findFirst({
        where: {
          id: parsed.data.supplierId,
          shopId,
          isActive: true
        }
      }),
      prisma.product.findMany({
        where: {
          shopId,
          id: { in: parsed.data.items.map((item) => item.productId) }
        },
        select: {
          id: true,
          name: true,
          cost: true
        }
      })
    ]);

    if (!supplier) {
      return NextResponse.json({ error: 'Selected supplier was not found or is archived.' }, { status: 404 });
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    for (const item of parsed.data.items) {
      if (!productMap.has(item.productId)) {
        return NextResponse.json(
          { error: 'One or more selected products were not found.' },
          { status: 404 }
        );
      }
    }

    const supplierReturn = await prisma.$transaction(async (tx) => {
      const returnNumber = await getNextDocumentNumber(tx, {
        shopId,
        type: DocumentSequenceType.RETURN,
        prefix: 'RTS'
      });

      const createdReturn = await tx.supplierReturn.create({
        data: {
          shopId,
          supplierId: supplier.id,
          createdByUserId: userId,
          status: 'DRAFT',
          returnNumber,
          reasonSummary: parsed.data.reasonSummary.trim(),
          notes: normalizeText(parsed.data.notes),
          creditMemoNumber: normalizeText(parsed.data.creditMemoNumber),
          creditMemoDate,
          creditAmount: roundCurrency(parsed.data.creditAmount),
          creditMemoStatus: parsed.data.creditMemoStatus as SupplierCreditMemoStatus,
          items: {
            create: parsed.data.items.map((item) => ({
              productId: item.productId,
              productNameSnapshot: productMap.get(item.productId)!.name,
              qty: item.qty,
              unitCost: roundCurrency(item.unitCost),
              lineTotal: roundCurrency(item.qty * item.unitCost),
              reason: item.reason,
              disposition: item.disposition
            }))
          }
        }
      });

      await logActivity({
        tx,
        shopId,
        userId,
        action: 'SUPPLIER_RETURN_CREATED',
        entityType: 'SupplierReturn',
        entityId: createdReturn.id,
        description: `Created supplier return ${createdReturn.returnNumber}.`,
        metadata: {
          supplierName: supplier.name,
          lineCount: parsed.data.items.length
        }
      });

      if (parsed.data.status === 'POSTED') {
        const detail = await getSupplierReturnDetailOrThrow(tx, createdReturn.id, shopId);
        await postSupplierReturn({
          tx,
          supplierReturn: detail,
          shopId,
          userId,
          postedAt: new Date()
        });
      }

      return getSupplierReturnDetailOrThrow(tx, createdReturn.id, shopId);
    });

    return NextResponse.json(
      {
        supplierReturn: serializeSupplierReturn(supplierReturn)
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof SupplierReturnOperationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return apiErrorResponse(error, 'Unable to create supplier return.');
  }
}
