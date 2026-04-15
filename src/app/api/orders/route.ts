import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { randomUUID } from 'crypto';
import { sendEmail } from '@/lib/email';
import { orderConfirmationEmail } from '@/lib/emailTemplates';
import { ORDER_STATUSES } from '@/types';
import { isAdminAuthorized } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

// RFC 5322-aligned email pattern: local@domain.tld
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
// Worker names must start and end with an alphanumeric character; dots, underscores,
// and hyphens are only allowed in the middle (min 1 char, max 200 chars).
const WORKER_RE = /^[a-zA-Z0-9]([a-zA-Z0-9._-]{0,198}[a-zA-Z0-9])?$/;

/** GET /api/orders – admin-only paginated order listing with optional filters. */
export async function GET(req: Request) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const email  = searchParams.get('email');
  const from   = searchParams.get('from');
  const to     = searchParams.get('to');
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
  const offset = (page - 1) * limit;

  const db = getDb();

  // Validate status if provided
  if (status && !ORDER_STATUSES.includes(status as typeof ORDER_STATUSES[number])) {
    return NextResponse.json({ success: false, error: `Invalid status: ${status}` }, { status: 400 });
  }

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status) {
    conditions.push('o.status = ?');
    params.push(status);
  }
  if (email) {
    conditions.push('o.email LIKE ?');
    params.push(`%${email}%`);
  }
  if (from) {
    conditions.push("o.created_at >= ?");
    params.push(from);
  }
  if (to) {
    conditions.push("o.created_at <= ?");
    params.push(to);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = (db.prepare(`SELECT COUNT(*) as c FROM orders o ${where}`).get(...params) as { c: number }).c;
  const orders = db.prepare(`
    SELECT o.*, p.name as package_name, p.algorithm, p.hashrate, p.unit, p.price_usd, p.duration_hours
    FROM orders o
    JOIN packages p ON o.package_id = p.id
    ${where}
    ORDER BY o.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return NextResponse.json({
    success: true,
    data: orders,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

interface OrderBody {
  packageId: string;
  email: string;
  workerName: string;
  paymentCurrency: string;
  coin?: string;
  poolId?: string;
  poolUrl?: string;
  poolHost?: string;
  poolPort?: number;
  poolPass?: string;
}

export async function POST(req: Request) {
  try {
    const body: OrderBody = await req.json();
    const {
      packageId,
      email,
      workerName,
      paymentCurrency,
      coin,
      poolId,
      poolUrl,
      poolHost,
      poolPort,
      poolPass,
    } = body;

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

    // Length check enforced at the app layer (SQLite cannot add CHECK via ALTER TABLE)
    if (workerName.length > 200) {
      return NextResponse.json(
        { success: false, error: 'workerName must not exceed 200 characters' },
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

    if (poolPort !== undefined && (!Number.isInteger(poolPort) || poolPort <= 0)) {
      return NextResponse.json(
        { success: false, error: 'poolPort must be a positive integer' },
        { status: 400 },
      );
    }

    const db  = getDb();
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(packageId) as {
      id: string;
      name: string;
      algorithm: string;
      hashrate: number;
      unit: string;
      price_usd: number;
      duration_hours: number;
    } | undefined;
    if (!pkg) {
      return NextResponse.json({ success: false, error: 'Package not found' }, { status: 404 });
    }

    // Prevent duplicate orders for the same package
    const existingOrder = db.prepare(
      `SELECT id FROM orders WHERE package_id = ? LIMIT 1`,
    ).get(packageId);
    if (existingOrder) {
      return NextResponse.json(
        { success: false, error: 'An order already exists for this package' },
        { status: 409 },
      );
    }

    const orderId = randomUUID();
    db.prepare(`
      INSERT INTO orders (
        id, package_id, email, worker_name, payment_currency, coin,
        pool_id, pool_url, pool_host, pool_port, pool_pass, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      orderId,
      packageId,
      email,
      workerName,
      paymentCurrency,
      coin ?? null,
      poolId ?? null,
      poolUrl ?? null,
      poolHost ?? null,
      poolPort ?? null,
      poolPass ?? null,
    );

    const order = db.prepare(`
      SELECT o.*, p.name as package_name, p.algorithm, p.hashrate, p.unit, p.price_usd, p.duration_hours
      FROM orders o JOIN packages p ON o.package_id = p.id
      WHERE o.id = ?
    `).get(orderId);

    // Send order confirmation email (fire-and-forget; do not fail the request on email errors)
    const confirmOpts = orderConfirmationEmail(order as Parameters<typeof orderConfirmationEmail>[0]);
    sendEmail({ to: (order as { email: string }).email, ...confirmOpts }).catch(() => {});

    return NextResponse.json({ success: true, data: order }, { status: 201 });
  } catch (err) {
    console.error('[orders] POST error:', err);
    return NextResponse.json({ success: false, error: 'Failed to create order' }, { status: 500 });
  }
}
