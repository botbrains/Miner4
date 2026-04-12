import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

interface OrderBody {
  packageId: string;
  email: string;
  workerName: string;
  paymentCurrency: string;
}

export async function POST(req: Request) {
  try {
    const body: OrderBody = await req.json();
    const { packageId, email, workerName, paymentCurrency } = body;

    if (!packageId || !email || !workerName || !paymentCurrency) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: packageId, email, workerName, paymentCurrency' },
        { status: 400 },
      );
    }

    const db  = getDb();
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(packageId) as { id: string } | undefined;
    if (!pkg) {
      return NextResponse.json({ success: false, error: 'Package not found' }, { status: 404 });
    }

    const orderId = randomUUID();
    db.prepare(`
      INSERT INTO orders (id, package_id, email, worker_name, payment_currency, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(orderId, packageId, email, workerName, paymentCurrency);

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    return NextResponse.json({ success: true, data: order }, { status: 201 });
  } catch (err) {
    console.error('[orders] POST error:', err);
    return NextResponse.json({ success: false, error: 'Failed to create order' }, { status: 500 });
  }
}
