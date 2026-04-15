import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE = 'admin_session';

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifySessionToken(token: string): Promise<boolean> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;

  const dotIndex = token.lastIndexOf('.');
  if (dotIndex === -1) return false;

  const payload  = token.slice(0, dotIndex);
  const sig      = token.slice(dotIndex + 1);
  const expected = await hmacSha256Hex(secret, payload);

  // Constant-time byte-by-byte comparison to prevent timing attacks
  const enc2 = new TextEncoder();
  const sigBytes      = enc2.encode(sig);
  const expectedBytes = enc2.encode(expected);
  if (sigBytes.length !== expectedBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < sigBytes.length; i++) {
    diff |= sigBytes[i] ^ expectedBytes[i];
  }
  if (diff !== 0) return false;

  try {
    const data = JSON.parse(atob(payload)) as { exp: number };
    return data.exp > Date.now();
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ─── Admin route protection ───────────────────────────────────────────────
  // Protect /admin/* but not /admin/login (the login page itself)
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const sessionCookie = req.cookies.get(SESSION_COOKIE)?.value;
    const valid = sessionCookie ? await verifySessionToken(sessionCookie) : false;
    if (!valid) {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }
  }

  // ─── CSRF protection on state-mutating API routes ────────────────────────
  // Webhooks and admin login are excluded because they come from external services
  // or use their own auth.
  const mutatingMethods = ['POST', 'PATCH', 'DELETE', 'PUT'];
  const exemptPaths = [
    '/api/payments/webhook', // NOWPayments IPN – external service
    '/api/admin/login',      // Login endpoint – credentials-based auth
    '/api/cron/',            // Cron endpoints – already protected by X-Admin-Key
  ];

  if (
    pathname.startsWith('/api/') &&
    mutatingMethods.includes(req.method) &&
    !exemptPaths.some(p => pathname.startsWith(p))
  ) {
    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json(
        { success: false, error: 'Content-Type must be application/json' },
        { status: 415 },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/:path*',
  ],
};
