import { AuthAuditLog, Shop, ShopRole, User, UserShop } from '@prisma/client';
import type { PermissionKey } from '@/lib/permissions';

type StaffMembershipRecord = UserShop & {
  shop: Pick<Shop, 'id' | 'name' | 'slug'>;
  user: Pick<User, 'id' | 'name' | 'email'> & {
    authAuditLogs?: Array<Pick<AuthAuditLog, 'id' | 'action' | 'createdAt' | 'ipAddress' | 'userAgent'>>;
  };
};

export type SerializedStaffListItem = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: ShopRole;
  shopId: string;
  shopName: string;
  shopSlug: string;
  isActive: boolean;
  assignedAt: string;
  disabledAt: string | null;
  lastLogin: string | null;
  customPermissions: PermissionKey[];
};

export function serializeStaffListItem(record: StaffMembershipRecord): SerializedStaffListItem {
  return {
    id: record.id,
    userId: record.userId,
    name: record.user.name ?? record.user.email.split('@')[0],
    email: record.user.email,
    role: record.role,
    shopId: record.shopId,
    shopName: record.shop.name,
    shopSlug: record.shop.slug,
    isActive: record.isActive,
    assignedAt: record.assignedAt.toISOString(),
    disabledAt: record.disabledAt?.toISOString() ?? null,
    lastLogin: record.user.authAuditLogs?.[0]?.createdAt.toISOString() ?? null,
    customPermissions: Array.isArray(record.customPermissions)
      ? (record.customPermissions.filter((value): value is PermissionKey => typeof value === 'string') as PermissionKey[])
      : []
  };
}

export type SerializedAuthAuditLog = {
  id: string;
  action: string;
  email: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type SerializedStaffDetail = SerializedStaffListItem & {
  authActivity: SerializedAuthAuditLog[];
};

export function serializeAuthAuditLog(log: Pick<AuthAuditLog, 'id' | 'action' | 'email' | 'ipAddress' | 'userAgent' | 'createdAt'>): SerializedAuthAuditLog {
  return {
    id: log.id,
    action: log.action,
    email: log.email,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    createdAt: log.createdAt.toISOString()
  };
}
