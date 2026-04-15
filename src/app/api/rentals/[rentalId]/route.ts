import { NextResponse } from 'next/server';
import { getRentalStatus } from '@/lib/mrr';
import { getCachedRental, setCachedRental } from '@/lib/rentalCache';
import { createLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const log = createLogger('api/rentals');

/**
 * GET /api/rentals/:rentalId
 *
 * Proxies to MRR GET /rental/:id and returns the rental status.
 * Responses are cached for 60 seconds to avoid hammering the MRR API.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ rentalId: string }> },
) {
  try {
    const { rentalId } = await params;

    const cached = getCachedRental(rentalId);
    if (cached) {
      return NextResponse.json({ success: true, data: cached, cached: true });
    }

    const data = await getRentalStatus(rentalId);
    setCachedRental(rentalId, data);

    return NextResponse.json({ success: true, data, cached: false });
  } catch (err) {
    log.error('Failed to fetch rental status', {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch rental status' },
      { status: 500 },
    );
  }
}
