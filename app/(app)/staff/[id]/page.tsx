import { notFound } from 'next/navigation';
import AppHeader from '@/components/layout/AppHeader';
import StaffDetailManager from '@/components/staff/StaffDetailManager';
import { requirePagePermission } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { serializeAuthAuditLog, serializeStaffListItem } from '@/lib/serializers/staff';
import { getManagedShops } from '@/lib/staff';

export default async function StaffDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await requirePagePermission('MANAGE_STAFF');
  const shops = await getManagedShops(userId);
  const shopIds = shops.map((entry) => entry.id);

  const membership = await prisma.userShop.findFirst({
    where: {
      id,
      shopId: { in: shopIds }
    },
    include: {
      shop: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          emailVerifiedAt: true,
          forcePasswordReset: true,
          lockedUntil: true,
          authAuditLogs: {
            orderBy: { createdAt: 'desc' },
            take: 25,
            select: {
              id: true,
              action: true,
              email: true,
              ipAddress: true,
              userAgent: true,
              createdAt: true
            }
          }
        }
      }
    }
  });

  if (!membership) {
    notFound();
  }

  const serialized = serializeStaffListItem({
    ...membership,
    user: {
      ...membership.user,
      authAuditLogs: membership.user.authAuditLogs.filter((log) => log.action === 'LOGIN_SUCCESS')
    }
  });

  return (
    <div className="space-y-6">
      <AppHeader
        title={membership.user.name ?? membership.user.email}
        subtitle="Review this staff profile, adjust the current assignment, generate a reset link, and inspect recent auth activity."
      />
      <StaffDetailManager
        initialStaff={{
          ...serialized,
          authActivity: membership.user.authAuditLogs.map(serializeAuthAuditLog),
          hasPin: Boolean(membership.staffPinHash),
          pinSetAt: membership.pinSetAt?.toISOString() ?? null,
          emailVerifiedAt: membership.user.emailVerifiedAt?.toISOString() ?? null,
          forcePasswordReset: membership.user.forcePasswordReset,
          lockedUntil: membership.user.lockedUntil?.toISOString() ?? null
        }}
        shops={shops}
      />
    </div>
  );
}
