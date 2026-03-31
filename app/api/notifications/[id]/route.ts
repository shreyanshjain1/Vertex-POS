import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/api';
import { getActiveShopContextOrThrow } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { shopId } = await getActiveShopContextOrThrow();
    const { id } = await params;

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        shopId
      },
      select: { id: true }
    });

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to update notification.');
  }
}
