/**
 * Server-side pricing utilities.
 * Keeps business-critical constants (markup, fee) in one place and out of
 * client-visible code.
 */

import { getAvailableRigs, getAlgoSuggestedPrice, hasMrrKeys } from '@/lib/mrr';

export const MINER4_FEE_USD = 1.99;
const MARKUP_MULTIPLIER     = 1.13;   // internal only—never exposed to clients

/** Fetch BTC/USD rate from CoinGecko (no API key required). */
export async function getBtcUsdRate(): Promise<number> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
      { next: { revalidate: 60 } },
    );
    if (!res.ok) throw new Error('CoinGecko unavailable');
    const data = await res.json() as { bitcoin: { usd: number } };
    return data.bitcoin.usd;
  } catch {
    return 65_000; // fallback when CoinGecko is unreachable
  }
}

export interface ComputedPrice {
  totalUsd: number;
  feeUsd: number;
  btcUsdRate: number;
  availableRigs: number;
  keysConfigured: boolean;
}

 /**
 * Compute the customer-facing price for a hashrate rental entirely on the
 * server.  Never accepts a price from the client.
 *
 * Pricing strategy (MRR API v2):
 * 1. Primary:  use GET /info/algos to get the MRR-suggested price for the
 *    algorithm — this is the server-side pricing endpoint recommended by MRR.
 *    This is fetched in parallel with the BTC/USD rate.
 * 2. Fallback: only if /info/algos returns no usable price, call GET /rig to
 *    derive the minimum price from available rigs. The rig-listing call is
 *    deferred to this path so it is never made when /info/algos succeeds.
 *
 * @throws if MRR keys are configured but no pricing data is available.
 */
export async function computePrice(
  algorithm: string,
  hashrate: number,
  durationHours: number,
): Promise<ComputedPrice> {
  const feeUsd = MINER4_FEE_USD;

  if (!hasMrrKeys()) {
    return { totalUsd: 0, feeUsd, btcUsdRate: 0, availableRigs: 0, keysConfigured: false };
  }

  // Fetch the suggested algo price and BTC rate concurrently.
  // The rig-listing call is intentionally deferred to the fallback path
  // to avoid the overhead of a heavy /rig request when /info/algos succeeds.
  const [algoPrice, btcUsdRate] = await Promise.all([
    getAlgoSuggestedPrice(algorithm),
    getBtcUsdRate(),
  ]);

  let mrrRatePerHashPerDay: number;
  let availableRigs = 0;

  if (algoPrice && algoPrice.btcPerUnitPerDay > 0) {
    // Primary: use MRR's own server-side suggested price for the algorithm
    mrrRatePerHashPerDay = algoPrice.btcPerUnitPerDay;
  } else {
    // Fallback: derive minimum price from available rigs
    const rigs = await getAvailableRigs(algorithm);
    availableRigs = rigs.length;

    if (!rigs.length) {
      throw new Error(`No available rigs found for algorithm: ${algorithm}`);
    }

    const prices = rigs
      .map(r => r.price?.BTC?.price)
      .filter((p): p is number => Number.isFinite(p) && p > 0);

    if (!prices.length) {
      throw new Error(`No priced rigs available for algorithm: ${algorithm}`);
    }

    mrrRatePerHashPerDay = Math.min(...prices);
  }

  const durationDays  = durationHours / 24;
  const mrrCostBtc    = mrrRatePerHashPerDay * hashrate * durationDays;
  const mrrCostUsd    = mrrCostBtc * btcUsdRate;
  const totalUsd      = +(mrrCostUsd * MARKUP_MULTIPLIER + feeUsd).toFixed(2);

  return {
    totalUsd,
    feeUsd,
    btcUsdRate: +btcUsdRate.toFixed(2),
    availableRigs,
    keysConfigured: true,
  };
}
