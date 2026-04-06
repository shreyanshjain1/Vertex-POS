import { NotificationType, WorkerJobStatus, WorkerJobType } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const DEFAULT_STALE_JOB_MINUTES = 10;

function getStaleJobMinutes() {
  const raw = Number(process.env.WORKER_STALE_JOB_MINUTES ?? DEFAULT_STALE_JOB_MINUTES);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_STALE_JOB_MINUTES;
}

function startOfToday() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

function startOfHour(date = new Date()) {
  const value = new Date(date);
  value.setMinutes(0, 0, 0);
  return value;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

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
  const existing = await prisma.notification.findFirst({
    where: {
      shopId,
      type,
      title,
      message,
      createdAt: {
        gte: startOfToday()
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
  const start = startOfToday();
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

export async function queueOperationalJobsForShop(shopId: string, userId?: string | null) {
  const now = new Date();
  const queuedOrRunning = await prisma.workerJob.findMany({
    where: {
      shopId,
      status: { in: [WorkerJobStatus.QUEUED, WorkerJobStatus.RUNNING] },
      type: { in: [WorkerJobType.LOW_STOCK_SCAN, WorkerJobType.DAILY_SUMMARY] },
      runAt: { lte: now }
    },
    select: { type: true, createdAt: true, runAt: true }
  });

  const queuedTypes = new Set<WorkerJobType>();
  const today = startOfToday();
  const currentHour = startOfHour(now);

  for (const job of queuedOrRunning) {
    if (job.type === WorkerJobType.LOW_STOCK_SCAN) {
      if (job.runAt >= currentHour || job.createdAt >= currentHour) {
        queuedTypes.add(job.type);
      }
      continue;
    }

    if (job.type === WorkerJobType.DAILY_SUMMARY) {
      if (job.runAt >= today || isSameDay(job.createdAt, now)) {
        queuedTypes.add(job.type);
      }
    }
  }

  const data = [] as Array<{ shopId: string; type: WorkerJobType; createdById?: string | null; runAt?: Date }>;

  if (!queuedTypes.has(WorkerJobType.LOW_STOCK_SCAN)) {
    data.push({
      shopId,
      type: WorkerJobType.LOW_STOCK_SCAN,
      createdById: userId ?? null,
      runAt: now
    });
  }

  if (!queuedTypes.has(WorkerJobType.DAILY_SUMMARY)) {
    data.push({
      shopId,
      type: WorkerJobType.DAILY_SUMMARY,
      createdById: userId ?? null,
      runAt: now
    });
  }

  if (!data.length) {
    return { created: 0, skipped: 2 };
  }

  await prisma.workerJob.createMany({ data });
  return { created: data.length, skipped: 2 - data.length };
}

export async function recoverStaleRunningJobs() {
  const staleBefore = new Date(Date.now() - getStaleJobMinutes() * 60 * 1000);

  const staleJobs = await prisma.workerJob.findMany({
    where: {
      status: WorkerJobStatus.RUNNING,
      startedAt: { lte: staleBefore }
    },
    select: { id: true, error: true }
  });

  if (!staleJobs.length) {
    return 0;
  }

  await prisma.$transaction(
    staleJobs.map((job) =>
      prisma.workerJob.update({
        where: { id: job.id },
        data: {
          status: WorkerJobStatus.QUEUED,
          error: [job.error, `Recovered after stale RUNNING state at ${new Date().toISOString()}`].filter(Boolean).join(' | '),
          startedAt: null,
          finishedAt: null,
          runAt: new Date()
        }
      })
    )
  );

  return staleJobs.length;
}

export async function claimNextRunnableJob() {
  const job = await prisma.workerJob.findFirst({
    where: { status: WorkerJobStatus.QUEUED, runAt: { lte: new Date() } },
    orderBy: [{ runAt: 'asc' }, { createdAt: 'asc' }],
    select: { id: true }
  });

  if (!job) {
    return null;
  }

  const claim = await prisma.workerJob.updateMany({
    where: {
      id: job.id,
      status: WorkerJobStatus.QUEUED
    },
    data: {
      status: WorkerJobStatus.RUNNING,
      startedAt: new Date(),
      finishedAt: null,
      error: null
    }
  });

  if (claim.count !== 1) {
    return null;
  }

  return prisma.workerJob.findUnique({ where: { id: job.id } });
}

export async function processNextWorkerJob() {
  await recoverStaleRunningJobs();

  const job = await claimNextRunnableJob();
  if (!job) {
    return false;
  }

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

export async function processWorkerBatch(limit = 5) {
  let processed = 0;
  for (let index = 0; index < limit; index += 1) {
    const worked = await processNextWorkerJob();
    if (!worked) {
      break;
    }
    processed += 1;
  }
  return processed;
}
