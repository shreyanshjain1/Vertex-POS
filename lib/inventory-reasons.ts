import { prisma } from '@/lib/prisma';
import { INVENTORY_REASON_PRESETS } from '@/lib/shop-config';

export async function ensureInventoryReasons(shopId: string) {
  await prisma.$transaction(
    INVENTORY_REASON_PRESETS.map((reason) =>
      prisma.inventoryReason.upsert({
        where: {
          shopId_code: {
            shopId,
            code: reason.code
          }
        },
        update: {
          label: reason.label,
          isActive: true
        },
        create: {
          shopId,
          code: reason.code,
          label: reason.label,
          isActive: true
        }
      })
    )
  );

  return prisma.inventoryReason.findMany({
    where: {
      shopId,
      isActive: true
    },
    orderBy: { label: 'asc' }
  });
}
