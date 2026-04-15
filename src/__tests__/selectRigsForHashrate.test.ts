import { describe, it, expect } from 'vitest';
import { selectRigsForHashrate } from '@/lib/mrr';
import type { MrrRig } from '@/lib/mrr';

/** Minimal rig factory for test readability. */
function rig(id: number, hash: number, pricePerRig: number, type = 'TH/s'): MrrRig {
  return {
    id,
    name: `rig-${id}`,
    type: 'sha256',
    status: { status: 'available' },
    hashrate: { advertised: { hash, type } },
    price: { BTC: { price: pricePerRig } },
  };
}

describe('selectRigsForHashrate', () => {
  it('returns null when no rigs are provided', () => {
    expect(selectRigsForHashrate([], 100, 'TH/s')).toBeNull();
  });

  it('returns the single rig when it is within ±5%', () => {
    const result = selectRigsForHashrate([rig(1, 100, 0.001)], 100, 'TH/s');
    expect(result).not.toBeNull();
    expect(result!.length).toBe(1);
    expect(result![0].id).toBe(1);
  });

  it('chooses the cheapest rig when multiple are within ±5%', () => {
    const rigs = [
      rig(1, 100, 0.002), // more expensive
      rig(2, 100, 0.001), // cheaper
    ];
    const result = selectRigsForHashrate(rigs, 100, 'TH/s');
    expect(result).not.toBeNull();
    expect(result![0].id).toBe(2);
  });

  it('falls through to aggregation when single rig is outside ±5%', () => {
    // Rig has 200 TH/s but we need 100: outside the ±5% window for single-rig match
    // Two smaller rigs that together meet 100 TH/s should be used instead
    const rigs = [
      rig(1, 200, 0.005),  // way over threshold — won't be single-rig match for 100
      rig(2, 50, 0.0005),  // cheap, will be selected first in aggregation
      rig(3, 55, 0.0006),
    ];
    const result = selectRigsForHashrate(rigs, 100, 'TH/s');
    expect(result).not.toBeNull();
    // Must reach >= 95 TH/s total
    const total = result!.reduce((s, r) => s + r.hashrate.advertised.hash, 0);
    expect(total).toBeGreaterThanOrEqual(95);
  });

  it('aggregates multiple rigs until threshold is met', () => {
    const rigs = [
      rig(1, 30, 0.0003),
      rig(2, 30, 0.0003),
      rig(3, 30, 0.0003),
      rig(4, 30, 0.0003),
    ];
    // Need 100 TH/s — four rigs of 30 = 120 TH/s total, which meets ≥ 95 TH/s
    const result = selectRigsForHashrate(rigs, 100, 'TH/s');
    expect(result).not.toBeNull();
    const total = result!.reduce((s, r) => s + r.hashrate.advertised.hash, 0);
    expect(total).toBeGreaterThanOrEqual(95);
  });

  it('returns null when rigs have a different unit', () => {
    // Rig unit is MH/s but required unit is TH/s
    const result = selectRigsForHashrate([rig(1, 100, 0.001, 'MH/s')], 100, 'TH/s');
    expect(result).toBeNull();
  });

  it('returns null when total hashrate across all rigs is insufficient', () => {
    const rigs = [rig(1, 10, 0.001), rig(2, 10, 0.001)];
    // Need 100 TH/s but only 20 available
    const result = selectRigsForHashrate(rigs, 100, 'TH/s');
    expect(result).toBeNull();
  });
});
