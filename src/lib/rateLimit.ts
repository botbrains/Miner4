/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Each IP gets a fixed window of WINDOW_MS milliseconds.
 * Within that window at most MAX_REQUESTS calls are allowed.
 * On the first request the window is opened; it resets once it expires.
 */

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 10;

interface Entry {
  count: number;
  resetAt: number; // epoch ms when the window resets
}

const store = new Map<string, Entry>();

/**
 * Check whether the given IP is within the rate limit.
 *
 * Returns `{ allowed: true }` when the request is permitted, or
 * `{ allowed: false, retryAfterMs: number }` when the limit is exceeded.
 */
export function checkRateLimit(
  ip: string,
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const now = Date.now();

  let entry = store.get(ip);

  // Start a fresh window if none exists or the previous window has expired
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(ip, entry);
  }

  entry.count += 1;

  if (entry.count > MAX_REQUESTS) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  return { allowed: true };
}
