import { NextResponse } from 'next/server';
import { getAvailableRigs, hasMrrKeys, type MrrRig } from '@/lib/mrr';

export const dynamic = 'force-dynamic';

export interface MrrMarketData {
  algorithm: string;
  count: number;
  avgBtcPerHash: number | null;
  minBtcPerHash: number | null;
  maxBtcPerHash: number | null;
  topRigs: Array<{
    id: number;
    name: string;
    hashrate: number;
    hashrateUnit: string;
    priceBtc: number;
  }>;
  keysConfigured: boolean;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const algorithm = searchParams.get('algorithm') ?? 'SHA-256';

  if (!hasMrrKeys()) {
    return NextResponse.json<{ success: false; data: MrrMarketData }>({
      success: false,
      data: {
        algorithm,
        count: 0,
        avgBtcPerHash: null,
        minBtcPerHash: null,
        maxBtcPerHash: null,
        topRigs: [],
        keysConfigured: false,
      },
    });
  }

  try {
    const rigs: MrrRig[] = await getAvailableRigs(algorithm);

    const prices = rigs
      .map(r => r.price?.BTC?.price)
      .filter((p): p is number => typeof p === 'number' && p > 0);

    const avg = prices.length ? prices.reduce((s, p) => s + p, 0) / prices.length : null;
    const min = prices.length ? Math.min(...prices) : null;
    const max = prices.length ? Math.max(...prices) : null;

    // Return top 5 cheapest rigs with key details
    const sorted = [...rigs].sort((a, b) => (a.price?.BTC?.price ?? 0) - (b.price?.BTC?.price ?? 0));
    const topRigs = sorted.slice(0, 5).map(r => ({
      id: r.id,
      name: r.name,
      hashrate: r.hashrate?.advertised?.hash ?? 0,
      hashrateUnit: r.hashrate?.advertised?.type ?? '',
      priceBtc: r.price?.BTC?.price ?? 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        algorithm,
        count: rigs.length,
        avgBtcPerHash: avg,
        minBtcPerHash: min,
        maxBtcPerHash: max,
        topRigs,
        keysConfigured: true,
      } satisfies MrrMarketData,
    });
  } catch (err) {
    console.error('[mrr] GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch MRR market data' },
      { status: 500 },
    );
  }
}
