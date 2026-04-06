import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processWorkerBatch, queueOperationalJobsForShop, recoverStaleRunningJobs } from '@/lib/worker';

function isAuthorized(request: Request) {
  const secret = process.env.WORKER_CRON_SECRET;
  if (!secret) {
    return false;
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${secret}`) {
    return true;
  }

  const headerSecret = request.headers.get('x-worker-cron-secret');
  return headerSecret === secret;
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const shops = await prisma.shop.findMany({
      select: { id: true }
    });

    let queued = 0;
    for (const shop of shops) {
      const result = await queueOperationalJobsForShop(shop.id, null);
      queued += result.created;
    }

    const recovered = await recoverStaleRunningJobs();
    const processed = await processWorkerBatch(10);

    return NextResponse.json({
      ok: true,
      queued,
      recovered,
      processed,
      shops: shops.length,
      at: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown cron worker error'
      },
      { status: 500 }
    );
  }
}
