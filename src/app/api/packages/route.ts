import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { computePrice } from '@/lib/pricing';
import { ALGORITHM_UNIT_MAP, ALGORITHM_MIN_HASHRATE } from '@/lib/algorithmConfig';
import { randomUUID } from 'crypto';
import { checkRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();
    const packages = db.prepare('SELECT * FROM packages ORDER BY created_at DESC').all();
    return NextResponse.json({ success: true, data: packages });
  } catch (err) {
    console.error('[packages] GET error:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch packages' }, { status: 500 });
  }
}

interface CreatePackageBody {
  algorithm: string;
  hashrate: number;
  durationHours: number;
  // NOTE: priceUsd and unit are intentionally NOT accepted from the client.
  // Price is always computed server-side to prevent price-manipulation attacks.
  // Unit is always derived server-side from the algorithm allowlist.
}

/** Create a dynamic package record from user-configured hashrate + live pricing. */
export async function POST(req: Request) {
  // Rate-limit: 10 requests per minute per IP
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    const retryAfterSec = Math.ceil(rl.retryAfterMs / 1000);
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    );
  }

  try {
    const body: CreatePackageBody = await req.json();
    const { algorithm, hashrate, durationHours } = body;

    if (!algorithm || !hashrate || !durationHours) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: algorithm, hashrate, durationHours' },
        { status: 400 },
      );
    }

    // Validate algorithm and derive unit server-side
    const unit = ALGORITHM_UNIT_MAP[algorithm];
    if (!unit) {
      return NextResponse.json(
        { success: false, error: `Unsupported algorithm: ${algorithm}` },
        { status: 400 },
      );
    }

    if (!Number.isFinite(hashrate) || hashrate <= 0 || !Number.isFinite(durationHours) || durationHours <= 0) {
      return NextResponse.json(
        { success: false, error: 'hashrate and durationHours must be positive finite numbers' },
        { status: 400 },
      );
    }

    // Enforce minimum hashrate floor per algorithm
    const minHashrate = ALGORITHM_MIN_HASHRATE[algorithm];
    if (minHashrate !== undefined && hashrate < minHashrate) {
      return NextResponse.json(
        { success: false, error: `Minimum hashrate for ${algorithm} is ${minHashrate} ${unit}` },
        { status: 400 },
      );
    }

    // Compute the authoritative price entirely on the server.
    let priceUsd: number;
    try {
      const price = await computePrice(algorithm, hashrate, durationHours, unit);
      if (!price.keysConfigured) {
        return NextResponse.json(
          { success: false, error: 'Pricing service is not configured' },
          { status: 503 },
        );
      }
      priceUsd = price.totalUsd;
    } catch (priceErr) {
      const msg = priceErr instanceof Error ? priceErr.message : 'Failed to compute pricing';
      return NextResponse.json({ success: false, error: msg }, { status: 502 });
    }

    const id = randomUUID();
    const name = `${algorithm} – ${hashrate.toLocaleString()} ${unit} / ${durationHours}h`;
    const description = `Custom ${algorithm} rental: ${hashrate.toLocaleString()} ${unit} for ${durationHours} hours.`;

    const db = getDb();
    db.prepare(`
      INSERT INTO packages (id, name, algorithm, hashrate, unit, price_usd, duration_hours, description, popular)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(id, name, algorithm, hashrate, unit, priceUsd, durationHours, description);

    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(id);
    return NextResponse.json({ success: true, data: pkg }, { status: 201 });
  } catch (err) {
    console.error('[packages] POST error:', err);
    return NextResponse.json({ success: false, error: 'Failed to create package' }, { status: 500 });
  }
}

