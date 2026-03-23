import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { supplierSchema } from '@/lib/auth/validation';

export async function GET() {
  const { shopId } = await requireRole('CASHIER');
  const suppliers = await prisma.supplier.findMany({ where: { shopId }, orderBy: { name: 'asc' } });
  return NextResponse.json({ suppliers });
}

export async function POST(request: Request) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const body = await request.json();
    const parsed = supplierSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid supplier data.' }, { status: 400 });
    const supplier = await prisma.supplier.create({ data: { shopId, ...parsed.data } });
    await prisma.activityLog.create({ data: { shopId, userId, action: 'SUPPLIER_CREATED', entityType: 'Supplier', entityId: supplier.id, description: `Created supplier ${supplier.name}` } });
    return NextResponse.json({ supplier }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to create supplier.' }, { status: 500 });
  }
}
