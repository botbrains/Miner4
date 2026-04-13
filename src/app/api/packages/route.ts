import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { computePrice } from '@/lib/pricing';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * Server-authoritative map of algorithm → hashrate unit.
 * The client may suggest an algorithm name but unit is always derived here,
 * so a malformed/spoofed unit cannot affect provisioning.
 * Algorithms not present in this map are rejected with HTTP 400.
 */
const ALGORITHM_UNIT_MAP: Record<string, string> = {
  'SHA-256': 'TH/s',
  'Ethash':  'MH/s',
  'Scrypt':  'MH/s',
  'X11':     'GH/s',
  'RandomX': 'KH/s',
};

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

    // Compute the authoritative price entirely on the server.
    let priceUsd: number;
    try {
      const price = await computePrice(algorithm, hashrate, durationHours);
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

