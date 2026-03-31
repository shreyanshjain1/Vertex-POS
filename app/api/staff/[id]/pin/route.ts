import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { hashPassword } from '@/lib/auth/password';
import { staffPinSchema } from '@/lib/auth/validation';
import { prisma } from '@/lib/prisma';
import { assertManagedShopAccess } from '@/lib/staff';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await requirePermission('MANAGE_STAFF');
    const body = await request.json();
    const parsed = staffPinSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid PIN.' },
        { status: 400 }
      );
    }

    const membership = await prisma.userShop.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!membership) {
      return NextResponse.json({ error: 'Staff assignment not found.' }, { status: 404 });
    }

    const hasAccess = await assertManagedShopAccess(userId, membership.shopId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'You do not have access to that staff record.' }, { status: 403 });
    }

    if (parsed.data.pin && membership.role !== 'CASHIER') {
      return NextResponse.json(
        { error: 'Quick-unlock PINs are only available for cashier assignments.' },
        { status: 400 }
      );
    }

    const nextPinHash = parsed.data.pin ? await hashPassword(parsed.data.pin) : null;
    const pinSetAt = parsed.data.pin ? new Date() : null;

    await prisma.$transaction(async (tx) => {
      await tx.userShop.update({
        where: { id },
        data: {
          staffPinHash: nextPinHash,
          pinSetAt
        }
      });

      await logActivity({
        tx,
        shopId: membership.shopId,
        userId,
        action: parsed.data.pin ? 'STAFF_PIN_UPDATED' : 'STAFF_PIN_CLEARED',
        entityType: 'UserShop',
        entityId: membership.id,
        description: `${parsed.data.pin ? 'Updated' : 'Cleared'} cashier quick-unlock PIN for ${membership.user.name ?? membership.user.email}.`
      });
    });

    return NextResponse.json({
      ok: true,
      hasPin: Boolean(nextPinHash),
      pinSetAt: pinSetAt?.toISOString() ?? null
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to update the staff PIN.');
  }
}
