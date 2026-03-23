import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { shopId } = await requireRole('CASHIER');
  const { id } = await params;
  const sale = await prisma.sale.findFirst({ where: { id, shopId }, include: { items: true } });
  if (!sale) return NextResponse.json({ error: 'Sale not found.' }, { status: 404 });
  return NextResponse.json({ sale });
}
