import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';

export const dynamic = 'force-dynamic';

const SESSION_COOKIE = 'admin_session';

function signToken(payload: string, secret: string): string {
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

/**
 * POST /api/admin/login
 *
 * Validates admin credentials against ADMIN_EMAIL and ADMIN_PASSWORD env vars.
 * On success, sets an HttpOnly SameSite=Strict session cookie signed with
 * ADMIN_SESSION_SECRET and returns 200.
 */
export async function POST(req: Request) {
  try {
    const { email, password } = await req.json() as { email?: string; password?: string };

    const adminEmail    = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const sessionSecret = process.env.ADMIN_SESSION_SECRET;

    if (!adminEmail || !adminPassword || !sessionSecret) {
      return NextResponse.json(
        { success: false, error: 'Admin credentials are not configured' },
        { status: 503 },
      );
    }

    if (!email || !password || email !== adminEmail || password !== adminPassword) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + 8 * 3600_000 })).toString('base64');
    const token   = signToken(payload, sessionSecret);

    const isProd = process.env.NODE_ENV === 'production';
    const cookieHeader = [
      `${SESSION_COOKIE}=${token}`,
      'HttpOnly',
      'SameSite=Strict',
      'Path=/',
      ...(isProd ? ['Secure'] : []),
    ].join('; ');

    return NextResponse.json(
      { success: true },
      { headers: { 'Set-Cookie': cookieHeader } },
    );
  } catch (err) {
    console.error('[admin/login] error:', err);
    return NextResponse.json({ success: false, error: 'Login failed' }, { status: 500 });
  }
}

/**
 * POST /api/admin/logout – clears the session cookie.
 */
export async function DELETE() {
  const cookieHeader = `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
  return NextResponse.json({ success: true }, { headers: { 'Set-Cookie': cookieHeader } });
}

/**
 * Exported helper: verify a session cookie value.
 * Returns the decoded email on success, null on failure.
 */
export function verifySessionToken(token: string): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return null;

  const dotIndex = token.lastIndexOf('.');
  if (dotIndex === -1) return null;

  const payload = token.slice(0, dotIndex);
  const sig     = token.slice(dotIndex + 1);
  const expected = createHmac('sha256', secret).update(payload).digest('hex');

  if (expected !== sig) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64').toString()) as {
      email: string;
      exp: number;
    };
    if (data.exp < Date.now()) return null;
    return data.email;
  } catch {
    return null;
  }
}
