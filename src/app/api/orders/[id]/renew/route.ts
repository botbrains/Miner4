import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { computePrice, DEFAULT_ALGO_UNITS } from '@/lib/pricing';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * POST /api/orders/:id/renew
 *
 * Creates a follow-on order pre-filled with the same algorithm, hashrate,
 * duration, worker, and payment currency so the user can extend mining
 * without re-entering all their details.
 *
 * The original order must be `active` or `expired`.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const db = getDb();

    const original = db.prepare(`
      SELECT o.*, p.algorithm, p.hashrate, p.unit, p.duration_hours
      FROM orders o
      JOIN packages p ON o.package_id = p.id
      WHERE o.id = ?
    `).get(id) as {
      id: string;
      status: string;
      email: string;
      worker_name: string;
      payment_currency: string;
      coin: string | null;
      pool_id: string | null;
      pool_url: string | null;
      algorithm: string;
      hashrate: number;
      unit: string;
      duration_hours: number;
    } | undefined;

    if (!original) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    if (original.status !== 'active' && original.status !== 'expired') {
      return NextResponse.json(
        { success: false, error: 'Only active or expired orders can be renewed' },
        { status: 400 },
      );
    }

    const displayUnit = DEFAULT_ALGO_UNITS[original.algorithm] ?? original.unit;

    // Compute live pricing for the renewal package
    let priceUsd: number;
    try {
      const price = await computePrice(original.algorithm, original.hashrate, original.duration_hours, displayUnit);
      if (!price.keysConfigured) {
        return NextResponse.json({ success: false, error: 'Pricing service is not configured' }, { status: 503 });
      }
      priceUsd = price.totalUsd;
    } catch (priceErr) {
      const msg = priceErr instanceof Error ? priceErr.message : 'Failed to compute pricing';
      return NextResponse.json({ success: false, error: msg }, { status: 502 });
    }

    // Create a new package record (the order is created by the checkout flow)
    const packageId = randomUUID();
    const name = `${original.algorithm} – ${original.hashrate.toLocaleString()} ${displayUnit} / ${original.duration_hours}h`;
    const description = `Custom ${original.algorithm} renewal: ${original.hashrate.toLocaleString()} ${displayUnit} for ${original.duration_hours} hours.`;

    db.prepare(`
      INSERT INTO packages (id, name, algorithm, hashrate, unit, price_usd, duration_hours, description, popular)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(packageId, name, original.algorithm, original.hashrate, displayUnit, priceUsd, original.duration_hours, description);

    return NextResponse.json({
      success: true,
      data: { packageId },
    });
  } catch (err) {
    console.error('[orders/id/renew] POST error:', err);
    return NextResponse.json({ success: false, error: 'Failed to create renewal order' }, { status: 500 });
  }
}
