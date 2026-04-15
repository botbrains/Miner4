/**
 * Simple in-memory cache for MRR rental status responses.
 *
 * Responses are cached for 60 seconds to avoid hammering the MRR API when
 * multiple users refresh the same order page simultaneously.
 *
 * The cache is capped at MAX_CACHE_SIZE entries; when the cap is reached,
 * expired entries are swept first. If the cache is still at capacity after
 * the sweep, the oldest entry is evicted (FIFO).
 */

const CACHE_TTL_MS = 60_000;
const MAX_CACHE_SIZE = 1_000;

interface CacheEntry {
  data: unknown;
  cachedAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Evict all entries older than CACHE_TTL_MS. */
function sweepExpired(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.cachedAt > CACHE_TTL_MS) cache.delete(key);
  }
}

export function getCachedRental(rentalId: string): unknown | null {
  const entry = cache.get(rentalId);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cache.delete(rentalId);
    return null;
  }
  return entry.data;
}

export function setCachedRental(rentalId: string, data: unknown): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    // Sweep expired entries first; if still at capacity, evict the oldest.
    // JavaScript Map preserves insertion order, so keys().next() returns the
    // earliest-inserted surviving entry (FIFO).
    sweepExpired();
    if (cache.size >= MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) cache.delete(firstKey);
    }
  }
  cache.set(rentalId, { data, cachedAt: Date.now() });
}
