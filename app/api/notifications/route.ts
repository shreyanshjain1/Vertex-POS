import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/api';
import { getActiveShopContextOrThrow } from '@/lib/auth/get-active-shop';
import { ensureOperationalNotifications } from '@/lib/notifications';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const { shopId } = await getActiveShopContextOrThrow();
    await ensureOperationalNotifications(shopId);

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { shopId },
        orderBy: { createdAt: 'desc' },
        take: 12
      }),
      prisma.notification.count({
        where: {
          shopId,
          isRead: false
        }
      })
    ]);

    return NextResponse.json({
      notifications: notifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        isRead: notification.isRead,
        createdAt: notification.createdAt.toISOString()
      })),
      unreadCount
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load notifications.');
  }
}

export async function PATCH() {
  try {
    const { shopId } = await getActiveShopContextOrThrow();

    await prisma.notification.updateMany({
      where: {
        shopId,
        isRead: false
      },
      data: {
        isRead: true
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to update notifications.');
  }
}
