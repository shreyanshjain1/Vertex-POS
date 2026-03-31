import { NextResponse } from 'next/server';
import {
  purchaseReceiptSchema,
  purchaseStatusUpdateSchema,
  supplierInvoiceSchema,
  supplierPaymentSchema
} from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { normalizeText } from '@/lib/inventory';
import {
  getPurchaseDetailOrThrow,
  PurchaseOperationError,
  receivePurchaseOrder,
  recordSupplierPayment,
  updatePurchaseStatus,
  upsertPurchaseInvoice
} from '@/lib/purchase-operations';
import { prisma } from '@/lib/prisma';
import { serializePurchase } from '@/lib/purchases';

function parseDateInput(value: string, label: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new PurchaseOperationError(`Enter a valid ${label}.`);
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
      return NextResponse.json({ error: 'Select a purchase action first.' }, { status: 400 });
    }

    const purchase = await prisma.$transaction(async (tx) => {
      const existingPurchase = await getPurchaseDetailOrThrow(tx, id, shopId);

      switch (body.action) {
        case 'UPDATE_STATUS': {
          const parsed = purchaseStatusUpdateSchema.safeParse(body);

          if (!parsed.success) {
            return NextResponse.json(
              { error: parsed.error.issues[0]?.message ?? 'Invalid purchase update.' },
              { status: 400 }
            );
          }

          if (parsed.data.status === existingPurchase.status) {
            if (parsed.data.notes === undefined) {
              return NextResponse.json({ error: 'No purchase changes were provided.' }, { status: 400 });
            }

            await tx.purchaseOrder.update({
              where: { id: existingPurchase.id },
              data: {
                notes: normalizeText(parsed.data.notes)
              }
            });

            await logActivity({
              tx,
              shopId,
              userId,
              action: 'PURCHASE_UPDATED',
              entityType: 'PurchaseOrder',
              entityId: existingPurchase.id,
              description: `Updated notes for purchase ${existingPurchase.purchaseNumber}.`
            });
          } else {
            await updatePurchaseStatus({
              tx,
              purchase: existingPurchase,
              shopId,
              userId,
              nextStatus: parsed.data.status,
              notes: parsed.data.notes
            });
          }

          break;
        }
        case 'RECEIVE': {
          const parsed = purchaseReceiptSchema.safeParse(body);

          if (!parsed.success) {
            return NextResponse.json(
              { error: parsed.error.issues[0]?.message ?? 'Invalid receipt payload.' },
              { status: 400 }
            );
          }

          await receivePurchaseOrder({
            tx,
            purchase: existingPurchase,
            shopId,
            userId,
            receivedAt: parsed.data.receivedAt
              ? parseDateInput(parsed.data.receivedAt, 'receive date')
              : new Date(),
            notes: parsed.data.notes,
            items: parsed.data.items
          });

          break;
        }
        case 'UPSERT_INVOICE': {
          const parsed = supplierInvoiceSchema.safeParse(body);

          if (!parsed.success) {
            return NextResponse.json(
              { error: parsed.error.issues[0]?.message ?? 'Invalid supplier invoice payload.' },
              { status: 400 }
            );
          }

          const invoiceDate = parseDateInput(parsed.data.invoiceDate, 'invoice date');
          const dueDate = parseDateInput(parsed.data.dueDate, 'due date');

          if (dueDate.getTime() < invoiceDate.getTime()) {
            return NextResponse.json(
              { error: 'Due date must be on or after the invoice date.' },
              { status: 400 }
            );
          }

          await upsertPurchaseInvoice({
            tx,
            purchase: existingPurchase,
            shopId,
            userId,
            invoiceNumber: parsed.data.invoiceNumber.trim(),
            invoiceDate,
            dueDate,
            totalAmount: parsed.data.totalAmount,
            notes: parsed.data.notes
          });

          break;
        }
        case 'RECORD_PAYMENT': {
          const parsed = supplierPaymentSchema.safeParse(body);

          if (!parsed.success) {
            return NextResponse.json(
              { error: parsed.error.issues[0]?.message ?? 'Invalid supplier payment payload.' },
              { status: 400 }
            );
          }

          await recordSupplierPayment({
            tx,
            purchase: existingPurchase,
            shopId,
            userId,
            method: parsed.data.method,
            amount: parsed.data.amount,
            referenceNumber: parsed.data.referenceNumber,
            paidAt: parseDateInput(parsed.data.paidAt, 'payment date')
          });

          break;
        }
        default:
          return NextResponse.json({ error: 'Unsupported purchase action.' }, { status: 400 });
      }

      return getPurchaseDetailOrThrow(tx, id, shopId);
    });

    if (purchase instanceof NextResponse) {
      return purchase;
    }

    return NextResponse.json({
      purchase: serializePurchase(purchase)
    });
  } catch (error) {
    if (error instanceof PurchaseOperationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return apiErrorResponse(error, 'Unable to update purchase.');
  }
}
