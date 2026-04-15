import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyWebhookSignature } from '@/lib/nowpayments';
import { provisionMiner } from '@/lib/mrr';
import { sendEmail } from '@/lib/email';
import {
  miningActiveEmail,
  provisioningFailedEmail,
  partialPaymentEmail,
} from '@/lib/emailTemplates';
import { createLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const log = createLogger('payments/webhook');

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
    const { payment_status, order_id, actually_paid } = payload;

    const db = getDb();
    const order = db.prepare(`
      SELECT o.*, p.algorithm, p.hashrate, p.unit, p.duration_hours
      FROM orders o
      JOIN packages p ON o.package_id = p.id
      WHERE o.id = ?
    `).get(order_id) as {
      id: string;
      email: string;
      status: string;
      worker_name: string;
      algorithm: string;
      hashrate: number;
      unit: string;
      duration_hours: number;
      payment_amount: number | null;
      payment_currency: string;
      payment_address: string | null;
      pool_url: string | null;
      pool_id: string | null;
      coin: string | null;
      // joined package fields
      package_name?: string;
      price_usd?: number;
      mrr_rental_id?: string | null;
      expires_at?: string | null;
      mrr_rental_ids?: string | null;
    } | undefined;

    // Return 200 for unknown order_id so NOWPayments does not retry indefinitely
    if (!order) {
      log.warn('Webhook received for unknown order_id', { order_id, payment_status });
      return NextResponse.json({ success: true });
    }

    // Update payment status
    db.prepare(`
      UPDATE orders SET payment_status = ?, updated_at = datetime('now') WHERE id = ?
    `).run(payment_status, order_id);

    // --- partially_paid ---
    if (payment_status === 'partially_paid') {
      db.prepare(`
        UPDATE orders SET status = 'partially_paid', updated_at = datetime('now') WHERE id = ?
      `).run(order_id);

      const paymentAmountKnown = typeof order.payment_amount === 'number';
      const shortfall = paymentAmountKnown
        ? Math.max(0, order.payment_amount! - (actually_paid ?? 0))
        : 0;

      if (paymentAmountKnown && shortfall > 0) {
        const partialOpts = partialPaymentEmail(order as Parameters<typeof partialPaymentEmail>[0], shortfall);
        sendEmail({ to: order.email, ...partialOpts }).catch(() => {});
      }

      log.info('Order partially paid', { orderId: order_id, shortfall, partialPaymentEmailSent: paymentAmountKnown && shortfall > 0 });
      return NextResponse.json({ success: true });
    }

    // --- payment_expired ---
    if (payment_status === 'expired') {
      db.prepare(`
        UPDATE orders SET status = 'payment_expired', updated_at = datetime('now') WHERE id = ?
      `).run(order_id);
      log.info('Payment expired', { orderId: order_id });
      return NextResponse.json({ success: true });
    }

    // --- confirmed / finished ---
    const confirmedStatuses = ['confirmed', 'finished'];
    const provisionableStatuses = ['awaiting_payment', 'partially_paid'];
    if (confirmedStatuses.includes(payment_status) && provisionableStatuses.includes(order.status)) {
      // Resolve pool config: prefer explicit host/port/pass fields, fall back to parsing pool_url
      const resolvePoolConfig = (
        rawOrder: typeof order,
      ): { host: string; port: number; password: string } | undefined => {
        const poolOrder = rawOrder as typeof rawOrder & {
          pool_host?: string | null;
          pool_port?: number | string | null;
          pool_pass?: string | null;
        };

        const rawUrl = typeof rawOrder.pool_url === 'string' ? rawOrder.pool_url.trim() : '';
        const explicitHost = typeof poolOrder.pool_host === 'string' ? poolOrder.pool_host.trim() : '';
        const explicitPassword =
          typeof poolOrder.pool_pass === 'string' && poolOrder.pool_pass.trim()
            ? poolOrder.pool_pass.trim()
            : 'x';

        let host = explicitHost;
        let port = Number(poolOrder.pool_port);

        if (rawUrl) {
          try {
            const normalized = /^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl)
              ? rawUrl
              : `stratum+tcp://${rawUrl}`;
            const parsed = new URL(normalized);
            if (!host) host = parsed.hostname;
            if (!Number.isFinite(port) || port <= 0) {
              const parsedPort = parsed.port ? Number(parsed.port) : NaN;
              if (Number.isFinite(parsedPort) && parsedPort > 0) port = parsedPort;
            }
          } catch {
            if (!host) {
              const match = rawUrl.match(/^(?:[a-z][a-z0-9+.-]*:\/\/)?([^:/?#]+)(?::(\d+))?/i);
              if (match) {
                host = match[1];
                if ((!Number.isFinite(port) || port <= 0) && match[2]) port = Number(match[2]);
              } else {
                host = rawUrl;
              }
            }
          }
        }

        if (!host) return undefined;
        if (!Number.isFinite(port) || port <= 0) port = 3333;
        return { host, port, password: explicitPassword };
      };

      // Resolve pool config from stored order data
      const pool = resolvePoolConfig(order);

      try {
        const result = await provisionMiner(
          order.algorithm,
          order.hashrate,
          order.unit,
          order.duration_hours,
          order.worker_name,
          pool,
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

          // Refresh order for email template
          const activeOrder = db.prepare(`
            SELECT o.*, p.name as package_name, p.algorithm, p.hashrate, p.unit,
                   p.price_usd, p.duration_hours
            FROM orders o JOIN packages p ON o.package_id = p.id WHERE o.id = ?
          `).get(order_id) as Parameters<typeof miningActiveEmail>[0] & { email: string };

          const activeOpts = miningActiveEmail(activeOrder, primaryRentalId);
          sendEmail({ to: activeOrder.email, ...activeOpts }).catch(() => {});

          log.info('Order provisioned', { orderId: order_id, rentalId: primaryRentalId });
        } else {
          db.prepare(`
            UPDATE orders SET status = 'provisioning_failed', updated_at = datetime('now') WHERE id = ?
          `).run(order_id);

          const failedOrder = db.prepare(`
            SELECT o.*, p.name as package_name, p.algorithm, p.hashrate, p.unit,
                   p.price_usd, p.duration_hours
            FROM orders o JOIN packages p ON o.package_id = p.id WHERE o.id = ?
          `).get(order_id) as Parameters<typeof provisioningFailedEmail>[0] & { email: string };

          const failOpts = provisioningFailedEmail(failedOrder);
          sendEmail({ to: failedOrder.email, ...failOpts }).catch(() => {});

          log.error('Provisioning returned no rentals', { orderId: order_id });
        }
      } catch (provisionErr) {
        log.error('Provisioning error', {
          orderId: order_id,
          err: provisionErr instanceof Error ? provisionErr.message : String(provisionErr),
        });
        db.prepare(`
          UPDATE orders SET status = 'provisioning_failed', updated_at = datetime('now') WHERE id = ?
        `).run(order_id);

        const failedOrder2 = db.prepare(`
          SELECT o.*, p.name as package_name, p.algorithm, p.hashrate, p.unit,
                 p.price_usd, p.duration_hours
          FROM orders o JOIN packages p ON o.package_id = p.id WHERE o.id = ?
        `).get(order_id) as Parameters<typeof provisioningFailedEmail>[0] & { email: string };

        const fail2Opts = provisioningFailedEmail(failedOrder2);
        sendEmail({ to: failedOrder2.email, ...fail2Opts }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    log.error('Webhook processing failed', { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
