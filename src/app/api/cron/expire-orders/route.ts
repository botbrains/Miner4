import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { computePrice } from '@/lib/pricing';
import { ALGORITHM_UNIT_MAP } from '@/lib/algorithmConfig';
import { createLogger } from '@/lib/logger';
import { isAdminAuthorized } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

const log = createLogger('cron/expire-orders');

/**
 * POST /api/cron/expire-orders
 *
 * Protected by X-Admin-Key header matching ADMIN_API_KEY env var.
 *
 * 1. Marks `active` orders as `expired` once their `expires_at` has passed.
 *    Note: MRR rentals are fixed-duration contracts; this only updates internal
 *    order state and does NOT cancel any MRR rental early via the API.
 *
 * 2. Deletes packages older than 24 hours that never received an order
 *    (prevents unbounded DB growth).
 *
 * 3. Records a pricing snapshot for each algorithm into `pricing_history`
 *    (at most one row per algorithm per calendar hour via the unique index).
 */
export async function POST(req: Request) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();

  // 1 & 2 — run in a single transaction
  const { expiredOrders, deletedPackages } = db.transaction(() => {
    const expireResult = db.prepare(`
      UPDATE orders
      SET status = 'expired', updated_at = datetime('now')
      WHERE status = 'active' AND expires_at < datetime('now')
    `).run();

    const deleteResult = db.prepare(`
      DELETE FROM packages
      WHERE created_at < datetime('now', '-24 hours')
        AND id NOT IN (SELECT DISTINCT package_id FROM orders)
    `).run();

    return {
      expiredOrders:   expireResult.changes,
      deletedPackages: deleteResult.changes,
    };
  })();

  log.info('Orders expired and stale packages deleted', { expiredOrders, deletedPackages });

  // 3 — record pricing snapshots (non-fatal; errors are logged but don't fail the cron)
  const ALGORITHMS = ['SHA-256', 'Ethash', 'Scrypt', 'X11', 'RandomX'];
  const REFERENCE_HASHRATES: Record<string, number> = {
    'SHA-256': 1,
    'Ethash': 100,
    'Scrypt': 100,
    'X11': 1,
    'RandomX': 1000,
  };

  const pricingResults: Array<{ algorithm: string; recorded: boolean }> = [];
  for (const algo of ALGORITHMS) {
    try {
      const price = await computePrice(algo, REFERENCE_HASHRATES[algo] ?? 1, 24, ALGORITHM_UNIT_MAP[algo]);
      if (!price.keysConfigured) continue;

      db.prepare(`
        INSERT OR REPLACE INTO pricing_history (algorithm, price_usd, source, btc_rate)
        VALUES (?, ?, ?, ?)
      `).run(algo, price.totalUsd, price.source, price.btcUsdRate);

      pricingResults.push({ algorithm: algo, recorded: true });
    } catch (err) {
      log.warn('Failed to record pricing snapshot', {
        algorithm: algo,
        err: err instanceof Error ? err.message : String(err),
      });
      pricingResults.push({ algorithm: algo, recorded: false });
    }
  }

  return NextResponse.json(
    {
      success: true,
      data: { expiredOrders, deletedPackages, pricingSnapshots: pricingResults },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
