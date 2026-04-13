import { NextResponse } from 'next/server';
import { computePrice, MINER4_FEE_USD } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export interface PricingResult {
  algorithm: string;
  hashrate: number;
  unit: string;
  durationHours: number;
  feeUsd: number;                 // $1.99 Miner4 fee
  totalUsd: number;               // final customer price
  btcUsdRate: number;
  availableRigs: number;
  keysConfigured: boolean;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const algorithm    = searchParams.get('algorithm')    ?? 'SHA-256';
  const hashrate     = parseFloat(searchParams.get('hashrate')     ?? '0');
  const unit         = searchParams.get('unit')         ?? 'TH/s';
  const durationHours = parseInt(searchParams.get('duration') ?? '24', 10);

  if (!hashrate || hashrate <= 0 || !durationHours || durationHours <= 0) {
    return NextResponse.json(
      { success: false, error: 'hashrate and duration must be positive numbers' },
      { status: 400 },
    );
  }

  try {
    const price = await computePrice(algorithm, hashrate, unit, durationHours);

    const result: PricingResult = {
      algorithm,
      hashrate,
      unit,
      durationHours,
      feeUsd:       price.feeUsd,
      totalUsd:     price.totalUsd,
      btcUsdRate:   price.btcUsdRate,
      availableRigs: price.availableRigs,
      keysConfigured: price.keysConfigured,
    };

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to compute pricing';
    if (msg.startsWith('No available rigs')) {
      return NextResponse.json({ success: false, error: msg }, { status: 404 });
    }
    console.error('[pricing] GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to compute pricing' },
      { status: 500 },
    );
  }
}

// Re-export the constant so consumers don't need to know its source
export { MINER4_FEE_USD };
