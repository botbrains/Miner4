/**
 * HTML email templates for transactional messages.
 *
 * Each function returns an object with `subject` and `html` fields that can
 * be passed directly to `sendEmail`.
 */

import type { Order } from '@/types';

/** Shared wrapper that gives emails a consistent branded look. */
function wrap(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;color:#e5e7eb">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a">
<tr><td align="center" style="padding:40px 16px">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#111827;border-radius:16px;border:1px solid #1f2937;overflow:hidden">
<tr><td style="padding:32px 32px 0;background:linear-gradient(135deg,#1c0a00 0%,#111827 100%)">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px">
    <div style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,#f97316,#eab308);display:flex;align-items:center;justify-content:center;font-size:20px">⚡</div>
    <span style="color:#fff;font-weight:800;font-size:20px">Miner<span style="color:#f97316">4</span></span>
  </div>
</td></tr>
<tr><td style="padding:32px">${content}</td></tr>
<tr><td style="padding:16px 32px 32px;border-top:1px solid #1f2937">
  <p style="color:#6b7280;font-size:12px;margin:0">
    © ${new Date().getFullYear()} Miner4 · <a href="mailto:support@miner4.io" style="color:#9ca3af">support@miner4.io</a>
  </p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function kv(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;color:#9ca3af;font-size:14px;width:40%">${label}</td>
    <td style="padding:8px 0;color:#f3f4f6;font-size:14px;font-weight:600">${value}</td>
  </tr>`;
}

// ---------------------------------------------------------------------------

export function orderConfirmationEmail(order: Order): { subject: string; html: string } {
  const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? '';
  const orderUrl = `${baseUrl}/order/${order.id}`;

  return {
    subject: `Order Confirmed – ${order.package_name}`,
    html: wrap(`
      <h1 style="color:#fff;font-size:24px;font-weight:800;margin:0 0 8px">Order Confirmed 🎉</h1>
      <p style="color:#9ca3af;font-size:15px;margin:0 0 24px">
        Your order has been created. Send your crypto payment to activate mining.
      </p>
      <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px">
        ${kv('Order ID', `<code style="font-family:monospace;font-size:12px">${order.id}</code>`)}
        ${kv('Package', order.package_name)}
        ${kv('Algorithm', order.algorithm)}
        ${kv('Hashrate', `${order.hashrate.toLocaleString()} ${order.unit}`)}
        ${kv('Duration', `${order.duration_hours} hours`)}
        ${kv('Total', `$${order.price_usd.toFixed(2)}`)}
        ${kv('Payment Currency', order.payment_currency.toUpperCase())}
        ${order.payment_amount ? kv('Amount Due', `${order.payment_amount} ${order.payment_currency.toUpperCase()}`) : ''}
        ${order.payment_address ? kv('Payment Address', `<code style="font-family:monospace;font-size:11px;word-break:break-all">${order.payment_address}</code>`) : ''}
      </table>
      <a href="${orderUrl}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#f97316,#eab308);color:#fff;font-weight:700;text-decoration:none;border-radius:10px;font-size:15px">
        View Order Status →
      </a>
    `),
  };
}

export function miningActiveEmail(order: Order, rentalId: string): { subject: string; html: string } {
  const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? '';
  const orderUrl = `${baseUrl}/order/${order.id}`;

  return {
    subject: `Mining Started – ${order.package_name}`,
    html: wrap(`
      <h1 style="color:#4ade80;font-size:24px;font-weight:800;margin:0 0 8px">⛏️ Mining is Active!</h1>
      <p style="color:#9ca3af;font-size:15px;margin:0 0 24px">
        Your payment was confirmed and your miner is now running.
      </p>
      <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px">
        ${kv('Order ID', `<code style="font-family:monospace;font-size:12px">${order.id}</code>`)}
        ${kv('Algorithm', order.algorithm)}
        ${kv('Hashrate', `${order.hashrate.toLocaleString()} ${order.unit}`)}
        ${kv('MRR Rental ID', `<code style="font-family:monospace">${rentalId}</code>`)}
        ${order.expires_at ? kv('Expires At', new Date(order.expires_at).toLocaleString()) : ''}
      </table>
      <a href="${orderUrl}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#f97316,#eab308);color:#fff;font-weight:700;text-decoration:none;border-radius:10px;font-size:15px">
        View Order →
      </a>
    `),
  };
}

export function provisioningFailedEmail(order: Order): { subject: string; html: string } {
  return {
    subject: `Action Required – Provisioning Failed for Order ${order.id.slice(0, 8)}`,
    html: wrap(`
      <h1 style="color:#f87171;font-size:24px;font-weight:800;margin:0 0 8px">❌ Miner Provisioning Failed</h1>
      <p style="color:#9ca3af;font-size:15px;margin:0 0 24px">
        We were unable to provision a miner for your order. Our support team has been notified.
        Please contact us and we will resolve this promptly.
      </p>
      <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px">
        ${kv('Order ID', `<code style="font-family:monospace;font-size:12px">${order.id}</code>`)}
        ${kv('Algorithm', order.algorithm)}
        ${kv('Hashrate', `${order.hashrate.toLocaleString()} ${order.unit}`)}
      </table>
      <a href="mailto:support@miner4.io?subject=Provisioning%20Failed%20–%20${encodeURIComponent(order.id)}"
         style="display:inline-block;padding:12px 24px;background:#ef4444;color:#fff;font-weight:700;text-decoration:none;border-radius:10px;font-size:15px">
        Contact Support →
      </a>
    `),
  };
}

export function partialPaymentEmail(
  order: Order,
  shortfall: number,
): { subject: string; html: string } {
  return {
    subject: `Top-Up Required – Partial Payment Received for Order ${order.id.slice(0, 8)}`,
    html: wrap(`
      <h1 style="color:#facc15;font-size:24px;font-weight:800;margin:0 0 8px">⚠️ Partial Payment Received</h1>
      <p style="color:#9ca3af;font-size:15px;margin:0 0 24px">
        We received a partial payment for your order. Please send the remaining amount
        to the same address to complete your order.
      </p>
      <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px">
        ${kv('Order ID', `<code style="font-family:monospace;font-size:12px">${order.id}</code>`)}
        ${kv('Amount Due', `${order.payment_amount ?? '?'} ${order.payment_currency.toUpperCase()}`)}
        ${kv('Shortfall', `${shortfall.toFixed(8)} ${order.payment_currency.toUpperCase()}`)}
        ${order.payment_address ? kv('Payment Address', `<code style="font-family:monospace;font-size:11px;word-break:break-all">${order.payment_address}</code>`) : ''}
      </table>
      <p style="color:#6b7280;font-size:13px">
        If full payment is not received before the invoice expires, your order will be
        cancelled automatically.
      </p>
    `),
  };
}

export function expiryReminderEmail(order: Order): { subject: string; html: string } {
  const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? '';
  const orderUrl = `${baseUrl}/order/${order.id}`;
  const renewUrl = `${baseUrl}/order/${order.id}?renew=1`;

  return {
    subject: `Your Mining Rental Expires Soon – Order ${order.id.slice(0, 8)}`,
    html: wrap(`
      <h1 style="color:#f97316;font-size:24px;font-weight:800;margin:0 0 8px">⏰ Rental Expiring Soon</h1>
      <p style="color:#9ca3af;font-size:15px;margin:0 0 24px">
        Your hashrate rental expires in less than 1 hour. Renew now to keep mining without interruption.
      </p>
      <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px">
        ${kv('Order ID', `<code style="font-family:monospace;font-size:12px">${order.id}</code>`)}
        ${kv('Algorithm', order.algorithm)}
        ${kv('Hashrate', `${order.hashrate.toLocaleString()} ${order.unit}`)}
        ${order.expires_at ? kv('Expires At', new Date(order.expires_at).toLocaleString()) : ''}
      </table>
      <a href="${renewUrl}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#f97316,#eab308);color:#fff;font-weight:700;text-decoration:none;border-radius:10px;font-size:15px;margin-right:12px">
        Renew Now →
      </a>
      <a href="${orderUrl}" style="display:inline-block;padding:12px 24px;border:1px solid #374151;color:#d1d5db;font-weight:600;text-decoration:none;border-radius:10px;font-size:15px">
        View Order
      </a>
    `),
  };
}
