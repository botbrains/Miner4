/**
 * Shared algorithm configuration used by both the pricing and packages API
 * routes.  Keeping these in one place ensures the unit and minimum-hashrate
 * values are always in sync.
 *
 * Units match what Mining Rig Rentals returns in:
 *   • GET /info/algos/[NAME]  → suggested_price.unit  (primary pricing source)
 *   • GET /rig?type=…         → hashrate.advertised.type  (rig-based fallback)
 */

/**
 * Maps each supported algorithm to the hashrate unit used by MRR and
 * displayed to customers.  The trailing "/s" is cosmetic – convertHashrate
 * in src/lib/pricing.ts normalises it away when converting between units.
 */
export const ALGORITHM_UNIT_MAP: Record<string, string> = {
  'SHA-256': 'TH/s',
  'Ethash':  'MH/s',
  'Scrypt':  'MH/s',
  'X11':     'GH/s',
  'RandomX': 'KH/s',
};

/**
 * Minimum rentable hashrate per algorithm (in the algorithm's native unit).
 * POST /api/packages rejects requests below these floors.
 * UI sliders must have their minimum value ≥ these thresholds.
 */
export const ALGORITHM_MIN_HASHRATE: Record<string, number> = {
  'SHA-256': 1,
  'Ethash':  100,
  'Scrypt':  100,
  'X11':     1,
  'RandomX': 1_000,
};
