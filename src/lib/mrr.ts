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
  const nonce  = Date.now().toString();
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

export interface MrrRig {
  id: number;
  name: string;
  type: string;
  status: { status: string };
  hashrate: { advertised: { hash: number; type: string } };
  price: { BTC: { price: number } };
}

/** Fetch available rigs for a given algorithm. */
export async function getAvailableRigs(algorithm: string): Promise<MrrRig[]> {
  type Response = { success: boolean; data: { records: MrrRig[] } };
  const res = await mrrRequest<Response>('GET', `/rig?type=${encodeURIComponent(algorithm)}&status=available`);
  return res.data?.records ?? [];
}

export interface RentalResult {
  rentalId: string;
  rigId: number;
  start: string;
  end: string;
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
 * Auto-provision a miner for an order using the real MRR API:
 * 1. Find available rigs matching the algorithm on Mining Rig Rentals
 * 2. Pick the best-priced rig that satisfies the hashrate requirement
 * 3. Rent it via MRR API v2
 *
 * Requires MRR_API_KEY and MRR_API_SECRET to be set.
 */
export async function provisionMiner(
  algorithm: string,
  requiredHashrate: number,
  unit: string,
  durationHours: number,
  workerName: string,
): Promise<RentalResult | null> {
  const rigs = await getAvailableRigs(algorithm);
  if (!rigs.length) return null;

  // Find rigs that can deliver the required hashrate
  const unitNormalized = unit.toLowerCase();
  const suitable = rigs.filter(rig => {
    const h = rig.hashrate?.advertised;
    if (!h) return false;
    const rigUnit = (h.type ?? '').toLowerCase().replace('/', '');
    const reqUnit = unitNormalized.replace('/', '');
    return rigUnit === reqUnit && h.hash >= requiredHashrate;
  });

  // Return null when no rigs satisfy the hashrate/unit requirement
  if (!suitable.length) return null;

  // Return null when no rigs have a valid positive price
  const priced = suitable.filter(r => typeof r.price?.BTC?.price === 'number' && r.price.BTC.price > 0);
  if (!priced.length) return null;
  priced.sort((a, b) => a.price.BTC.price - b.price.BTC.price);
  const rig = priced[0];

  return rentRig(rig.id, durationHours, workerName);
}

/** Check whether MRR API credentials are configured. */
export function hasMrrKeys(): boolean {
  return !!(process.env.MRR_API_KEY && process.env.MRR_API_SECRET);
}

