import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { expiryReminderEmail } from '@/lib/emailTemplates';
import { createLogger } from '@/lib/logger';
import { isAdminAuthorized } from '@/lib/adminAuth';
import type { Order } from '@/types';

export const dynamic = 'force-dynamic';

const log = createLogger('cron/expiry-reminders');

/**
 * POST /api/cron/expiry-reminders
 *
 * Protected by X-Admin-Key header matching ADMIN_API_KEY env var.
 *
 * Sends an expiry reminder email for every active order whose `expires_at`
 * falls within the next hour and that has not yet received a reminder
 * (`reminder_sent = 0 / NULL`).
 */
export async function POST(req: Request) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();

  const orders = db.prepare(`
    SELECT o.*, p.name as package_name, p.algorithm, p.hashrate, p.unit,
           p.price_usd, p.duration_hours
    FROM orders o
    JOIN packages p ON o.package_id = p.id
    WHERE o.status = 'active'
      AND o.expires_at BETWEEN datetime('now') AND datetime('now', '+1 hour')
      AND (o.reminder_sent IS NULL OR o.reminder_sent = 0)
  `).all() as Order[];

  let sent = 0;
  let failed = 0;

  for (const order of orders) {
    try {
      const emailOpts = expiryReminderEmail(order);
      await sendEmail({ to: order.email, ...emailOpts });
      db.prepare(
        "UPDATE orders SET reminder_sent = 1, updated_at = datetime('now') WHERE id = ?",
      ).run(order.id);
      sent++;
      log.info('Expiry reminder sent', { orderId: order.id, expiresAt: order.expires_at });
    } catch (err) {
      failed++;
      log.error('Failed to send expiry reminder', {
        orderId: order.id,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json(
    { success: true, data: { sent, failed, total: orders.length } },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
