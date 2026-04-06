import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');

    await prisma.workerJob.createMany({
      data: [
        { shopId, type: 'LOW_STOCK_SCAN', createdById: userId },
        { shopId, type: 'DAILY_SUMMARY', createdById: userId }
      ]
    });

    const referer = request.headers.get('referer');
    return NextResponse.redirect(new URL(referer || '/dashboard', request.url));
  } catch (error) {
    return apiErrorResponse(error, 'Unable to queue worker jobs.');
  }
}
