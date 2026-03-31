import { NextResponse } from 'next/server';
import {
  customerSchema,
  receivablePaymentSchema
} from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import {
  customerDetailInclude,
  CustomerOperationError,
  getCustomerDetailOrThrow,
  recordReceivablePayment
} from '@/lib/customer-operations';
import {
  getCustomerDisplayName,
  serializeCustomer
} from '@/lib/customers';
import { normalizeText } from '@/lib/inventory';
import { prisma } from '@/lib/prisma';

function parseDateInput(value?: string | null, message = 'Enter a valid payment date.') {
  if (!value) {
    throw new CustomerOperationError(message);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new CustomerOperationError(message);
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
    const body = await request.json().catch(() => ({}));

    if (body?.action === 'RECORD_PAYMENT') {
      const parsed = receivablePaymentSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? 'Invalid receivable payment payload.' },
          { status: 400 }
        );
      }

      const customer = await prisma.$transaction(async (tx) => {
        const existingCustomer = await getCustomerDetailOrThrow(tx, id, shopId);

        await recordReceivablePayment({
          tx,
          shopId,
          customer: existingCustomer,
          customerCreditLedgerId: parsed.data.customerCreditLedgerId,
          amount: parsed.data.amount,
          method: parsed.data.method,
          referenceNumber: parsed.data.referenceNumber,
          paidAt: parseDateInput(parsed.data.paidAt),
          userId
        });

        return getCustomerDetailOrThrow(tx, id, shopId);
      });

      return NextResponse.json({
        customer: serializeCustomer(customer)
      });
    }

    const parsed = customerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid customer payload.' },
        { status: 400 }
      );
    }

    const customer = await prisma.$transaction(async (tx) => {
      const existingCustomer = await getCustomerDetailOrThrow(tx, id, shopId);

      const updatedCustomer = await tx.customer.update({
        where: { id: existingCustomer.id },
        data: {
          type: parsed.data.type,
          firstName: normalizeText(parsed.data.firstName),
          lastName: normalizeText(parsed.data.lastName),
          businessName: normalizeText(parsed.data.businessName),
          contactPerson: normalizeText(parsed.data.contactPerson),
          taxId: normalizeText(parsed.data.taxId),
          phone: normalizeText(parsed.data.phone),
          email: normalizeText(parsed.data.email),
          address: normalizeText(parsed.data.address),
          notes: normalizeText(parsed.data.notes),
          isActive: parsed.data.isActive ?? true
        },
        include: customerDetailInclude
      });

      await logActivity({
        tx,
        shopId,
        userId,
        action: 'CUSTOMER_UPDATED',
        entityType: 'Customer',
        entityId: updatedCustomer.id,
        description: `Updated customer ${getCustomerDisplayName(updatedCustomer)}.`,
        metadata: {
          customerType: updatedCustomer.type
        }
      });

      return updatedCustomer;
    });

    return NextResponse.json({
      customer: serializeCustomer(customer)
    });
  } catch (error) {
    if (error instanceof CustomerOperationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return apiErrorResponse(error, 'Unable to update customer.');
  }
}
