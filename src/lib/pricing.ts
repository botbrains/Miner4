/**
 * Server-side pricing utilities.
 * Keeps business-critical constants (markup, fee) in one place and out of
 * client-visible code.
 */

import { getAvailableRigs, getAlgoSuggestedPrice, hasMrrKeys } from '@/lib/mrr';

// ---------------------------------------------------------------------------
// Hash-unit conversion
// ---------------------------------------------------------------------------

/** Scale factors relative to the base hash unit (H). */
const UNIT_SCALE: Record<string, number> = {
  'h':  1,
  'kh': 1e3,
  'mh': 1e6,
  'gh': 1e9,
  'th': 1e12,
  'ph': 1e15,
};

/** Normalise a hash-unit string to a lowercase key matching UNIT_SCALE. */
function normalizeHashUnit(unit: string): string {
  // Strip a trailing "/s" or "/" (e.g. "TH/s" → "th", "KH/" → "kh")
  return unit.toLowerCase().replace(/\/s?$/, '');
}

/**
 * Convert a hashrate value from one hash unit to another.
 *
 * Example: convertHashrate(1, 'TH/s', 'GH') → 1000
 * (1 TH = 1000 GH, so 1 TH/s expressed in GH is 1000)
 *
 * Returns the original value unchanged when either unit is unknown or when
 * both units are the same after normalisation.
 */
export function convertHashrate(hashrate: number, fromUnit: string, toUnit: string): number {
  const fromKey = normalizeHashUnit(fromUnit);
  const toKey   = normalizeHashUnit(toUnit);
  if (fromKey === toKey) return hashrate;
  const fromScale = UNIT_SCALE[fromKey];
  const toScale   = UNIT_SCALE[toKey];
  if (!fromScale || !toScale) return hashrate;
  return hashrate * (fromScale / toScale);
}

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
  /** Indicates which pricing path was used. */
  source: 'algo-suggested' | 'rig-fallback' | 'unconfigured';
}

 /**
 * Compute the customer-facing price for a hashrate rental entirely on the
 * server.  Never accepts a price from the client.
 *
 * Pricing strategy (MRR API v2):
 * 1. Primary:  use GET /info/algos/[NAME] to get the MRR-suggested price for
 *    the algorithm — this is the server-side pricing endpoint recommended by
 *    MRR.  The response also provides the authoritative hash unit so the
 *    hashrate is always expressed in the same unit as the quoted price.
 *    This is fetched in parallel with the BTC/USD rate.
 * 2. Fallback: only if /info/algos/[NAME] returns no usable price, call
 *    GET /rig?type=[NAME] to derive the minimum price from available rigs.
 *    The authoritative unit is taken from hashrate.advertised.type on the
 *    returned rig records (identical structure to the main rig list).
 *    The rig-listing call is deferred so it is never made when the primary
 *    path succeeds.
 *
 * @param algorithm    Internal algorithm name (e.g. 'SHA-256').
 * @param hashrate     Requested hashrate expressed in `unit`.
 * @param durationHours Rental duration in hours.
 * @param unit         Hashrate unit from the caller (e.g. 'TH/s', 'KH/s').
 *                     When supplied, the hashrate is automatically converted
 *                     to MRR's authoritative unit before computing cost so
 *                     any unit-scale mismatch is corrected transparently.
 *
 * @throws if MRR keys are configured but no pricing data is available.
 */
export async function computePrice(
  algorithm: string,
  hashrate: number,
  durationHours: number,
  unit?: string,
): Promise<ComputedPrice> {
  const feeUsd = MINER4_FEE_USD;

  if (!hasMrrKeys()) {
    return { totalUsd: 0, feeUsd, btcUsdRate: 0, availableRigs: 0, keysConfigured: false, source: 'unconfigured' };
  }

  // Fetch the suggested algo price and BTC rate concurrently.
  // The rig-listing call is intentionally deferred to the fallback path
  // to avoid the overhead of a heavy /rig request when /info/algos/[NAME] succeeds.
  const [algoPrice, btcUsdRate] = await Promise.all([
    getAlgoSuggestedPrice(algorithm),
    getBtcUsdRate(),
  ]);

  let mrrRatePerHashPerDay: number;
  let availableRigs = 0;
  let source: ComputedPrice['source'] = 'algo-suggested';

  // Effective hashrate in MRR's authoritative unit.  Starts as the caller's
  // value and is scaled when the caller's unit differs from MRR's unit.
  let hashrateInMrrUnits = hashrate;

  if (algoPrice && algoPrice.btcPerUnitPerDay > 0) {
    // Primary: use MRR's own server-side suggested price from /info/algos/[NAME].
    // Convert the caller's hashrate to the unit MRR used when quoting the price
    // so the multiplication is dimensionally correct.
    mrrRatePerHashPerDay = algoPrice.btcPerUnitPerDay;
    if (unit && algoPrice.unit) {
      hashrateInMrrUnits = convertHashrate(hashrate, unit, algoPrice.unit);
    }
  } else {
    // Fallback: derive minimum price from available rigs via GET /rig?type=[NAME].
    // The rig records are identical in structure to the main rig list and include
    // hashrate.advertised.type — the authoritative MRR unit for this algorithm.
    source = 'rig-fallback';
    const rigs = await getAvailableRigs(algorithm);
    availableRigs = rigs.length;

    if (!rigs.length) {
      throw new Error(`No available rigs found for algorithm: ${algorithm}`);
    }

    // Derive the authoritative unit from the first rig's advertised hashrate
    // type. MRR may return rigs with mixed units (e.g. some in TH, some in
    // GH) so we filter to only rigs that share this unit before computing
    // BTC-per-hash ratios — mixing units would make the ratios incomparable
    // and Math.min would silently pick an incompatible value.
    const rigUnit     = rigs[0].hashrate?.advertised?.type ?? '';
    const rigUnitNorm = normalizeHashUnit(rigUnit);

    const sameUnitRigs = rigs.filter(
      r => normalizeHashUnit(r.hashrate?.advertised?.type ?? '') === rigUnitNorm,
    );
    availableRigs = sameUnitRigs.length;

    if (unit && rigUnit) {
      hashrateInMrrUnits = convertHashrate(hashrate, unit, rigUnit);
    }

    const prices = sameUnitRigs
      .map(r => {
        const price            = r.price?.BTC?.price;
        const advertisedHashrate = r.hashrate?.advertised?.hash;
        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(advertisedHashrate) || advertisedHashrate <= 0) return NaN;
        return price / advertisedHashrate;
      })
      .filter((p): p is number => Number.isFinite(p) && p > 0);

    if (!prices.length) {
      throw new Error(`No priced rigs available for algorithm: ${algorithm}`);
    }

    mrrRatePerHashPerDay = Math.min(...prices);
  }

  const durationDays  = durationHours / 24;
  const mrrCostBtc    = mrrRatePerHashPerDay * hashrateInMrrUnits * durationDays;
  const mrrCostUsd    = mrrCostBtc * btcUsdRate;
  const totalUsd      = +(mrrCostUsd * MARKUP_MULTIPLIER + feeUsd).toFixed(2);

  return {
    totalUsd,
    feeUsd,
    btcUsdRate: +btcUsdRate.toFixed(2),
    availableRigs,
    keysConfigured: true,
    source,
  };
}
