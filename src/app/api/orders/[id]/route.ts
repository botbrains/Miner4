import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

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

    return NextResponse.json({ success: true, data: order });
  } catch (err) {
    console.error('[orders/id] GET error:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch order' }, { status: 500 });
  }
}
