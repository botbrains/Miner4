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
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(id);
    if (!pkg) {
      return NextResponse.json({ success: false, error: 'Package not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: pkg });
  } catch (err) {
    console.error('[packages/id] GET error:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch package' }, { status: 500 });
  }
}
