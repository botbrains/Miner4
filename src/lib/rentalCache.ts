/**
 * Simple in-memory cache for MRR rental status responses.
 *
 * Responses are cached for 60 seconds to avoid hammering the MRR API when
 * multiple users refresh the same order page simultaneously.
 */

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  data: unknown;
  cachedAt: number;
}

const cache = new Map<string, CacheEntry>();

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
  cache.set(rentalId, { data, cachedAt: Date.now() });
}
