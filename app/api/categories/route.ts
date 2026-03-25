import { NextResponse } from 'next/server';
import { categoryCreateSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/slug';

async function uniqueCategorySlug(shopId: string, name: string) {
  const base = slugify(name) || 'category';
  let attempt = base;
  let suffix = 2;

  while (
    await prisma.category.findFirst({
      where: { shopId, slug: attempt },
      select: { id: true }
    })
  ) {
    attempt = `${base}-${suffix++}`;
  }

  return attempt;
}

export async function GET() {
  try {
    const { shopId } = await requireRole('CASHIER');
    const categories = await prisma.category.findMany({
      where: { shopId },
      include: { _count: { select: { products: true, children: true } } },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }]
    });

    return NextResponse.json({ categories });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load categories.');
  }
}

export async function POST(request: Request) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const body = await request.json();
    const parsed = categoryCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid category.' },
        { status: 400 }
      );
    }

    const name = parsed.data.name.trim();
    const parentId = parsed.data.parentId?.trim() || null;

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

    const slug = await uniqueCategorySlug(shopId, name);

    const category = await prisma.$transaction(async (tx) => {
      const createdCategory = await tx.category.create({
        data: {
          shopId,
          name,
          slug,
          parentId
        },
        include: { _count: { select: { products: true, children: true } } }
      });

      await logActivity({
        tx,
        shopId,
        userId,
        action: 'CATEGORY_CREATED',
        entityType: 'Category',
        entityId: createdCategory.id,
        description: `Created category ${createdCategory.name}.`
      });

      return createdCategory;
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to create category.');
  }
}
