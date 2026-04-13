import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { computePrice } from '@/lib/pricing';
import { randomUUID } from 'crypto';

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
  unit: string;
  durationHours: number;
  // NOTE: priceUsd is intentionally NOT accepted from the client.
  // Price is always computed server-side to prevent price-manipulation attacks.
}

/** Create a dynamic package record from user-configured hashrate + live pricing. */
export async function POST(req: Request) {
  try {
    const body: CreatePackageBody = await req.json();
    const { algorithm, hashrate, unit, durationHours } = body;

    if (!algorithm || !hashrate || !unit || !durationHours) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: algorithm, hashrate, unit, durationHours' },
        { status: 400 },
      );
    }

    if (hashrate <= 0 || durationHours <= 0) {
      return NextResponse.json(
        { success: false, error: 'hashrate and durationHours must be positive' },
        { status: 400 },
      );
    }

    // Compute the authoritative price entirely on the server.
    let priceUsd: number;
    try {
      const price = await computePrice(algorithm, hashrate, unit, durationHours);
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

