'use client';

import { useState, useEffect } from 'react';
import PackageCard from '@/components/PackageCard';
import type { Package } from '@/types';

const ALGORITHMS = ['All', 'SHA-256', 'Ethash', 'Scrypt', 'X11', 'RandomX'];

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState<'price_asc' | 'price_desc' | 'hashrate_desc'>('price_asc');

  useEffect(() => {
    fetch('/api/packages')
      .then(r => r.json())
      .then(d => {
        setPackages(d.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
              onClick={() => setFilter(algo)}
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
            { icon: '✅', text: 'Confirmed miners before rental starts' },
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
