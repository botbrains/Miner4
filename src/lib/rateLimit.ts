/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Each IP gets a fixed window of WINDOW_MS milliseconds.
 * Within that window at most MAX_REQUESTS calls are allowed.
 * On the first request the window is opened; it resets once it expires.
 *
 * To prevent unbounded memory growth under bot traffic, expired entries are
 * swept from the store whenever the map exceeds MAX_STORE_SIZE entries.
 */

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 10;
const MAX_STORE_SIZE = 10_000; // trigger a sweep above this threshold

interface Entry {
  count: number;
  resetAt: number; // epoch ms when the window resets
}

const store = new Map<string, Entry>();

/** Remove all entries whose window has already expired. */
function sweepExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) store.delete(key);
  }
}

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

  // Sweep expired entries when the store grows too large
  if (store.size > MAX_STORE_SIZE) sweepExpired();

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
