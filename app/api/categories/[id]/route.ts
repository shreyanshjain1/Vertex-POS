import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { categoryUpdateSchema } from '@/lib/auth/validation';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const { id } = await params;
    const body = await request.json();
    const parsed = categoryUpdateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid category update.' }, { status: 400 });
    const category = await prisma.category.update({ where: { id }, data: { name: parsed.data.name, parentId: parsed.data.parentId || null, isActive: parsed.data.isActive }, include: { _count: { select: { products: true, children: true } } } });
    await prisma.activityLog.create({ data: { shopId, userId, action: 'CATEGORY_UPDATED', entityType: 'Category', entityId: category.id, description: `Updated category ${category.name}` } });
    return NextResponse.json({ category });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to update category.' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const { id } = await params;
    const category = await prisma.category.findUnique({ where: { id }, include: { _count: { select: { products: true, children: true } } } });
    if (!category || category.shopId !== shopId) return NextResponse.json({ error: 'Category not found.' }, { status: 404 });
    if (category._count.products > 0 || category._count.children > 0) return NextResponse.json({ error: 'Archive or move linked products/subcategories before deleting this category.' }, { status: 400 });
    await prisma.category.delete({ where: { id } });
    await prisma.activityLog.create({ data: { shopId, userId, action: 'CATEGORY_DELETED', entityType: 'Category', entityId: id, description: `Deleted category ${category.name}` } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to delete category.' }, { status: 500 });
  }
}
