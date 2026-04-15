import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hasMrrKeys } from '@/lib/mrr';

export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 3_000;

async function checkMrr(): Promise<'ok' | 'error'> {
  if (!hasMrrKeys()) return 'error';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch('https://www.miningrigrentals.com/api/v2/info/algos', {
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}

async function checkNowPayments(): Promise<'ok' | 'error'> {
  if (!process.env.NOWPAYMENTS_API_KEY) return 'error';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch('https://api.nowpayments.io/v1/status', {
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}

function checkDb(): 'ok' | 'error' {
  try {
    const db = getDb();
    db.prepare('SELECT 1').get();
    return 'ok';
  } catch {
    return 'error';
  }
}

/**
 * GET /api/health
 *
 * Returns connectivity status for all external dependencies.
 * HTTP 200 when all are healthy, HTTP 503 when any fail.
 */
export async function GET() {
  const [mrr, nowpayments] = await Promise.all([checkMrr(), checkNowPayments()]);
  const db = checkDb();

  const allOk = db === 'ok' && mrr === 'ok' && nowpayments === 'ok';

  return NextResponse.json(
    { db, mrr, nowpayments, timestamp: new Date().toISOString() },
    { status: allOk ? 200 : 503 },
  );
}
