import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { categoryCreateSchema } from '@/lib/auth/validation';
import { slugify } from '@/lib/slug';

async function uniqueCategorySlug(shopId: string, name: string) {
  const base = slugify(name) || 'category';
  let attempt = base;
  let i = 2;
  while (await prisma.category.findFirst({ where: { shopId, slug: attempt }, select: { id: true } })) {
    attempt = `${base}-${i++}`;
  }
  return attempt;
}

export async function GET() {
  const { shopId } = await requireRole('CASHIER');
  const categories = await prisma.category.findMany({ where: { shopId }, include: { _count: { select: { products: true, children: true } } }, orderBy: { name: 'asc' } });
  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const body = await request.json();
    const parsed = categoryCreateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid category.' }, { status: 400 });
    const slug = await uniqueCategorySlug(shopId, parsed.data.name);
    const category = await prisma.category.create({ data: { shopId, name: parsed.data.name, slug, parentId: parsed.data.parentId || null }, include: { _count: { select: { products: true, children: true } } } });
    await prisma.activityLog.create({ data: { shopId, userId, action: 'CATEGORY_CREATED', entityType: 'Category', entityId: category.id, description: `Created category ${category.name}` } });
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to create category.' }, { status: 500 });
  }
}
