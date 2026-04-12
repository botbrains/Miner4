import { NextResponse } from 'next/server';
import { getAvailableRigs } from '@/lib/mrr';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const algorithm = searchParams.get('algorithm') ?? 'SHA-256';

    const rigs = await getAvailableRigs(algorithm);

    // Aggregate price statistics
    const prices = rigs
      .map(r => r.price?.BTC?.price)
      .filter((p): p is number => typeof p === 'number' && p > 0);

    const avg   = prices.length ? prices.reduce((s, p) => s + p, 0) / prices.length : null;
    const min   = prices.length ? Math.min(...prices) : null;
    const max   = prices.length ? Math.max(...prices) : null;

    return NextResponse.json({ success: true, data: { algorithm, avg, min, max, count: rigs.length } });
  } catch (err) {
    console.error('[mrr/prices] error:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch MRR prices' }, { status: 500 });
  }
}
