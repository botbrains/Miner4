import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ORDER_STATUSES } from '@/types';
import { isAdminAuthorized } from '@/lib/adminAuth';
import { DEFAULT_ALGO_UNITS } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const db = getDb();

    const order = db.prepare(`
      SELECT o.*, p.name as package_name, p.algorithm, p.hashrate, p.unit,
             p.price_usd, p.duration_hours
      FROM orders o
      JOIN packages p ON o.package_id = p.id
      WHERE o.id = ?
    `).get(id);

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const orderWithDisplayUnit = {
      ...(order as Record<string, unknown>),
      unit: DEFAULT_ALGO_UNITS[(order as { algorithm?: string }).algorithm ?? ''] ?? (order as { unit?: string }).unit,
    };

    return NextResponse.json({ success: true, data: orderWithDisplayUnit });
  } catch (err) {
    console.error('[orders/id] GET error:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch order' }, { status: 500 });
  }
}

/** PATCH /api/orders/:id – admin-only status override. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json() as { status?: string };

    if (!body.status) {
      return NextResponse.json({ success: false, error: 'Missing required field: status' }, { status: 400 });
    }

    if (!ORDER_STATUSES.includes(body.status as typeof ORDER_STATUSES[number])) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Allowed values: ${ORDER_STATUSES.join(', ')}` },
        { status: 400 },
      );
    }

    const db = getDb();
    const result = db.prepare(
      "UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(body.status, id);

    if (result.changes === 0) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const order = db.prepare(`
      SELECT o.*, p.name as package_name, p.algorithm, p.hashrate, p.unit,
             p.price_usd, p.duration_hours
      FROM orders o
      JOIN packages p ON o.package_id = p.id
      WHERE o.id = ?
    `).get(id);

    const orderWithDisplayUnit = order
      ? {
          ...(order as Record<string, unknown>),
          unit: DEFAULT_ALGO_UNITS[(order as { algorithm?: string }).algorithm ?? ''] ?? (order as { unit?: string }).unit,
        }
      : order;

    return NextResponse.json({ success: true, data: orderWithDisplayUnit });
  } catch (err) {
    console.error('[orders/id] PATCH error:', err);
    return NextResponse.json({ success: false, error: 'Failed to update order' }, { status: 500 });
  }
}
