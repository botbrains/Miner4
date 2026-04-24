import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ComputedPrice } from '@/lib/pricing';

// We mock at the module level before importing computePrice so the mocks
// are in place when the module is first evaluated.
vi.mock('@/lib/mrr', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/mrr')>();
  return {
    ...actual,
    hasMrrKeys: vi.fn(),
    getAvailableRigs: vi.fn(),
  };
});

vi.mock('@/lib/pricing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/pricing')>();
  return {
    ...actual,
    getBtcUsdRate: vi.fn().mockResolvedValue(60_000),
  };
});

import { computePrice, getBtcUsdRate, DEV_MARKUP_RATE, MINER4_FEE_USD } from '@/lib/pricing';
import { hasMrrKeys, getAvailableRigs } from '@/lib/mrr';

const mockHasMrrKeys       = vi.mocked(hasMrrKeys);
const mockGetAvailableRigs = vi.mocked(getAvailableRigs);
const mockGetBtcUsdRate    = vi.mocked(getBtcUsdRate);

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

  it('uses rig-based pricing when rigs are available', async () => {
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
    expect(result.source).toBe('rigs');
    expect(mockGetAvailableRigs).toHaveBeenCalled();
    // Sanity-check: price should be > fee
    expect(result.totalUsd).toBeGreaterThan(result.feeUsd);
  });

  it('applies the fixed service fee and hidden 13% markup', async () => {
    // 100 TH/s for 24h at 0.001 BTC per 100 TH/day => 0.001 BTC/day.
    // At $60,000/BTC this is $60 base cost.
    mockGetAvailableRigs.mockResolvedValue([
      {
        id: 1,
        name: 'markup-rig',
        type: 'sha256',
        status: { status: 'available' },
        hashrate: { advertised: { hash: 100, type: 'TH/s' } },
        price: { BTC: { price: 0.001 } },
      },
    ]);

    const result = await computePrice('SHA-256', 100, 24, 'TH/s');
    const expected = +((0.001 * result.btcUsdRate * (1 + DEV_MARKUP_RATE)) + MINER4_FEE_USD).toFixed(2);

    expect(result.feeUsd).toBe(MINER4_FEE_USD);
    expect(result.totalUsd).toBe(expected);
  });

  it('uses per-rig pricing when rig unit differs from input unit', async () => {
    // Per-rig pricing: one 1 PH/s rig priced at 0.1 BTC/day is required to satisfy
    // 100 TH/s (0.1 PH/s) because rentals are charged by full rig.
    mockGetAvailableRigs.mockResolvedValue([
      {
        id: 1,
        name: 'ph-rig',
        type: 'sha256',
        status: { status: 'available' },
        hashrate: { advertised: { hash: 1, type: 'PH/s' } },
        price: { BTC: { price: 0.1 } }, // 0.1 BTC per rig/day
      },
    ]);

    const result = await computePrice('SHA-256', 100, 24, 'TH/s');
    expect(result.source).toBe('rigs');
    const expected = +((0.1 * result.btcUsdRate) * (1 + DEV_MARKUP_RATE) + result.feeUsd).toFixed(2);
    expect(result.totalUsd).toBe(expected);
  });

  it('sums selected rig prices for multi-rig orders', async () => {
    mockGetAvailableRigs.mockResolvedValue([
      {
        id: 1,
        name: 'rig-1',
        type: 'sha256',
        status: { status: 'available' },
        hashrate: { advertised: { hash: 60, type: 'TH/s' } },
        price: { BTC: { price: 0.001 } },
      },
      {
        id: 2,
        name: 'rig-2',
        type: 'sha256',
        status: { status: 'available' },
        hashrate: { advertised: { hash: 50, type: 'TH/s' } },
        price: { BTC: { price: 0.0012 } },
      },
    ]);

    // Need 100 TH/s. No single rig is within ±5%, so both rigs are selected.
    const result = await computePrice('SHA-256', 100, 24, 'TH/s');
    const expectedRigCostBtc = 0.001 + 0.0012;
    const expected = +((expectedRigCostBtc * result.btcUsdRate) * (1 + DEV_MARKUP_RATE) + result.feeUsd).toFixed(2);
    expect(result.totalUsd).toBe(expected);
  });

  it('throws when no rigs are available', async () => {
    mockGetAvailableRigs.mockResolvedValue([]);

    await expect(computePrice('SHA-256', 100, 24)).rejects.toThrow(/no available rigs/i);
  });
});
