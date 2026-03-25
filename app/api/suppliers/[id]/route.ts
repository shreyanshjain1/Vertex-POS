import { NextResponse } from 'next/server';
import { supplierSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { normalizeText } from '@/lib/inventory';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const { id } = await params;
    const body = await request.json();
    const parsed = supplierSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid update.' },
        { status: 400 }
      );
    }

    const existing = await prisma.supplier.findFirst({
      where: { id, shopId },
      include: { _count: { select: { purchases: true } } }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Supplier not found.' }, { status: 404 });
    }

    const nextName = parsed.data.name?.trim() ?? existing.name;
    const duplicate = await prisma.supplier.findFirst({
      where: {
        shopId,
        id: { not: id },
        name: {
          equals: nextName,
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
      const updatedSupplier = await tx.supplier.update({
        where: { id },
        data: {
          name: nextName,
          contactName:
            parsed.data.contactName === undefined
              ? existing.contactName
              : normalizeText(parsed.data.contactName),
          email: parsed.data.email === undefined ? existing.email : normalizeText(parsed.data.email),
          phone: parsed.data.phone === undefined ? existing.phone : normalizeText(parsed.data.phone),
          address:
            parsed.data.address === undefined
              ? existing.address
              : normalizeText(parsed.data.address),
          notes: parsed.data.notes === undefined ? existing.notes : normalizeText(parsed.data.notes),
          isActive: parsed.data.isActive ?? existing.isActive
        },
        include: { _count: { select: { purchases: true } } }
      });

      await logActivity({
        tx,
        shopId,
        userId,
        action:
          existing.isActive !== updatedSupplier.isActive
            ? updatedSupplier.isActive
              ? 'SUPPLIER_UNARCHIVED'
              : 'SUPPLIER_ARCHIVED'
            : 'SUPPLIER_UPDATED',
        entityType: 'Supplier',
        entityId: updatedSupplier.id,
        description:
          existing.isActive !== updatedSupplier.isActive
            ? `${updatedSupplier.isActive ? 'Restored' : 'Archived'} supplier ${updatedSupplier.name}.`
            : `Updated supplier ${updatedSupplier.name}.`
      });

      return updatedSupplier;
    });

    return NextResponse.json({ supplier });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to update supplier.');
  }
}
