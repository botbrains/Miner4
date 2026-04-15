/**
 * Shared admin authentication helper.
 *
 * An incoming request is considered admin-authenticated when it presents either:
 *   1. An `x-admin-key` header matching `ADMIN_API_KEY` (for cron / API callers), OR
 *   2. A valid `admin_session` cookie signed with `ADMIN_SESSION_SECRET` (browser dashboard).
 */

import { createHmac } from 'crypto';

export function isAdminAuthorized(req: Request): boolean {
  // 1. X-Admin-Key header (for cron schedulers and API clients)
  const headerKey = req.headers.get('x-admin-key');
  if (headerKey && headerKey === process.env.ADMIN_API_KEY) return true;

  // 2. Signed session cookie (for the browser admin dashboard)
  const cookieHeader = req.headers.get('cookie') ?? '';
  const sessionMatch = cookieHeader.match(/admin_session=([^;]+)/);
  if (!sessionMatch) return false;

  const token  = sessionMatch[1];
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;

  const dotIndex = token.lastIndexOf('.');
  if (dotIndex === -1) return false;

  const payload  = token.slice(0, dotIndex);
  const sig      = token.slice(dotIndex + 1);
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  if (expected !== sig) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64').toString()) as { exp: number };
    return data.exp > Date.now();
  } catch {
    return false;
  }
}
