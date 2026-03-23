import { NotificationType, WorkerJobStatus, WorkerJobType } from '@prisma/client';
import { prisma } from '@/lib/prisma';

async function lowStockScan(jobId: string, shopId: string) {
  const settings = await prisma.shopSetting.findUnique({ where: { shopId } });
  if (!settings?.lowStockEnabled) return;
  const products = await prisma.product.findMany({ where: { shopId, isActive: true, stockQty: { lte: settings.lowStockThreshold } }, orderBy: { stockQty: 'asc' } });
  if (!products.length) return;
  await prisma.notification.create({ data: { shopId, type: NotificationType.LOW_STOCK, title: 'Low stock alert', message: `${products.length} product(s) are at or below ${settings.lowStockThreshold} units.` } });
  await prisma.activityLog.create({ data: { shopId, action: 'LOW_STOCK_SCAN_COMPLETED', entityType: 'WorkerJob', entityId: jobId, description: `Worker found ${products.length} low-stock product(s).` } });
}

async function dailySummary(jobId: string, shopId: string) {
  const start = new Date();
  start.setHours(0,0,0,0);
  const [sales, purchases] = await Promise.all([
    prisma.sale.aggregate({ where: { shopId, createdAt: { gte: start } }, _count: true, _sum: { totalAmount: true } }),
    prisma.purchaseOrder.aggregate({ where: { shopId, createdAt: { gte: start } }, _count: true, _sum: { totalAmount: true } })
  ]);
  await prisma.notification.create({ data: { shopId, type: NotificationType.DAILY_SUMMARY, title: 'Daily summary generated', message: `Sales today: ${sales._count} transaction(s), revenue ${Number(sales._sum.totalAmount ?? 0).toFixed(2)}. Purchases: ${purchases._count}, spend ${Number(purchases._sum.totalAmount ?? 0).toFixed(2)}.` } });
  await prisma.activityLog.create({ data: { shopId, action: 'DAILY_SUMMARY_GENERATED', entityType: 'WorkerJob', entityId: jobId, description: 'Worker generated the daily summary.' } });
}

async function processJob() {
  const job = await prisma.workerJob.findFirst({ where: { status: WorkerJobStatus.QUEUED, runAt: { lte: new Date() } }, orderBy: { createdAt: 'asc' } });
  if (!job) return false;
  await prisma.workerJob.update({ where: { id: job.id }, data: { status: WorkerJobStatus.RUNNING, startedAt: new Date() } });
  try {
    if (!job.shopId) throw new Error('Job is missing shopId');
    if (job.type === WorkerJobType.LOW_STOCK_SCAN) await lowStockScan(job.id, job.shopId);
    if (job.type === WorkerJobType.DAILY_SUMMARY) await dailySummary(job.id, job.shopId);
    await prisma.workerJob.update({ where: { id: job.id }, data: { status: WorkerJobStatus.COMPLETED, finishedAt: new Date() } });
  } catch (error) {
    await prisma.workerJob.update({ where: { id: job.id }, data: { status: WorkerJobStatus.FAILED, error: error instanceof Error ? error.message : 'Unknown worker error', finishedAt: new Date() } });
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
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const worked = await processJob();
    if (!worked) await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
