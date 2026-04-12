import Link from 'next/link';
import type { Package } from '@/types';
import { ALGORITHM_COLORS } from '@/types';

interface PackageCardProps {
  pkg: Package;
  highlight?: boolean;
}

function formatHashrate(hashrate: number, unit: string): string {
  return `${hashrate.toLocaleString()} ${unit}`;
}

export default function PackageCard({ pkg, highlight }: PackageCardProps) {
  const algColor = ALGORITHM_COLORS[pkg.algorithm] ?? 'text-gray-400 bg-gray-400/10';

  return (
    <div
      className={`relative flex flex-col rounded-2xl border transition-all duration-300 group
        ${highlight
          ? 'border-orange-500/60 bg-gradient-to-b from-gray-900 to-gray-900 shadow-2xl shadow-orange-500/10 scale-105'
          : 'border-gray-800 bg-gray-900 hover:border-gray-700 hover:shadow-xl hover:shadow-black/40 hover:-translate-y-1'
        }`}
    >
      {highlight && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="px-4 py-1 bg-gradient-to-r from-orange-500 to-yellow-500 text-white text-xs font-bold rounded-full shadow-lg shadow-orange-500/30 uppercase tracking-wide">
            Most Popular
          </span>
        </div>
      )}

      <div className="p-6 flex flex-col h-full">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wide ${algColor}`}>
              {pkg.algorithm}
            </span>
            <span className="text-gray-500 text-xs">{pkg.duration_hours}h rental</span>
          </div>
          <h3 className="text-white font-bold text-lg leading-snug">{pkg.name}</h3>
        </div>

        {/* Hashrate */}
        <div className="mb-5">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black text-white">{pkg.hashrate.toLocaleString()}</span>
            <span className="text-orange-400 font-bold text-lg">{pkg.unit}</span>
          </div>
          <p className="text-gray-500 text-xs mt-0.5">
            {formatHashrate(pkg.hashrate, pkg.unit)} guaranteed
          </p>
        </div>

        {/* Description */}
        <p className="text-gray-400 text-sm leading-relaxed flex-1 mb-6">{pkg.description}</p>

        {/* Features */}
        <ul className="space-y-2 mb-6">
          {[
            'Instant activation on payment',
            'Powered by Mining Rig Rentals',
            'Pay with any cryptocurrency',
            `${pkg.duration_hours}-hour rental period`,
          ].map(f => (
            <li key={f} className="flex items-center gap-2 text-gray-400 text-xs">
              <svg className="w-3.5 h-3.5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {f}
            </li>
          ))}
        </ul>

        {/* Price + CTA */}
        <div className="mt-auto">
          <div className="flex items-baseline gap-1 mb-4">
            <span className="text-3xl font-black text-white">${pkg.price_usd.toFixed(2)}</span>
            <span className="text-gray-500 text-sm">USD</span>
          </div>

          <Link
            href={`/checkout/${pkg.id}`}
            className={`block w-full text-center py-3 rounded-xl font-semibold text-sm transition-all
              ${highlight
                ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-lg shadow-orange-500/25 hover:from-orange-400 hover:to-yellow-400 hover:shadow-orange-500/40'
                : 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-700 hover:border-gray-600'
              }`}
          >
            Rent Now →
          </Link>
        </div>
      </div>
    </div>
  );
}
