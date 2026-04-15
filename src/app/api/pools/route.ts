import { NextResponse } from 'next/server';
import { POOLS } from '@/config/pools';

export const dynamic = 'force-dynamic';

/**
 * GET /api/pools?algorithm=SHA-256
 *
 * Returns the curated list of solo mining pools for the requested algorithm.
 * If no algorithm filter is provided, all pools are returned.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const algorithm = searchParams.get('algorithm');

  const pools = algorithm
    ? POOLS.filter(p => p.algorithm === algorithm)
    : POOLS;

  return NextResponse.json({ success: true, data: pools });
}
