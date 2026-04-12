'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ALGORITHM_COLORS, SUPPORTED_CURRENCIES } from '@/types';
import type { PricingResult } from '@/app/api/pricing/route';

const ALGORITHMS: Array<{
  id: string;
  label: string;
  coin: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
}> = [
  { id: 'SHA-256',  label: 'SHA-256',  coin: 'Bitcoin (BTC)',    unit: 'TH/s', min: 10,  max: 1000, step: 10,  default: 100  },
  { id: 'Ethash',   label: 'Ethash',   coin: 'Ethereum (ETC)',   unit: 'MH/s', min: 100, max: 10000, step: 100, default: 1000 },
  { id: 'Scrypt',   label: 'Scrypt',   coin: 'Litecoin (LTC)',   unit: 'MH/s', min: 100, max: 5000, step: 100, default: 500  },
  { id: 'X11',      label: 'X11',      coin: 'Dash (DASH)',      unit: 'GH/s', min: 1,   max: 100,  step: 1,   default: 10   },
  { id: 'RandomX',  label: 'RandomX',  coin: 'Monero (XMR)',     unit: 'KH/s', min: 10,  max: 500,  step: 10,  default: 100  },
];

const DURATIONS = [
  { label: '6h',       hours: 6   },
  { label: '12h',      hours: 12  },
  { label: '24h',      hours: 24  },
  { label: '48h',      hours: 48  },
  { label: '72h',      hours: 72  },
  { label: '1 week',   hours: 168 },
];

function PackagesBuilder() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Pre-select algorithm from ?algorithm= query param (linked from homepage cards)
  const initialAlgo = ALGORITHMS.find(a => a.id === searchParams.get('algorithm')) ?? ALGORITHMS[0];

  const [algorithm, setAlgorithm] = useState(initialAlgo);
  const [hashrate, setHashrate]   = useState(initialAlgo.default);
  const [duration, setDuration]   = useState(DURATIONS[2]);     // default 24h
  const [currency, setCurrency]   = useState(SUPPORTED_CURRENCIES[0].id); // btc

  const [pricing, setPricing]         = useState<PricingResult | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch live price whenever config changes
  const fetchPricing = useCallback((algo: string, hr: number, unit: string, dur: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setPricingLoading(true);
      setPricingError(null);
      try {
        const res = await fetch(
          `/api/pricing?algorithm=${encodeURIComponent(algo)}&hashrate=${hr}&unit=${encodeURIComponent(unit)}&duration=${dur}`,
        );
        const data = await res.json() as { success: boolean; data: PricingResult; error?: string };
        if (data.success) {
          setPricing(data.data);
        } else {
          setPricingError(data.error ?? 'Failed to fetch pricing');
          setPricing(null);
        }
      } catch {
        setPricingError('Network error – could not fetch pricing');
        setPricing(null);
      } finally {
        setPricingLoading(false);
      }
    }, 400);
  }, []);

  useEffect(() => {
    fetchPricing(algorithm.id, hashrate, algorithm.unit, duration.hours);
  }, [algorithm, hashrate, duration, fetchPricing]);

  // Clear any pending debounce on unmount to avoid state updates after navigation
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleAlgorithmChange = (algo: typeof ALGORITHMS[0]) => {
    setAlgorithm(algo);
    setHashrate(algo.default);
  };

  const handleStartMining = async () => {
    if (!pricing || !pricing.keysConfigured) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Create a dynamic package record with the live-computed price
      const pkgRes = await fetch('/api/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          algorithm: algorithm.id,
          hashrate,
          unit: algorithm.unit,
          durationHours: duration.hours,
          priceUsd: pricing.totalUsd,
        }),
      });
      const pkgData = await pkgRes.json() as { success: boolean; data: { id: string }; error?: string };
      if (!pkgData.success) throw new Error(pkgData.error ?? 'Failed to create package');

      router.push(`/checkout/${pkgData.data.id}?currency=${currency}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An error occurred');
      setSubmitting(false);
    }
  };

  const algColor = ALGORITHM_COLORS[algorithm.id] ?? 'text-gray-400 bg-gray-400/10';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-black text-white mb-3">Build Your Hashrate Package</h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Choose your algorithm, set the hashrate and duration. Pricing is calculated live from Mining Rig Rentals.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Builder – left/main column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Algorithm selector */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <h2 className="text-white font-bold text-lg mb-4">
              <span className="text-orange-400 mr-2">①</span> Select Algorithm
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ALGORITHMS.map(algo => {
                const color = ALGORITHM_COLORS[algo.id] ?? 'text-gray-400 bg-gray-400/10';
                const active = algorithm.id === algo.id;
                return (
                  <button
                    key={algo.id}
                    onClick={() => handleAlgorithmChange(algo)}
                    className={`flex flex-col gap-1 p-4 rounded-xl border text-left transition-all
                      ${active
                        ? 'border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/10'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-600 hover:bg-gray-700'
                      }`}
                  >
                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase w-fit ${color}`}>
                      {algo.label}
                    </span>
                    <span className="text-gray-300 text-xs font-medium">{algo.coin}</span>
                    <span className="text-gray-500 text-xs">unit: {algo.unit}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hashrate selector */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <h2 className="text-white font-bold text-lg mb-4">
              <span className="text-orange-400 mr-2">②</span> Set Hashrate
            </h2>
            <div className="flex items-center gap-4 mb-4">
              <input
                type="number"
                min={algorithm.min}
                max={algorithm.max}
                step={algorithm.step}
                value={hashrate}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v)) setHashrate(Math.min(algorithm.max, Math.max(algorithm.min, v)));
                }}
                className="w-36 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white font-mono text-lg focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
              />
              <span className={`px-3 py-2 rounded-lg font-bold text-sm ${algColor}`}>
                {algorithm.unit}
              </span>
            </div>
            <input
              type="range"
              min={algorithm.min}
              max={algorithm.max}
              step={algorithm.step}
              value={hashrate}
              onChange={e => setHashrate(parseFloat(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer accent-orange-500"
            />
            <div className="flex justify-between text-gray-500 text-xs mt-2">
              <span>{algorithm.min.toLocaleString()} {algorithm.unit}</span>
              <span>{algorithm.max.toLocaleString()} {algorithm.unit}</span>
            </div>
          </div>

          {/* Duration selector */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <h2 className="text-white font-bold text-lg mb-4">
              <span className="text-orange-400 mr-2">③</span> Choose Duration
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {DURATIONS.map(d => (
                <button
                  key={d.hours}
                  onClick={() => setDuration(d)}
                  className={`py-3 rounded-xl border text-sm font-semibold transition-all
                    ${duration.hours === d.hours
                      ? 'border-orange-500 bg-orange-500/10 text-orange-400 shadow-lg shadow-orange-500/10'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:text-white'
                    }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Payment currency */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <h2 className="text-white font-bold text-lg mb-4">
              <span className="text-orange-400 mr-2">④</span> Pay With
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {SUPPORTED_CURRENCIES.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCurrency(c.id)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-semibold transition-all
                    ${currency === c.id
                      ? 'border-orange-500 bg-orange-500/10 text-white'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:text-white'
                    }`}
                >
                  <span className="text-xl font-bold" style={{ color: c.color }}>{c.symbol}</span>
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pricing summary – right column */}
        <div className="lg:col-span-1">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 sticky top-24">
            <h3 className="text-white font-bold text-lg mb-5">Price Summary</h3>

            {/* Config recap */}
            <div className="space-y-3 mb-5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Algorithm</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${algColor}`}>{algorithm.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Hashrate</span>
                <span className="text-white font-semibold font-mono">{hashrate.toLocaleString()} {algorithm.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Duration</span>
                <span className="text-white font-semibold">{duration.label}</span>
              </div>
            </div>

            <div className="border-t border-gray-800 pt-4 mb-5">
              {pricingLoading && (
                <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Fetching live pricing…
                </div>
              )}

              {!pricingLoading && pricingError && (
                <div className="flex items-start gap-2 text-yellow-400 text-xs py-2">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <span>{pricingError}</span>
                </div>
              )}

              {!pricingLoading && !pricingError && pricing && !pricing.keysConfigured && (
                <div className="text-yellow-400 text-xs py-2 space-y-1">
                  <p className="font-semibold">MRR keys not configured</p>
                  <p className="text-gray-500 leading-relaxed">
                    Set <code className="bg-gray-800 px-1 rounded">MRR_API_KEY</code> and <code className="bg-gray-800 px-1 rounded">MRR_API_SECRET</code> in <code className="bg-gray-800 px-1 rounded">.env.local</code> to see live pricing.
                  </p>
                </div>
              )}

              {!pricingLoading && pricing?.keysConfigured && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-400">
                    <span>Algorithm</span>
                    <span className="font-mono">{pricing.algorithm}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Duration</span>
                    <span className="font-mono">{pricing.durationHours}h</span>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-gray-800 pt-4 mb-6">
              <div className="flex justify-between items-baseline">
                <span className="text-white font-bold">Total</span>
                {pricingLoading ? (
                  <span className="text-gray-500 text-xl font-black">…</span>
                ) : pricing?.keysConfigured ? (
                  <span className="text-white font-black text-2xl">${pricing.totalUsd.toFixed(2)}</span>
                ) : (
                  <span className="text-gray-500 text-xl font-black">—</span>
                )}
              </div>
              {pricing?.keysConfigured && (
                <p className="text-gray-500 text-xs mt-1">
                  Based on {pricing.availableRigs} available rigs · BTC ≈ ${pricing.btcUsdRate.toLocaleString()}
                </p>
              )}
            </div>

            {submitError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {submitError}
              </div>
            )}

            <button
              onClick={handleStartMining}
              disabled={submitting || pricingLoading || !pricing?.keysConfigured}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-bold text-base rounded-xl hover:from-orange-400 hover:to-yellow-400 transition-all shadow-lg shadow-orange-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing…
                </span>
              ) : (
                'Start Mining →'
              )}
            </button>

            <p className="text-gray-600 text-xs text-center mt-3">
              Miners provisioned from Mining Rig Rentals on payment
            </p>
          </div>
        </div>
      </div>

      {/* Trust badges */}
      <div className="mt-16 p-6 rounded-2xl border border-gray-800 bg-gray-900/50">
        <div className="flex flex-wrap items-center justify-center gap-8">
          {[
            { icon: '🔒', text: 'Crypto-only payments – no personal data required' },
            { icon: '⚡', text: 'Auto-provisioned via Mining Rig Rentals API v2' },
            { icon: '📊', text: 'Live pricing from real MRR market data' },
            { icon: '✅', text: 'Real hashrate from verified MRR miners' },
          ].map(b => (
            <div key={b.text} className="flex items-center gap-2 text-gray-400 text-sm">
              <span className="text-lg">{b.icon}</span>
              {b.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PackagesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <PackagesBuilder />
    </Suspense>
  );
}

