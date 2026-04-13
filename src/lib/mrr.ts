/**
 * Mining Rig Rentals API v2 service.
 * Docs: https://www.miningrigrentals.com/apidoc/v2
 *
 * Required environment variables:
 *   MRR_API_KEY    – your MRR API key
 *   MRR_API_SECRET – your MRR API secret
 */

import crypto from 'crypto';

const MRR_BASE = 'https://www.miningrigrentals.com/api/v2';

/** Monotonically increasing counter to ensure unique nonces per process. */
let _nonceCounter = 0;

/**
 * Map of internal algorithm names to MRR API type names (lowercase, no separators).
 * MRR API v2 expects lowercase algorithm names in query parameters.
 */
const MRR_ALGO_NAME_MAP: Record<string, string> = {
  'SHA-256':  'sha256',
  'Ethash':   'ethash',
  'Scrypt':   'scrypt',
  'X11':      'x11',
  'RandomX':  'randomx',
};

/** Convert an internal algorithm name to the MRR API type name. */
export function toMrrAlgoName(algorithm: string): string {
  return MRR_ALGO_NAME_MAP[algorithm] ?? algorithm.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Safe numeric parser — handles both number and string values from the MRR API. */
function parseNum(val: number | string | undefined | null): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val);
  return NaN;
}

/** Throw a clear error when API credentials are not set. */
function requireKeys() {
  if (!process.env.MRR_API_KEY || !process.env.MRR_API_SECRET) {
    throw new Error(
      'MRR API keys are not configured. Set MRR_API_KEY and MRR_API_SECRET in your .env.local file.',
    );
  }
}

function buildHeaders(endpoint: string, body: string = '') {
  const key    = process.env.MRR_API_KEY    ?? '';
  const secret = process.env.MRR_API_SECRET ?? '';
  const nonce  = `${Date.now()}${(++_nonceCounter).toString().padStart(6, '0')}`;
  const digest = key + nonce + endpoint + body;
  const sign   = crypto.createHmac('sha1', secret).update(digest).digest('hex');

  return {
    'Content-Type': 'application/json',
    'x-api-key':   key,
    'x-api-sign':  sign,
    'x-api-nonce': nonce,
  };
}

async function mrrRequest<T>(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  data?: unknown,
): Promise<T> {
  requireKeys();

  const url      = `${MRR_BASE}${path}`;
  const bodyStr  = data ? JSON.stringify(data) : '';
  const headers  = buildHeaders(path, bodyStr);

  const res = await fetch(url, {
    method,
    headers,
    ...(bodyStr ? { body: bodyStr } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MRR API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

/** Raw rig shape as returned by the MRR API — price and hash are decimal strings. */
interface RawMrrRig {
  id: number;
  name: string;
  type: string;
  status: { status: string };
  hashrate: { advertised: { hash: number | string; type: string } };
  price: { BTC: { price: number | string } };
}

/** Normalised rig shape used throughout the application — all numeric fields are numbers. */
export interface MrrRig {
  id: number;
  name: string;
  type: string;
  status: { status: string };
  hashrate: { advertised: { hash: number; type: string } };
  price: { BTC: { price: number } };
}

/** Convert a raw MRR API rig (with string decimal fields) to a normalised MrrRig. */
function normalizeRig(raw: RawMrrRig): MrrRig {
  return {
    id:     raw.id,
    name:   raw.name,
    type:   raw.type,
    status: raw.status,
    hashrate: {
      advertised: {
        hash: parseNum(raw.hashrate?.advertised?.hash),
        type: raw.hashrate?.advertised?.type ?? '',
      },
    },
    price: {
      BTC: {
        price: parseNum(raw.price?.BTC?.price),
      },
    },
  };
}

/** Fetch available rigs for a given algorithm. */
export async function getAvailableRigs(algorithm: string): Promise<MrrRig[]> {
  type Response = { success: boolean; data: { records: RawMrrRig[] } };
  // MRR API v2 expects lowercase algorithm names (e.g. 'sha256', not 'SHA-256')
  const mrrAlgo = toMrrAlgoName(algorithm);
  const res = await mrrRequest<Response>('GET', `/rig?type=${encodeURIComponent(mrrAlgo)}&status=available`);
  return (res.data?.records ?? []).map(normalizeRig);
}

export interface RentalResult {
  rentalId: string;
  rigId: number;
  start: string;
  end: string;
}

/** Result when provisioning one or more rigs to fulfil a hashrate order. */
export interface MultiRigRentalResult {
  /** All individual rentals that together fulfil the order. */
  rentals: RentalResult[];
  /** Combined advertised hashrate across all rented rigs. */
  totalHashrate: number;
  /** Hashrate unit (e.g. "TH/s"). */
  unit: string;
}

/** Rent a rig for the specified duration. */
export async function rentRig(
  rigId: number,
  durationHours: number,
  workerName: string,
  workerPassword = 'x',
): Promise<RentalResult> {
  type Response = { success: boolean; data: { id: number; start: string; end: string } };
  const payload = {
    rig_id: rigId,
    length: durationHours,
    unit: 'hours',
    worker: workerName,
    workerpass: workerPassword,
  };

  const res = await mrrRequest<Response>('PUT', '/rental', payload);

  return {
    rentalId: String(res.data.id),
    rigId,
    start: res.data.start,
    end: res.data.end,
  };
}

/** Get rental status by ID. */
export async function getRentalStatus(rentalId: string) {
  type Response = { success: boolean; data: { id: number; status: string; start: string; end: string } };
  const res = await mrrRequest<Response>('GET', `/rental/${rentalId}`);
  return res.data;
}

/**
 * Normalise a hashrate unit string for comparison.
 * Converts to lower-case and strips the '/s' or trailing '/' rate-per-second
 * suffix so that MRR's bare units ('TH', 'MH') match the app's display units
 * ('TH/s', 'MH/s').
 */
function normalizeUnit(unit: string): string {
  return unit.toLowerCase().replace(/\/s$/, '').replace(/\/$/, '');
}

/**
 * Select available rigs that meet the required hashrate using a cost-aware heuristic.
 *
 * Strategy:
 * 1. If a single rig is available whose hashrate is within ±5 % of `requiredHashrate`,
 *    return the lowest-cost matching rig.
 * 2. Otherwise aggregate the most cost-efficient rigs (lowest BTC per hash) until the
 *    combined hashrate reaches at least `requiredHashrate * 0.95` (±5 % lower bound).
 *
 * Note: for multi-rig selection, this optimizes for BTC-per-hash efficiency rather than
 * guaranteeing the minimum possible total rental cost.
 *
 * Returns `null` when the available rigs cannot collectively satisfy the requirement.
 */
export function selectRigsForHashrate(
  rigs: MrrRig[],
  requiredHashrate: number,
  unit: string,
): MrrRig[] | null {
  if (requiredHashrate <= 0) return null;

  const unitNorm = normalizeUnit(unit);

  // Filter rigs by unit, valid price, and positive advertised hashrate
  const eligible = rigs.filter(rig => {
    const h = rig.hashrate?.advertised;
    if (!h) return false;
    const rigUnit = normalizeUnit(h.type ?? '');
    const price = rig.price?.BTC?.price;
    const hash = h.hash;
    return (
      rigUnit === unitNorm &&
      Number.isFinite(price) &&
      price > 0 &&
      Number.isFinite(hash) &&
      hash > 0
    );
  });

  if (!eligible.length) return null;

  const lowerBound = requiredHashrate * 0.95;
  const upperBound = requiredHashrate * 1.05;

  // --- Step 1: look for a single rig within ±5 % ---
  const singleCandidates = eligible.filter(r => {
    const h = r.hashrate.advertised.hash;
    return h >= lowerBound && h <= upperBound;
  });

  if (singleCandidates.length) {
    // Cheapest by total price
    singleCandidates.sort((a, b) => a.price.BTC.price - b.price.BTC.price);
    return [singleCandidates[0]];
  }

  // --- Step 2: aggregate cheapest rigs by cost-per-hash efficiency ---
  // Sort by ascending cost-per-hash (BTC / hash)
  const byEfficiency = [...eligible].sort(
    (a, b) =>
      a.price.BTC.price / a.hashrate.advertised.hash -
      b.price.BTC.price / b.hashrate.advertised.hash,
  );

  const selected: MrrRig[] = [];
  let accumulated = 0;

  for (const rig of byEfficiency) {
    selected.push(rig);
    accumulated += rig.hashrate.advertised.hash;
    if (accumulated >= lowerBound) break;
  }

  return accumulated >= lowerBound ? selected : null;
}

/**
 * Auto-provision one or more miners for an order using the real MRR API:
 * 1. Find available rigs matching the algorithm on Mining Rig Rentals.
 * 2. If a single rig is within ±5 % of the required hashrate, rent it.
 * 3. Otherwise aggregate the most cost-efficient rigs until the total hashrate
 *    meets the requirement (within ±5 % lower bound) and rent all of them.
 *
 * Requires MRR_API_KEY and MRR_API_SECRET to be set.
 */
export async function provisionMiner(
  algorithm: string,
  requiredHashrate: number,
  unit: string,
  durationHours: number,
  workerName: string,
): Promise<MultiRigRentalResult | null> {
  const rigs = await getAvailableRigs(algorithm);
  if (!rigs.length) return null;

  const chosenRigs = selectRigsForHashrate(rigs, requiredHashrate, unit);
  if (!chosenRigs) return null;

  // Rent all selected rigs sequentially (avoids MRR API nonce collisions).
  // If any rental fails the whole provisioning attempt is aborted; already-created
  // rentals are logged so they can be cancelled manually if necessary.
  const rentals: RentalResult[] = [];
  for (const rig of chosenRigs) {
    try {
      const rental = await rentRig(rig.id, durationHours, workerName);
      rentals.push(rental);
    } catch (err) {
      if (rentals.length > 0) {
        console.error(
          '[provisionMiner] Partial failure – rigs already rented that may need manual cancellation:',
          rentals.map(r => r.rentalId),
        );
      }
      throw err;
    }
  }

  const totalHashrate = chosenRigs.reduce((sum, r) => sum + r.hashrate.advertised.hash, 0);

  return { rentals, totalHashrate, unit };
}

/** Check whether MRR API credentials are configured. */
export function hasMrrKeys(): boolean {
  return !!(process.env.MRR_API_KEY && process.env.MRR_API_SECRET);
}

/**
 * Suggested price for a single algorithm as returned by GET /info/algos.
 * This is the MRR-authoritative server-side price used as the primary pricing source.
 */
export interface MrrAlgoPrice {
  /** MRR algorithm name (e.g. 'sha256') */
  name: string;
  /** Suggested price in BTC per hash-unit per day (e.g. 0.00001500 BTC/TH/day) */
  suggestedBtcPerUnit: number;
  /** Hash unit as returned by MRR (e.g. 'TH', 'MH') */
  unit: string;
}

/**
 * Fetch the MRR-suggested price for a specific algorithm via GET /info/algos.
 *
 * This endpoint is the recommended server-side pricing source in MRR API v2:
 * it returns the current suggested rental price per hash unit per day for each
 * algorithm without requiring a full rig listing.
 *
 * Returns null when the algorithm is not found, pricing data is unavailable, or
 * the request fails (so callers can fall back to rig-based pricing).
 */
export async function getAlgoMinPrice(algorithm: string): Promise<MrrAlgoPrice | null> {
  const mrrAlgo = toMrrAlgoName(algorithm);

  type AlgoEntry = {
    name: string;
    display?: string;
    suggested_price?: {
      amount?: number | string;
      currency?: string;
      unit?: string;
    };
  };

  type AlgosResponse = {
    success: boolean;
    data: AlgoEntry[] | { records?: AlgoEntry[] };
  };

  try {
    const res = await mrrRequest<AlgosResponse>('GET', '/info/algos');
    if (!res.success) return null;

    const records: AlgoEntry[] = Array.isArray(res.data)
      ? res.data
      : ((res.data as { records?: AlgoEntry[] }).records ?? []);

    const entry = records.find(a => a.name === mrrAlgo);
    if (!entry?.suggested_price) return null;

    const amount = parseNum(entry.suggested_price.amount);
    const unit   = entry.suggested_price.unit ?? '';

    if (!Number.isFinite(amount) || amount <= 0) return null;

    return { name: mrrAlgo, suggestedBtcPerUnit: amount, unit };
  } catch {
    // Non-fatal: caller should fall back to rig-based pricing
    return null;
  }
}

