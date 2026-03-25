import { NextResponse } from 'next/server';
import { categoryUpdateSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/slug';

async function uniqueCategorySlug(shopId: string, name: string, categoryId: string) {
  const base = slugify(name) || 'category';
  let attempt = base;
  let suffix = 2;

  while (
    await prisma.category.findFirst({
      where: {
        shopId,
        slug: attempt,
        id: { not: categoryId }
      },
      select: { id: true }
    })
  ) {
    attempt = `${base}-${suffix++}`;
  }

  return attempt;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const { id } = await params;
    const body = await request.json();
    const parsed = categoryUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid category update.' },
        { status: 400 }
      );
    }

    const existing = await prisma.category.findFirst({
      where: { id, shopId },
      include: { _count: { select: { products: true, children: true } } }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Category not found.' }, { status: 404 });
    }

    const name = parsed.data.name.trim();
    const parentId = parsed.data.parentId?.trim() || null;

    if (parentId === id) {
      return NextResponse.json(
        { error: 'A category cannot be its own parent.' },
        { status: 400 }
      );
    }

    const [parentCategory, duplicateByName] = await Promise.all([
      parentId
        ? prisma.category.findFirst({
            where: { id: parentId, shopId, isActive: true },
            select: { id: true }
          })
        : Promise.resolve(null),
      prisma.category.findFirst({
        where: {
          shopId,
          id: { not: id },
          name: {
            equals: name,
            mode: 'insensitive'
          }
        },
        select: { id: true }
      })
    ]);

    if (parentId && !parentCategory) {
      return NextResponse.json({ error: 'Parent category was not found.' }, { status: 404 });
    }

    if (duplicateByName) {
      return NextResponse.json(
        { error: 'A category with this name already exists in this shop.' },
        { status: 409 }
      );
    }

    const slug = name === existing.name ? existing.slug : await uniqueCategorySlug(shopId, name, id);

    const category = await prisma.$transaction(async (tx) => {
      const updatedCategory = await tx.category.update({
        where: { id },
        data: {
          name,
          slug,
          parentId,
          isActive: parsed.data.isActive ?? existing.isActive
        },
        include: { _count: { select: { products: true, children: true } } }
      });

      await logActivity({
        tx,
        shopId,
        userId,
        action:
          existing.isActive !== updatedCategory.isActive
            ? updatedCategory.isActive
              ? 'CATEGORY_UNARCHIVED'
              : 'CATEGORY_ARCHIVED'
            : 'CATEGORY_UPDATED',
        entityType: 'Category',
        entityId: updatedCategory.id,
        description:
          existing.isActive !== updatedCategory.isActive
            ? `${updatedCategory.isActive ? 'Restored' : 'Archived'} category ${updatedCategory.name}.`
            : `Updated category ${updatedCategory.name}.`
      });

      return updatedCategory;
    });

    return NextResponse.json({ category });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to update category.');
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const { id } = await params;

    const category = await prisma.category.findFirst({
      where: { id, shopId },
      include: { _count: { select: { products: true, children: true } } }
    });

    if (!category) {
      return NextResponse.json({ error: 'Category not found.' }, { status: 404 });
    }

    if (category._count.products > 0 || category._count.children > 0) {
      return NextResponse.json(
        { error: 'Archive or move linked products and subcategories before deleting this category.' },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.category.delete({ where: { id } });
      await logActivity({
        tx,
        shopId,
        userId,
        action: 'CATEGORY_DELETED',
        entityType: 'Category',
        entityId: id,
        description: `Deleted category ${category.name}.`
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to delete category.');
  }
}
