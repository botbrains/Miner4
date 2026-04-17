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
    mockGetAlgoSuggestedPrice.mockResolvedValue({ btcPerUnitPerDay: 0.0001 } as Awaited<ReturnType<typeof getAlgoSuggestedPrice>>);
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

  it('converts hashrate units when suggested-price unit differs from input unit', async () => {
    // 0.1 BTC / PH / day with BTC=60k.
    // 100 TH/s = 0.1 PH/s, so base USD should be 600 before markup/fee.
    mockGetAlgoSuggestedPrice.mockResolvedValue({
      name: 'sha256',
      btcPerUnitPerDay: 0.1,
      unit: 'PH',
    });

    const result = await computePrice('SHA-256', 100, 24, 'TH/s');
    expect(result.source).toBe('algo-suggested');
    const expected = +((0.1 * 0.1 * result.btcUsdRate) * 1.13 + result.feeUsd).toFixed(2);
    expect(result.totalUsd).toBe(expected);
  });

  it('handles suggested-price units expressed as PH/day for SHA-256', async () => {
    mockGetAlgoSuggestedPrice.mockResolvedValue({
      name: 'sha256',
      btcPerUnitPerDay: 0.1,
      unit: 'PH/day',
    });

    const result = await computePrice('SHA-256', 100, 24, 'TH/s');
    expect(result.source).toBe('algo-suggested');
    const expected = +((0.1 * 0.1 * result.btcUsdRate) * 1.13 + result.feeUsd).toFixed(2);
    expect(result.totalUsd).toBe(expected);
  });


  it('handles suggested-price units expressed as Price/PH/Day for SHA-256', async () => {
    mockGetAlgoSuggestedPrice.mockResolvedValue({
      name: 'sha256',
      btcPerUnitPerDay: 0.1,
      unit: 'Price/PH/Day',
    });

    const result = await computePrice('SHA-256', 100, 24, 'TH/s');
    expect(result.source).toBe('algo-suggested');
    const expected = +((0.1 * 0.1 * result.btcUsdRate) * 1.13 + result.feeUsd).toFixed(2);
    expect(result.totalUsd).toBe(expected);
  });
  it('handles suggested-price units expressed as PH/day/ for SHA-256', async () => {
    mockGetAlgoSuggestedPrice.mockResolvedValue({
      name: 'sha256',
      btcPerUnitPerDay: 0.1,
      unit: 'PH/day/',
    });

    const result = await computePrice('SHA-256', 100, 24, 'TH/s');
    expect(result.source).toBe('algo-suggested');
    const expected = +((0.1 * 0.1 * result.btcUsdRate) * 1.13 + result.feeUsd).toFixed(2);
    expect(result.totalUsd).toBe(expected);
  });
  it('converts hashrate units on rig-fallback pricing path', async () => {
    mockGetAlgoSuggestedPrice.mockResolvedValue(null);
    mockGetAvailableRigs.mockResolvedValue([
      {
        id: 1,
        name: 'ph-rig',
        type: 'sha256',
        status: { status: 'available' },
        hashrate: { advertised: { hash: 1, type: 'PH/s' } },
        price: { BTC: { price: 0.1 } }, // 0.1 BTC per PH/day
      },
    ]);

    const result = await computePrice('SHA-256', 100, 24, 'TH/s');
    expect(result.source).toBe('rig-fallback');
    const expected = +((0.1 * 0.1 * result.btcUsdRate) * 1.13 + result.feeUsd).toFixed(2);
    expect(result.totalUsd).toBe(expected);
  });

  it('throws when both suggested price and rigs are unavailable', async () => {
    mockGetAlgoSuggestedPrice.mockResolvedValue(null);
    mockGetAvailableRigs.mockResolvedValue([]);

    await expect(computePrice('SHA-256', 100, 24)).rejects.toThrow(/no available rigs/i);
  });
});
