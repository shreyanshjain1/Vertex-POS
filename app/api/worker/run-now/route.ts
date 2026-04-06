import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { queueOperationalJobsForShop } from '@/lib/worker';

export async function POST(request: Request) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    await queueOperationalJobsForShop(shopId, userId);

    const referer = request.headers.get('referer');
    return NextResponse.redirect(new URL(referer || '/dashboard', request.url));
  } catch (error) {
    return apiErrorResponse(error, 'Unable to queue worker jobs.');
  }
}
