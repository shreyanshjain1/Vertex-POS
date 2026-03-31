import { NextResponse } from 'next/server';
import { customerSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import {
  customerDetailInclude,
  CustomerOperationError
} from '@/lib/customer-operations';
import {
  getCustomerDisplayName,
  serializeCustomer
} from '@/lib/customers';
import { normalizeText } from '@/lib/inventory';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const { shopId } = await requireRole('MANAGER');
    const customers = await prisma.customer.findMany({
      where: { shopId },
      include: customerDetailInclude,
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }]
    });

    return NextResponse.json({
      customers: customers.map(serializeCustomer)
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load customers.');
  }
}

export async function POST(request: Request) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const body = await request.json();
    const parsed = customerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid customer payload.' },
        { status: 400 }
      );
    }

    const customer = await prisma.$transaction(async (tx) => {
      const createdCustomer = await tx.customer.create({
        data: {
          shopId,
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
        action: 'CUSTOMER_CREATED',
        entityType: 'Customer',
        entityId: createdCustomer.id,
        description: `Created customer ${getCustomerDisplayName(createdCustomer)}.`,
        metadata: {
          customerType: createdCustomer.type
        }
      });

      return createdCustomer;
    });

    return NextResponse.json(
      {
        customer: serializeCustomer(customer)
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof CustomerOperationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return apiErrorResponse(error, 'Unable to create customer.');
  }
}
