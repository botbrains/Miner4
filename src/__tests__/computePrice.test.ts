import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ComputedPrice } from '@/lib/pricing';

// We mock at the module level before importing computePrice so the mocks
// are in place when the module is first evaluated.
vi.mock('@/lib/mrr', () => ({
  hasMrrKeys:          vi.fn(),
  getAlgoSuggestedPrice: vi.fn(),
  getAvailableRigs:    vi.fn(),
}));

vi.mock('@/lib/pricing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/pricing')>();
  return {
    ...actual,
    getBtcUsdRate: vi.fn().mockResolvedValue(60_000),
  };
});

import { computePrice, getBtcUsdRate } from '@/lib/pricing';
import { hasMrrKeys, getAlgoSuggestedPrice, getAvailableRigs } from '@/lib/mrr';

const mockHasMrrKeys          = vi.mocked(hasMrrKeys);
const mockGetAlgoSuggestedPrice = vi.mocked(getAlgoSuggestedPrice);
const mockGetAvailableRigs    = vi.mocked(getAvailableRigs);
const mockGetBtcUsdRate       = vi.mocked(getBtcUsdRate);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBtcUsdRate.mockResolvedValue(60_000);
  mockHasMrrKeys.mockReturnValue(true);
});

describe('computePrice', () => {
  it('returns keysConfigured=false when MRR keys are absent', async () => {
    mockHasMrrKeys.mockReturnValue(false);
    const result: ComputedPrice = await computePrice('SHA-256', 100, 24);
    expect(result.keysConfigured).toBe(false);
    expect(result.totalUsd).toBe(0);
    expect(result.source).toBe('unconfigured');
  });

  it('uses algo-suggested price path when getAlgoSuggestedPrice returns a value', async () => {
    // 0.0001 BTC per TH/s per day
    mockGetAlgoSuggestedPrice.mockResolvedValue({ btcPerUnitPerDay: 0.0001, unit: 'TH', stats: null } as Awaited<ReturnType<typeof getAlgoSuggestedPrice>>);
    const result = await computePrice('SHA-256', 100, 24);

    expect(result.keysConfigured).toBe(true);
    expect(result.source).toBe('algo-suggested');
    // Ensure getAvailableRigs was NOT called in this path
    expect(mockGetAvailableRigs).not.toHaveBeenCalled();
    // Sanity-check: price should be > fee
    expect(result.totalUsd).toBeGreaterThan(result.feeUsd);
  });

  it('falls back to rig-based pricing when getAlgoSuggestedPrice returns null', async () => {
    mockGetAlgoSuggestedPrice.mockResolvedValue(null);
    mockGetAvailableRigs.mockResolvedValue([
      {
        id: 1,
        name: 'test-rig',
        type: 'sha256',
        status: { status: 'available' },
        hashrate: { advertised: { hash: 100, type: 'TH/s' } },
        price: { BTC: { price: 0.001 } }, // 0.001 BTC per rig (100 TH/s) = 0.00001 BTC/TH
      },
    ]);

    const result = await computePrice('SHA-256', 100, 24);
    expect(result.keysConfigured).toBe(true);
    expect(result.source).toBe('rig-fallback');
    expect(mockGetAvailableRigs).toHaveBeenCalled();
  });

  it('throws when both suggested price and rigs are unavailable', async () => {
    mockGetAlgoSuggestedPrice.mockResolvedValue(null);
    mockGetAvailableRigs.mockResolvedValue([]);

    await expect(computePrice('SHA-256', 100, 24)).rejects.toThrow(/no available rigs/i);
  });

  // ---------------------------------------------------------------------------
  // Unit-conversion tests
  // ---------------------------------------------------------------------------

  it('algo-suggested path: converts caller TH/s to MRR GH when units differ', async () => {
    // MRR quotes 0.001 BTC per GH per day; caller passes 1 TH/s.
    // 1 TH = 1000 GH, so effective cost = 0.001 BTC/GH × 1000 GH × 1 day = 1 BTC
    // BTC/USD falls back to $65,000 (CoinGecko unreachable in tests).
    // total = 1 × 65,000 × 1.13 + 1.99 = 73,450 + 1.99 = 73,451.99
    mockGetAlgoSuggestedPrice.mockResolvedValue({
      btcPerUnitPerDay: 0.001,
      unit: 'GH',   // MRR's authoritative unit
      stats: null,
      name: 'x11',
    } as Awaited<ReturnType<typeof getAlgoSuggestedPrice>>);

    const result = await computePrice('X11', 1, 24, 'TH/s');  // caller: 1 TH/s

    expect(result.source).toBe('algo-suggested');
    // Should be priced as 1000 GH, not 1 GH
    expect(result.totalUsd).toBeCloseTo(73_451.99, 1);
  });

  it('algo-suggested path: no unit conversion when caller unit matches MRR unit', async () => {
    // MRR quotes 0.001 BTC per TH per day; caller passes 1 TH/s.
    // cost = 0.001 × 1 × 1 = 0.001 BTC; at $65,000: $65
    // total = 65 × 1.13 + 1.99 = 73.45 + 1.99 = 75.44
    mockGetAlgoSuggestedPrice.mockResolvedValue({
      btcPerUnitPerDay: 0.001,
      unit: 'TH',   // same unit as caller
      stats: null,
      name: 'sha256',
    } as Awaited<ReturnType<typeof getAlgoSuggestedPrice>>);

    const result = await computePrice('SHA-256', 1, 24, 'TH/s');

    expect(result.source).toBe('algo-suggested');
    expect(result.totalUsd).toBeCloseTo(75.44, 1);
  });

  it('rig-fallback path: converts caller TH/s to rig GH/s when units differ', async () => {
    // Rig reports GH/s.  Rate = 0.001 BTC / 100 GH = 0.00001 BTC/GH/day.
    // Caller requests 1 TH/s = 1000 GH, duration 24h (1 day).
    // mrrCostBtc = 0.00001 × 1000 × 1 = 0.01 BTC; at $65,000: $650
    // total = 650 × 1.13 + 1.99 = 734.50 + 1.99 = 736.49
    mockGetAlgoSuggestedPrice.mockResolvedValue(null);
    mockGetAvailableRigs.mockResolvedValue([
      {
        id: 1,
        name: 'rig-gh',
        type: 'x11',
        status: { status: 'available' },
        hashrate: { advertised: { hash: 100, type: 'GH/s' } },  // GH/s rig
        price: { BTC: { price: 0.001 } },                        // 0.001 BTC/day per 100 GH
      },
    ]);

    const result = await computePrice('X11', 1, 24, 'TH/s');   // caller: 1 TH/s

    expect(result.source).toBe('rig-fallback');
    expect(result.totalUsd).toBeCloseTo(736.49, 1);
  });

  it('rig-fallback path: filters out mixed-unit rigs to avoid incomparable BTC/hash ratios', async () => {
    // Rig 1: 100 TH/s, 0.001 BTC → rate = 0.00001 BTC/TH
    // Rig 2: 100 GH/s, 0.0001 BTC → rate = 0.000001 BTC/GH (incompatible unit)
    // With filtering, only rig 1 (TH) is used; min price = 0.00001 BTC/TH.
    // Request: 100 TH/s for 24h → cost = 0.00001 × 100 × 1 = 0.001 BTC = $65
    // total = 65 × 1.13 + 1.99 = 73.45 + 1.99 = 75.44
    mockGetAlgoSuggestedPrice.mockResolvedValue(null);
    mockGetAvailableRigs.mockResolvedValue([
      {
        id: 1,
        name: 'rig-th',
        type: 'sha256',
        status: { status: 'available' },
        hashrate: { advertised: { hash: 100, type: 'TH/s' } },
        price: { BTC: { price: 0.001 } },
      },
      {
        id: 2,
        name: 'rig-gh',
        type: 'sha256',
        status: { status: 'available' },
        hashrate: { advertised: { hash: 100, type: 'GH/s' } },
        price: { BTC: { price: 0.0001 } },
      },
    ]);

    const result = await computePrice('SHA-256', 100, 24, 'TH/s');

    expect(result.source).toBe('rig-fallback');
    // Only the TH rig was used; the GH rig's rate must not pollute Math.min
    expect(result.totalUsd).toBeCloseTo(75.44, 1);
    // availableRigs should reflect only same-unit rigs
    expect(result.availableRigs).toBe(1);
  });
});

