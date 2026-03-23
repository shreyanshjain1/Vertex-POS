import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { supplierSchema } from '@/lib/auth/validation';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const { id } = await params;
    const body = await request.json();
    const parsed = supplierSchema.partial().safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid update.' }, { status: 400 });
    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier || supplier.shopId !== shopId) return NextResponse.json({ error: 'Supplier not found.' }, { status: 404 });
    const updated = await prisma.supplier.update({ where: { id }, data: parsed.data });
    await prisma.activityLog.create({ data: { shopId, userId, action: 'SUPPLIER_UPDATED', entityType: 'Supplier', entityId: id, description: `Updated supplier ${updated.name}` } });
    return NextResponse.json({ supplier: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to update supplier.' }, { status: 500 });
  }
}
