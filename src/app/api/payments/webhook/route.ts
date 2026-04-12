import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyWebhookSignature } from '@/lib/nowpayments';
import { provisionMiner } from '@/lib/mrr';

export const dynamic = 'force-dynamic';

interface NowPaymentsWebhook {
  payment_id: string;
  payment_status: string;
  order_id: string;
  actually_paid: number;
  pay_currency: string;
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-nowpayments-sig') ?? '';

    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload: NowPaymentsWebhook = JSON.parse(rawBody);
    const { payment_status, order_id } = payload;

    const db = getDb();
    const order = db.prepare(`
      SELECT o.*, p.algorithm, p.hashrate, p.unit, p.duration_hours
      FROM orders o
      JOIN packages p ON o.package_id = p.id
      WHERE o.id = ?
    `).get(order_id) as {
      id: string;
      status: string;
      worker_name: string;
      algorithm: string;
      hashrate: number;
      unit: string;
      duration_hours: number;
    } | undefined;

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Update payment status
    db.prepare(`
      UPDATE orders SET payment_status = ?, updated_at = datetime('now') WHERE id = ?
    `).run(payment_status, order_id);

    // Provision miner(s) when payment is confirmed
    const confirmedStatuses = ['confirmed', 'finished'];
    if (confirmedStatuses.includes(payment_status) && order.status === 'awaiting_payment') {
      try {
        const result = await provisionMiner(
          order.algorithm,
          order.hashrate,
          order.unit,
          order.duration_hours,
          order.worker_name,
        );

        if (result && result.rentals.length > 0) {
          // Use the earliest end time among all rentals as the order expiry
          const ends = result.rentals.map(r => r.end).filter(Boolean);
          const expiresAt = ends.length
            ? ends.reduce((min, e) => (e < min ? e : min))
            : new Date(Date.now() + order.duration_hours * 3600_000).toISOString();

          // Primary rental ID (first rig, for backward compatibility)
          const primaryRentalId = result.rentals[0].rentalId;
          // JSON-encoded array of all rental IDs (multi-rig support)
          const allRentalIds = JSON.stringify(result.rentals.map(r => r.rentalId));

          db.prepare(`
            UPDATE orders
            SET status          = 'active',
                mrr_rental_id   = ?,
                mrr_rental_ids  = ?,
                expires_at      = ?,
                updated_at      = datetime('now')
            WHERE id = ?
          `).run(primaryRentalId, allRentalIds, expiresAt, order_id);
        } else {
          db.prepare(`
            UPDATE orders SET status = 'provisioning_failed', updated_at = datetime('now') WHERE id = ?
          `).run(order_id);
        }
      } catch (provisionErr) {
        console.error('[webhook] Provisioning error:', provisionErr);
        db.prepare(`
          UPDATE orders SET status = 'provisioning_failed', updated_at = datetime('now') WHERE id = ?
        `).run(order_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[payments/webhook] error:', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
