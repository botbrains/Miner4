import { NextResponse } from 'next/server';
import { computePrice } from '@/lib/pricing';
import { ALGORITHM_UNIT_MAP } from '@/lib/algorithmConfig';

export const dynamic = 'force-dynamic';

export interface PricingResult {
  algorithm: string;
  hashrate: number;
  durationHours: number;
  feeUsd: number;                 // $1.99 Miner4 fee
  totalUsd: number;               // final customer price
  btcUsdRate: number;
  availableRigs: number;
  keysConfigured: boolean;
  /** Which pricing path was used. */
  source: 'algo-suggested' | 'rig-fallback' | 'unconfigured';
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const algorithm     = searchParams.get('algorithm') ?? 'SHA-256';
  const hashrate      = parseFloat(searchParams.get('hashrate') ?? '0');
  const durationHours = parseInt(searchParams.get('duration') ?? '24', 10);

  if (!Number.isFinite(hashrate) || hashrate <= 0 || !Number.isFinite(durationHours) || durationHours <= 0) {
    return NextResponse.json(
      { success: false, error: 'hashrate and duration must be positive numbers' },
      { status: 400 },
    );
  }

  try {
    const unit          = ALGORITHM_UNIT_MAP[algorithm];
    const price = await computePrice(algorithm, hashrate, durationHours, unit);

    const result: PricingResult = {
      algorithm,
      hashrate,
      durationHours,
      feeUsd:       price.feeUsd,
      totalUsd:     price.totalUsd,
      btcUsdRate:   price.btcUsdRate,
      availableRigs: price.availableRigs,
      keysConfigured: price.keysConfigured,
      source:       price.source,
    };

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to compute pricing';
    if (msg.startsWith('No available rigs') || msg.startsWith('No priced rigs')) {
      return NextResponse.json({ success: false, error: msg }, { status: 404 });
    }
    console.error('[pricing] GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to compute pricing' },
      { status: 500 },
    );
  }
}
