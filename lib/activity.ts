import { Prisma } from '@prisma/client';

type ActivityInput = {
  tx: Prisma.TransactionClient;
  shopId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  description: string;
  metadata?: Prisma.InputJsonValue | null;
};

export async function logActivity({
  tx,
  shopId,
  userId,
  action,
  entityType,
  entityId,
  description,
  metadata
}: ActivityInput) {
  return tx.activityLog.create({
    data: {
      shopId,
      userId: userId ?? null,
      action,
      entityType,
      entityId: entityId ?? null,
      description,
      metadata: metadata ?? undefined
    }
  });
}
