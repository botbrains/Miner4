import { NextResponse } from 'next/server';
import { getAvailableRigs, hasMrrKeys } from '@/lib/mrr';

export const dynamic = 'force-dynamic';

const MINER4_FEE_USD   = 1.99;
const MARKUP_MULTIPLIER = 1.13;

/** Fetch BTC/USD rate from CoinGecko (no API key required). */
async function getBtcUsdRate(): Promise<number> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
      { next: { revalidate: 60 } },
    );
    if (!res.ok) throw new Error('CoinGecko unavailable');
    const data = await res.json() as { bitcoin: { usd: number } };
    return data.bitcoin.usd;
  } catch {
    // Fallback rate if CoinGecko is unreachable
    return 65_000;
  }
}

export interface PricingResult {
  algorithm: string;
  hashrate: number;
  unit: string;
  durationHours: number;
  mrrRatePerHashPerDay: number;   // BTC per hash-unit per day (min across available rigs)
  mrrCostUsd: number;             // raw MRR cost in USD
  markupUsd: number;              // 13% markup
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

  if (!hasMrrKeys()) {
    return NextResponse.json<{ success: boolean; data: PricingResult }>({
      success: true,
      data: {
        algorithm, hashrate, unit, durationHours,
        mrrRatePerHashPerDay: 0,
        mrrCostUsd: 0,
        markupUsd: 0,
        feeUsd: MINER4_FEE_USD,
        totalUsd: 0,
        btcUsdRate: 0,
        availableRigs: 0,
        keysConfigured: false,
      },
    });
  }

  try {
    const [rigs, btcUsdRate] = await Promise.all([
      getAvailableRigs(algorithm),
      getBtcUsdRate(),
    ]);

    if (!rigs.length) {
      return NextResponse.json(
        { success: false, error: `No available rigs found for algorithm: ${algorithm}` },
        { status: 404 },
      );
    }

    // Get the minimum BTC price per hash unit per day across available rigs
    const prices = rigs
      .map(r => r.price?.BTC?.price)
      .filter((p): p is number => typeof p === 'number' && p > 0);

    const mrrRatePerHashPerDay = Math.min(...prices);

    // Cost = rate × hashrate × durationDays
    const durationDays  = durationHours / 24;
    const mrrCostBtc    = mrrRatePerHashPerDay * hashrate * durationDays;
    const mrrCostUsd    = mrrCostBtc * btcUsdRate;
    const markupUsd     = mrrCostUsd * (MARKUP_MULTIPLIER - 1);
    const feeUsd        = MINER4_FEE_USD;
    const totalUsd      = mrrCostUsd * MARKUP_MULTIPLIER + feeUsd;

    const result: PricingResult = {
      algorithm,
      hashrate,
      unit,
      durationHours,
      mrrRatePerHashPerDay,
      mrrCostUsd: +mrrCostUsd.toFixed(4),
      markupUsd:  +markupUsd.toFixed(4),
      feeUsd,
      totalUsd:   +totalUsd.toFixed(2),
      btcUsdRate: +btcUsdRate.toFixed(2),
      availableRigs: rigs.length,
      keysConfigured: true,
    };

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('[pricing] GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to compute pricing' },
      { status: 500 },
    );
  }
}
