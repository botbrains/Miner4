import { describe, it, expect } from 'vitest';
import { convertHashrate } from '@/lib/pricing';

describe('convertHashrate', () => {
  it('returns the same value when units are identical (with /s suffix)', () => {
    expect(convertHashrate(100, 'TH/s', 'TH/s')).toBe(100);
  });

  it('returns the same value when units are identical after normalisation (TH/s vs TH)', () => {
    expect(convertHashrate(100, 'TH/s', 'TH')).toBe(100);
  });

  it('converts TH/s → GH (×1000)', () => {
    expect(convertHashrate(1, 'TH/s', 'GH')).toBe(1_000);
  });

  it('converts GH → TH/s (÷1000)', () => {
    expect(convertHashrate(1_000, 'GH', 'TH/s')).toBe(1);
  });

  it('converts KH/s → H (×1000)', () => {
    expect(convertHashrate(1, 'KH/s', 'H')).toBe(1_000);
  });

  it('converts MH → KH (×1000)', () => {
    expect(convertHashrate(1, 'MH', 'KH')).toBe(1_000);
  });

  it('converts PH/s → TH/s (×1 000)', () => {
    expect(convertHashrate(1, 'PH/s', 'TH/s')).toBe(1_000);
  });

  it('returns the original value when fromUnit is unknown', () => {
    expect(convertHashrate(42, 'XH', 'TH')).toBe(42);
  });

  it('returns the original value when toUnit is unknown', () => {
    expect(convertHashrate(42, 'TH', 'XH')).toBe(42);
  });

  it('handles lowercase and mixed-case unit strings', () => {
    expect(convertHashrate(1, 'th/s', 'gh')).toBe(1_000);
    expect(convertHashrate(1, 'Th/S', 'gH')).toBe(1_000);
  });
});
