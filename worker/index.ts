import { NotificationType, WorkerJobStatus, WorkerJobType } from '@prisma/client';
import { prisma } from '../lib/prisma';

async function createNotificationOncePerDay({
  shopId,
  type,
  title,
  message
}: {
  shopId: string;
  type: NotificationType;
  title: string;
  message: string;
}) {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const existing = await prisma.notification.findFirst({
    where: {
      shopId,
      type,
      title,
      message,
      createdAt: {
        gte: dayStart
      }
    },
    select: { id: true }
  });

  if (!existing) {
    await prisma.notification.create({
      data: { shopId, type, title, message }
    });
  }
}

async function lowStockScan(jobId: string, shopId: string) {
  const settings = await prisma.shopSetting.findUnique({ where: { shopId } });
  if (!settings?.lowStockEnabled) {
    return;
  }

  const products = await prisma.product.findMany({
    where: {
      shopId,
      isActive: true,
      stockQty: { lte: settings.lowStockThreshold }
    },
    orderBy: { stockQty: 'asc' }
  });

  if (!products.length) {
    return;
  }

  await createNotificationOncePerDay({
    shopId,
    type: NotificationType.LOW_STOCK,
    title: 'Low stock alert',
    message: `${products.length} product(s) are at or below ${settings.lowStockThreshold} units.`
  });

  await prisma.activityLog.create({
    data: {
      shopId,
      action: 'LOW_STOCK_SCAN_COMPLETED',
      entityType: 'WorkerJob',
      entityId: jobId,
      description: `Worker found ${products.length} low-stock product(s).`
    }
  });
}

async function dailySummary(jobId: string, shopId: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const settings = await prisma.shopSetting.findUnique({ where: { shopId } });

  const [sales, purchaseReceipts] = await Promise.all([
    prisma.sale.aggregate({
      where: { shopId, status: 'COMPLETED', createdAt: { gte: start } },
      _count: true,
      _sum: { totalAmount: true }
    }),
    prisma.purchaseReceipt.findMany({
      where: { shopId, receivedAt: { gte: start } },
      select: {
        purchaseId: true,
        items: {
          select: {
            qtyReceived: true,
            purchaseItem: {
              select: {
                unitCost: true
              }
            }
          }
        }
      }
    })
  ]);

  const purchaseSpend = purchaseReceipts.reduce(
    (sum, receipt) =>
      sum +
      receipt.items.reduce(
        (receiptSum, item) => receiptSum + item.qtyReceived * Number(item.purchaseItem.unitCost.toString()),
        0
      ),
    0
  );
  const purchaseCount = new Set(purchaseReceipts.map((receipt) => receipt.purchaseId)).size;
  const currency = settings?.currencySymbol ?? 'PHP ';

  await createNotificationOncePerDay({
    shopId,
    type: NotificationType.DAILY_SUMMARY,
    title: 'Daily summary generated',
    message: `Sales today: ${sales._count} transaction(s), revenue ${currency}${Number(sales._sum.totalAmount ?? 0).toFixed(2)}. Purchases received: ${purchaseCount}, spend ${currency}${purchaseSpend.toFixed(2)}.`
  });

  await prisma.activityLog.create({
    data: {
      shopId,
      action: 'DAILY_SUMMARY_GENERATED',
      entityType: 'WorkerJob',
      entityId: jobId,
      description: 'Worker generated the daily summary.'
    }
  });
}

async function processJob() {
  const job = await prisma.workerJob.findFirst({
    where: { status: WorkerJobStatus.QUEUED, runAt: { lte: new Date() } },
    orderBy: { createdAt: 'asc' }
  });

  if (!job) {
    return false;
  }

  await prisma.workerJob.update({
    where: { id: job.id },
    data: { status: WorkerJobStatus.RUNNING, startedAt: new Date() }
  });

  try {
    if (!job.shopId) {
      throw new Error('Job is missing shopId');
    }

    if (job.type === WorkerJobType.LOW_STOCK_SCAN) {
      await lowStockScan(job.id, job.shopId);
    }

    if (job.type === WorkerJobType.DAILY_SUMMARY) {
      await dailySummary(job.id, job.shopId);
    }

    await prisma.workerJob.update({
      where: { id: job.id },
      data: { status: WorkerJobStatus.COMPLETED, finishedAt: new Date() }
    });
  } catch (error) {
    await prisma.workerJob.update({
      where: { id: job.id },
      data: {
        status: WorkerJobStatus.FAILED,
        error: error instanceof Error ? error.message : 'Unknown worker error',
        finishedAt: new Date()
      }
    });
  }

  return true;
}

async function main() {
  const once = process.argv.includes('--once');
  if (once) {
    await processJob();
    await prisma.$disconnect();
    return;
  }

  for (;;) {
    const worked = await processJob();
    if (!worked) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
