'use client';

import { useState, useEffect, useCallback } from 'react';
import PackageCard from '@/components/PackageCard';
import type { Package } from '@/types';
import type { MrrMarketData } from '@/app/api/mrr/route';

const ALGORITHMS = ['All', 'SHA-256', 'Ethash', 'Scrypt', 'X11', 'RandomX'];

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState<'price_asc' | 'price_desc' | 'hashrate_desc'>('price_asc');

  const [mrrData, setMrrData] = useState<MrrMarketData | null>(null);
  const [mrrLoading, setMrrLoading] = useState(false);

  useEffect(() => {
    fetch('/api/packages')
      .then(r => r.json())
      .then(d => {
        setPackages(d.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Fetch live MRR data when a specific algorithm is selected
  const fetchMrrData = useCallback((algorithm: string) => {
    if (algorithm === 'All') {
      setMrrData(null);
      return;
    }
    setMrrLoading(true);
    fetch(`/api/mrr?algorithm=${encodeURIComponent(algorithm)}`)
      .then(r => r.json())
      .then(d => {
        setMrrData((d.data as MrrMarketData) ?? null);
        setMrrLoading(false);
      })
      .catch(() => setMrrLoading(false));
  }, []);

  const handleFilterChange = (algo: string) => {
    setFilter(algo);
    fetchMrrData(algo);
  };

  const filtered = packages
    .filter(p => filter === 'All' || p.algorithm === filter)
    .sort((a, b) => {
      if (sort === 'price_asc')      return a.price_usd - b.price_usd;
      if (sort === 'price_desc')     return b.price_usd - a.price_usd;
      if (sort === 'hashrate_desc')  return b.hashrate - a.hashrate;
      return 0;
    });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Page header */}
      <div className="mb-10">
        <h1 className="text-4xl font-black text-white mb-3">Hashrate Packages</h1>
        <p className="text-gray-400 text-lg">
          Choose from {packages.length} packages across {ALGORITHMS.length - 1} mining algorithms.
          All prices in USD, pay with any cryptocurrency.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        {/* Algorithm filter */}
        <div className="flex flex-wrap gap-2">
          {ALGORITHMS.map(algo => (
            <button
              key={algo}
              onClick={() => handleFilterChange(algo)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all
                ${filter === algo
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700'
                }`}
            >
              {algo}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="sm:ml-auto">
          <select
            value={sort}
            onChange={e => setSort(e.target.value as typeof sort)}
            className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500"
          >
            <option value="price_asc">Price: Low → High</option>
            <option value="price_desc">Price: High → Low</option>
            <option value="hashrate_desc">Hashrate: High → Low</option>
          </select>
        </div>
      </div>

      {/* Live MRR market data panel (shown when an algorithm is selected) */}
      {filter !== 'All' && (
        <div className="mb-8 rounded-2xl border border-gray-800 bg-gray-900/60 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white font-semibold text-sm">
              Live Market Data — {filter} on Mining Rig Rentals
            </span>
            {mrrLoading && (
              <svg className="w-3.5 h-3.5 text-gray-400 animate-spin ml-1" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
          </div>

          {!mrrLoading && mrrData && !mrrData.keysConfigured && (
            <div className="flex items-center gap-2 text-yellow-400 text-sm">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              MRR API keys not configured — set <code className="font-mono text-xs bg-gray-800 px-1 py-0.5 rounded mx-1">MRR_API_KEY</code> and <code className="font-mono text-xs bg-gray-800 px-1 py-0.5 rounded mx-1">MRR_API_SECRET</code> to see live market data.
            </div>
          )}

          {!mrrLoading && mrrData?.keysConfigured && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                <div className="bg-gray-800/60 rounded-xl p-3">
                  <p className="text-gray-500 text-xs mb-1">Rigs Available</p>
                  <p className="text-white font-bold text-xl">{mrrData.count}</p>
                </div>
                <div className="bg-gray-800/60 rounded-xl p-3">
                  <p className="text-gray-500 text-xs mb-1">Min Price</p>
                  <p className="text-green-400 font-bold text-lg font-mono">
                    {mrrData.minBtcPerHash != null ? `${mrrData.minBtcPerHash.toFixed(6)} BTC` : '—'}
                  </p>
                </div>
                <div className="bg-gray-800/60 rounded-xl p-3">
                  <p className="text-gray-500 text-xs mb-1">Avg Price</p>
                  <p className="text-white font-bold text-lg font-mono">
                    {mrrData.avgBtcPerHash != null ? `${mrrData.avgBtcPerHash.toFixed(6)} BTC` : '—'}
                  </p>
                </div>
                <div className="bg-gray-800/60 rounded-xl p-3">
                  <p className="text-gray-500 text-xs mb-1">Max Price</p>
                  <p className="text-gray-400 font-bold text-lg font-mono">
                    {mrrData.maxBtcPerHash != null ? `${mrrData.maxBtcPerHash.toFixed(6)} BTC` : '—'}
                  </p>
                </div>
              </div>

              {mrrData.topRigs.length > 0 && (
                <>
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">
                    Top Available Rigs on MRR
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-500 text-xs border-b border-gray-800">
                          <th className="text-left pb-2 font-medium">Rig ID</th>
                          <th className="text-left pb-2 font-medium">Name</th>
                          <th className="text-right pb-2 font-medium">Hashrate</th>
                          <th className="text-right pb-2 font-medium">Price (BTC)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {mrrData.topRigs.map(rig => (
                          <tr key={rig.id} className="text-gray-300">
                            <td className="py-2 font-mono text-xs text-gray-500">{rig.id}</td>
                            <td className="py-2 truncate max-w-[180px]">{rig.name}</td>
                            <td className="py-2 text-right font-mono">
                              {rig.hashrate.toLocaleString()} {rig.hashrateUnit}
                            </td>
                            <td className="py-2 text-right font-mono text-orange-400">
                              {rig.priceBtc.toFixed(6)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Results count */}
      <p className="text-gray-500 text-sm mb-6">
        Showing {filtered.length} package{filtered.length !== 1 ? 's' : ''}
        {filter !== 'All' ? ` for ${filter}` : ''}
      </p>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-80 rounded-2xl bg-gray-800/50 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg">No packages found for this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {filtered.map(pkg => (
            <PackageCard key={pkg.id} pkg={pkg} highlight={!!pkg.popular} />
          ))}
        </div>
      )}

      {/* Trust badges */}
      <div className="mt-16 p-6 rounded-2xl border border-gray-800 bg-gray-900/50">
        <div className="flex flex-wrap items-center justify-center gap-8">
          {[
            { icon: '🔒', text: 'Crypto-only payments – no personal data required' },
            { icon: '⚡', text: 'Auto-provisioned via Mining Rig Rentals API v2' },
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

