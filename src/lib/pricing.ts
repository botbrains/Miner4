/**
 * Server-side pricing utilities.
 * Keeps business-critical constants (markup, fee) in one place and out of
 * client-visible code.
 */

import { getAvailableRigs, hasMrrKeys } from '@/lib/mrr';

export const MINER4_FEE_USD = 1.99;
const MARKUP_MULTIPLIER     = 1.13;   // internal only—never exposed to clients
const DEFAULT_ALGO_UNITS: Record<string, string> = {
  'SHA-256': 'TH/s',
  Ethash: 'MH/s',
  Scrypt: 'MH/s',
  X11: 'GH/s',
  RandomX: 'KH/s',
};

const UNIT_SCALE: Record<string, number> = {
  h: 1,
  kh: 1e3,
  mh: 1e6,
  gh: 1e9,
  th: 1e12,
  ph: 1e15,
  eh: 1e18,
};

function normalizeUnit(unit: string): string {
  const compact = unit.toLowerCase().replace(/\s+/g, '');
  const cleaned = compact
    .replace(/\/(s|sec|second|seconds)\/?$/, '')
    .replace(/\/(d|day|days)\/?$/, '')
    .replace(/\/$/, '');

  if (cleaned in UNIT_SCALE) return cleaned;

  const tokens = compact.split(/[^a-z]+/).filter(Boolean);
  const token = tokens.find((part) => part in UNIT_SCALE);
  return token ?? cleaned;
}

function convertHashrateUnits(value: number, fromUnit: string, toUnit: string): number {
  const fromNorm = normalizeUnit(fromUnit);
  const toNorm = normalizeUnit(toUnit);
  if (!fromNorm || !toNorm || fromNorm === toNorm) return value;

  const fromScale = UNIT_SCALE[fromNorm];
  const toScale = UNIT_SCALE[toNorm];
  if (!fromScale || !toScale) return value;

  return (value * fromScale) / toScale;
}

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
  source: 'rigs' | 'unconfigured';
}

 /**
 * Compute the customer-facing price for a hashrate rental entirely on the
 * server.  Never accepts a price from the client.
 *
 * Pricing strategy (MRR API v2):
 * Fetch available rigs via GET /rig and derive the minimum BTC-per-hash-unit
 * per day from their advertised prices. The BTC/USD rate is fetched concurrently.
 *
 * @throws if MRR keys are configured but no pricing data is available.
 */
export async function computePrice(
  algorithm: string,
  hashrate: number,
  durationHours: number,
  inputUnit?: string,
): Promise<ComputedPrice> {
  const feeUsd = MINER4_FEE_USD;

  if (!hasMrrKeys()) {
    return { totalUsd: 0, feeUsd, btcUsdRate: 0, availableRigs: 0, keysConfigured: false, source: 'unconfigured' };
  }

  // Fetch available rigs and BTC rate concurrently.
  const [rigs, btcUsdRate] = await Promise.all([
    getAvailableRigs(algorithm),
    getBtcUsdRate(),
  ]);

  let mrrRatePerHashPerDay = 0;
  let pricingUnit = inputUnit ?? DEFAULT_ALGO_UNITS[algorithm] ?? '';
  const availableRigs = rigs.length;

  if (!rigs.length) {
    throw new Error(`No available rigs found for algorithm: ${algorithm}`);
  }

  const prices = rigs
    .map(r => {
      const price              = r.price?.BTC?.price;
      const advertisedHashrate = r.hashrate?.advertised?.hash;
      if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(advertisedHashrate) || advertisedHashrate <= 0) return NaN;
      return price / advertisedHashrate;
    })
    .filter((p): p is number => Number.isFinite(p) && p > 0);

  if (!prices.length) {
    throw new Error(`No priced rigs available for algorithm: ${algorithm}`);
  }

  mrrRatePerHashPerDay = Math.min(...prices);
  pricingUnit = rigs.find(r => Number.isFinite(r.hashrate?.advertised?.hash) && r.hashrate?.advertised?.hash > 0)?.hashrate?.advertised?.type ?? pricingUnit;

  const sourceUnit = inputUnit ?? DEFAULT_ALGO_UNITS[algorithm] ?? pricingUnit;
  const pricedHashrate = convertHashrateUnits(hashrate, sourceUnit, pricingUnit);
  const durationDays  = durationHours / 24;
  const mrrCostBtc    = mrrRatePerHashPerDay * pricedHashrate * durationDays;
  const mrrCostUsd    = mrrCostBtc * btcUsdRate;
  const totalUsd      = +(mrrCostUsd * MARKUP_MULTIPLIER + feeUsd).toFixed(2);

  return {
    totalUsd,
    feeUsd,
    btcUsdRate: +btcUsdRate.toFixed(2),
    availableRigs,
    keysConfigured: true,
    source: 'rigs',
  };
}
