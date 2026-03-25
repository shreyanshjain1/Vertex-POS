import { NextResponse } from 'next/server';
import { supplierSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { normalizeText } from '@/lib/inventory';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const { shopId } = await requireRole('CASHIER');
    const suppliers = await prisma.supplier.findMany({
      where: { shopId },
      include: { _count: { select: { purchases: true } } },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }]
    });

    return NextResponse.json({ suppliers });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load suppliers.');
  }
}

export async function POST(request: Request) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const body = await request.json();
    const parsed = supplierSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid supplier data.' },
        { status: 400 }
      );
    }

    const name = parsed.data.name.trim();
    const duplicate = await prisma.supplier.findFirst({
      where: {
        shopId,
        name: {
          equals: name,
          mode: 'insensitive'
        }
      },
      select: { id: true }
    });

    if (duplicate) {
      return NextResponse.json(
        { error: 'A supplier with this name already exists in this shop.' },
        { status: 409 }
      );
    }

    const supplier = await prisma.$transaction(async (tx) => {
      const createdSupplier = await tx.supplier.create({
        data: {
          shopId,
          name,
          contactName: normalizeText(parsed.data.contactName),
          email: normalizeText(parsed.data.email),
          phone: normalizeText(parsed.data.phone),
          address: normalizeText(parsed.data.address),
          notes: normalizeText(parsed.data.notes),
          isActive: parsed.data.isActive
        },
        include: { _count: { select: { purchases: true } } }
      });

      await logActivity({
        tx,
        shopId,
        userId,
        action: 'SUPPLIER_CREATED',
        entityType: 'Supplier',
        entityId: createdSupplier.id,
        description: `Created supplier ${createdSupplier.name}.`
      });

      return createdSupplier;
    });

    return NextResponse.json({ supplier }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to create supplier.');
  }
}
