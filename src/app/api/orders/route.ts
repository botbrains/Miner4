import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

// RFC 5322-aligned email pattern: local@domain.tld
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
// Worker names must start and end with an alphanumeric character; dots, underscores,
// and hyphens are only allowed in the middle (min 1 char, max 200 chars).
const WORKER_RE = /^[a-zA-Z0-9]([a-zA-Z0-9._-]{0,198}[a-zA-Z0-9])?$/;

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

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 },
      );
    }

    if (!WORKER_RE.test(workerName)) {
      return NextResponse.json(
        {
          success: false,
          error: 'workerName must be 1–200 alphanumeric characters; dots, underscores, and hyphens are allowed in the middle but not at the start or end',
        },
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

