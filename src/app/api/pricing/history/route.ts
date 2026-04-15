import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/pricing/history?algorithm=SHA-256
 *
 * Returns the last 24 pricing snapshots for the given algorithm from the
 * `pricing_history` table.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const algorithm = searchParams.get('algorithm');

  if (!algorithm) {
    return NextResponse.json(
      { success: false, error: 'Missing required query parameter: algorithm' },
      { status: 400 },
    );
  }

  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT id, algorithm, price_usd, source, btc_rate, recorded_at
      FROM pricing_history
      WHERE algorithm = ?
      ORDER BY recorded_at DESC
      LIMIT 24
    `).all(algorithm);

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error('[pricing/history] GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pricing history' },
      { status: 500 },
    );
  }
}
