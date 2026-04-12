import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createPayment } from '@/lib/nowpayments';

export const dynamic = 'force-dynamic';

interface CreatePaymentBody {
  orderId: string;
  payCurrency: string;
}

export async function POST(req: Request) {
  try {
    const { orderId, payCurrency }: CreatePaymentBody = await req.json();

    if (!orderId || !payCurrency) {
      return NextResponse.json(
        { success: false, error: 'Missing orderId or payCurrency' },
        { status: 400 },
      );
    }

    const db = getDb();
    const row = db.prepare(`
      SELECT o.*, p.price_usd, p.name as package_name
      FROM orders o
      JOIN packages p ON o.package_id = p.id
      WHERE o.id = ?
    `).get(orderId) as {
      id: string;
      price_usd: number;
      package_name: string;
      status: string;
    } | undefined;

    if (!row) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }
    if (row.status !== 'pending') {
      return NextResponse.json({ success: false, error: 'Order already has a payment' }, { status: 409 });
    }

    const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

    const invoice = await createPayment({
      priceAmount: row.price_usd,
      priceCurrency: 'usd',
      payCurrency,
      orderId,
      orderDescription: `Hashrate rental – ${row.package_name}`,
      ipnCallbackUrl:     new URL('/api/payments/webhook', baseUrl).toString(),
      successRedirectUrl: new URL(`/order/${orderId}?status=success`, baseUrl).toString(),
      cancelRedirectUrl:  new URL(`/order/${orderId}?status=cancelled`, baseUrl).toString(),
    });

    db.prepare(`
      UPDATE orders
      SET payment_id      = ?,
          payment_address = ?,
          payment_amount  = ?,
          payment_currency = ?,
          payment_status  = 'waiting',
          status          = 'awaiting_payment',
          updated_at      = datetime('now')
      WHERE id = ?
    `).run(
      invoice.paymentId,
      invoice.payAddress,
      invoice.payAmount,
      invoice.payCurrency,
      orderId,
    );

    return NextResponse.json({ success: true, data: invoice });
  } catch (err) {
    console.error('[payments/create] POST error:', err);
    return NextResponse.json({ success: false, error: 'Failed to create payment' }, { status: 500 });
  }
}
