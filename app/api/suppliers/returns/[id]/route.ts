import { SupplierCreditMemoStatus } from '@prisma/client';
import { NextResponse } from 'next/server';
import {
  supplierReturnCancelSchema,
  supplierReturnCreditSchema,
  supplierReturnPostSchema
} from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import {
  cancelSupplierReturn,
  getSupplierReturnDetailOrThrow,
  postSupplierReturn,
  SupplierReturnOperationError,
  updateSupplierReturnCredit
} from '@/lib/supplier-return-operations';
import { prisma } from '@/lib/prisma';
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { action?: string };

    if (!body.action) {
      return NextResponse.json({ error: 'Select a supplier return action first.' }, { status: 400 });
    }

    const supplierReturn = await prisma.$transaction(async (tx) => {
      const existingReturn = await getSupplierReturnDetailOrThrow(tx, id, shopId);

      switch (body.action) {
        case 'POST': {
          const parsed = supplierReturnPostSchema.safeParse(body);
          if (!parsed.success) {
            return NextResponse.json(
              { error: parsed.error.issues[0]?.message ?? 'Invalid supplier return update.' },
              { status: 400 }
            );
          }

          await postSupplierReturn({
            tx,
            supplierReturn: existingReturn,
            shopId,
            userId,
            postedAt: new Date()
          });
          break;
        }
        case 'CANCEL': {
          const parsed = supplierReturnCancelSchema.safeParse(body);
          if (!parsed.success) {
            return NextResponse.json(
              { error: parsed.error.issues[0]?.message ?? 'Invalid supplier return update.' },
              { status: 400 }
            );
          }

          await cancelSupplierReturn({
            tx,
            supplierReturn: existingReturn,
            shopId,
            userId
          });
          break;
        }
        case 'UPDATE_CREDIT': {
          const parsed = supplierReturnCreditSchema.safeParse(body);
          if (!parsed.success) {
            return NextResponse.json(
              { error: parsed.error.issues[0]?.message ?? 'Invalid supplier credit memo payload.' },
              { status: 400 }
            );
          }

          await updateSupplierReturnCredit({
            tx,
            supplierReturn: existingReturn,
            shopId,
            userId,
            creditMemoNumber: parsed.data.creditMemoNumber,
            creditMemoDate: parseOptionalDateInput(parsed.data.creditMemoDate),
            creditAmount: parsed.data.creditAmount,
            creditMemoStatus: parsed.data.creditMemoStatus as SupplierCreditMemoStatus,
            notes: parsed.data.notes
          });
          break;
        }
        default:
          return NextResponse.json({ error: 'Unsupported supplier return action.' }, { status: 400 });
      }

      return getSupplierReturnDetailOrThrow(tx, id, shopId);
    });

    if (supplierReturn instanceof NextResponse) {
      return supplierReturn;
    }

    return NextResponse.json({
      supplierReturn: serializeSupplierReturn(supplierReturn)
    });
  } catch (error) {
    if (error instanceof SupplierReturnOperationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return apiErrorResponse(error, 'Unable to update supplier return.');
  }
}
