import Link from 'next/link';
import { ALGORITHM_COLORS } from '@/types';

const ALGORITHMS = [
  { id: 'SHA-256',  coin: 'Bitcoin',   symbol: '₿', unit: 'TH/s', desc: 'Mine BTC with industrial ASIC power' },
  { id: 'Ethash',   coin: 'Ethereum',  symbol: 'Ξ', unit: 'MH/s', desc: 'Ethereum-compatible GPU hashrate'    },
  { id: 'Scrypt',   coin: 'Litecoin',  symbol: 'Ł', unit: 'MH/s', desc: 'LTC & DOGE Scrypt mining rigs'      },
  { id: 'X11',      coin: 'Dash',      symbol: 'D', unit: 'GH/s', desc: 'DASH X11 algorithm hashrate'        },
  { id: 'RandomX',  coin: 'Monero',    symbol: 'ɱ', unit: 'KH/s', desc: 'Privacy-first XMR CPU mining'       },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-950/30 via-gray-950 to-gray-950 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-36 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 text-xs font-semibold mb-8 uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live Mining Marketplace
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
            Rent Hashrate{' '}
            <span className="bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">
              Instantly
            </span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            No hardware. No contracts. Choose your algorithm, set your hashrate and duration —
            pricing calculated live from Mining Rig Rentals.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/packages"
              className="px-8 py-4 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-bold text-lg rounded-xl hover:from-orange-400 hover:to-yellow-400 transition-all shadow-2xl shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-105"
            >
              Build Your Package →
            </Link>
            <a
              href="#how-it-works"
              className="px-8 py-4 border border-gray-700 text-gray-300 font-semibold text-lg rounded-xl hover:border-gray-600 hover:text-white transition-all"
            >
              How It Works
            </a>
          </div>

          {/* Stats row */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 mt-16">
            {[
              { value: '5',     label: 'Algorithms' },
              { value: '100%',  label: 'Crypto Payments' },
              { value: '<5 min', label: 'Activation Time' },
              { value: '24/7',  label: 'Live Pricing' },
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-black text-white">{stat.value}</div>
                <div className="text-gray-500 text-xs mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Algorithm cards */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Supported Algorithms</h2>
          <p className="text-gray-400">Pick an algorithm to start building your custom hashrate package.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {ALGORITHMS.map(algo => {
            const color = ALGORITHM_COLORS[algo.id] ?? 'text-gray-400 bg-gray-400/10';
            return (
              <Link
                key={algo.id}
                href={`/packages?algorithm=${encodeURIComponent(algo.id)}`}
                className="group flex items-start gap-4 p-6 rounded-2xl border border-gray-800 bg-gray-900 hover:border-gray-700 hover:shadow-xl hover:shadow-black/40 hover:-translate-y-1 transition-all duration-200"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-2xl ${color}`}>
                  {algo.symbol}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-bold">{algo.id}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${color}`}>{algo.unit}</span>
                  </div>
                  <p className="text-gray-400 text-sm font-medium">{algo.coin}</p>
                  <p className="text-gray-500 text-xs mt-1">{algo.desc}</p>
                </div>
                <svg className="w-4 h-4 text-gray-600 group-hover:text-orange-400 ml-auto mt-1 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            );
          })}

          {/* CTA card */}
          <Link
            href="/packages"
            className="group flex items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-gray-700 bg-gray-900/50 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all duration-200 text-gray-500 hover:text-orange-400 font-semibold text-sm"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Build Custom Package
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-gray-900/50 py-20 border-y border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">How It Works</h2>
            <p className="text-gray-400">Three steps to start mining without owning any hardware.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Configure Your Package',
                desc: 'Select an algorithm, set your desired hashrate and rental duration. Pricing is calculated live from Mining Rig Rentals.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                ),
              },
              {
                step: '02',
                title: 'Pay with Crypto',
                desc: 'Checkout securely using Bitcoin, Ethereum, Litecoin, Monero or any supported cryptocurrency.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              },
              {
                step: '03',
                title: 'Start Mining',
                desc: 'Once payment is confirmed, we automatically find the best-priced rig on Mining Rig Rentals and provision it for your exact hashrate and duration.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
              },
            ].map(item => (
              <div key={item.step} className="relative p-6 rounded-2xl border border-gray-800 bg-gray-900 hover:border-gray-700 transition-colors">
                <div className="absolute top-6 right-6 text-5xl font-black text-gray-800 leading-none select-none">
                  {item.step}
                </div>
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 mb-5">
                  {item.icon}
                </div>
                <h3 className="text-white font-bold text-xl mb-3">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supported coins */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black text-white mb-4">Pay with Your Favourite Crypto</h2>
          <p className="text-gray-400">We accept 8+ cryptocurrencies for seamless checkout.</p>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          {[
            { name: 'Bitcoin',   symbol: '₿', color: 'from-orange-500/20 to-yellow-500/10 border-orange-500/30 text-orange-400' },
            { name: 'Ethereum',  symbol: 'Ξ', color: 'from-blue-500/20 to-indigo-500/10 border-blue-500/30 text-blue-400' },
            { name: 'Litecoin',  symbol: 'Ł', color: 'from-gray-500/20 to-gray-400/10 border-gray-500/30 text-gray-400' },
            { name: 'Monero',    symbol: 'ɱ', color: 'from-orange-600/20 to-orange-500/10 border-orange-600/30 text-orange-500' },
            { name: 'Tether',    symbol: '₮', color: 'from-teal-500/20 to-green-500/10 border-teal-500/30 text-teal-400' },
            { name: 'USD Coin',  symbol: '$', color: 'from-blue-600/20 to-blue-500/10 border-blue-600/30 text-blue-300' },
            { name: 'Solana',    symbol: '◎', color: 'from-purple-500/20 to-violet-500/10 border-purple-500/30 text-purple-400' },
            { name: 'BNB',       symbol: 'B', color: 'from-yellow-500/20 to-yellow-400/10 border-yellow-500/30 text-yellow-400' },
          ].map(c => (
            <div key={c.name} className={`flex items-center gap-3 px-5 py-3 rounded-full border bg-gradient-to-r ${c.color}`}>
              <span className="font-bold text-lg">{c.symbol}</span>
              <span className="text-white text-sm font-medium">{c.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-gray-900/50 py-20 border-y border-gray-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-white mb-4">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: 'How is pricing calculated?',
                a: 'We fetch live pricing from Mining Rig Rentals for your chosen algorithm. Your cost is based on the current market rate for your chosen hashrate and duration, plus a small $1.99 Miner4 service fee.',
              },
              {
                q: 'How quickly does mining start?',
                a: 'Once your cryptocurrency payment is confirmed on-chain, our system automatically provisions mining rigs through Mining Rig Rentals. Activation typically takes less than 5 minutes.',
              },
              {
                q: 'Which coins can I mine?',
                a: 'It depends on the algorithm you rent. SHA-256 lets you mine Bitcoin. Ethash works for Ethereum-compatible networks. Scrypt mines Litecoin and Dogecoin. RandomX is for Monero.',
              },
              {
                q: 'Do you accept fiat payments?',
                a: 'No. We are a crypto-native platform and only accept cryptocurrency payments via NOWPayments. This allows for instant global settlements with no chargebacks.',
              },
              {
                q: 'Can I extend my rental?',
                a: 'At the moment, each order is a fixed-duration rental. To continue mining, simply place a new order after your current rental expires.',
              },
            ].map(item => (
              <details key={item.q} className="group rounded-xl border border-gray-800 bg-gray-900">
                <summary className="flex items-center justify-between p-5 cursor-pointer text-white font-semibold text-sm select-none">
                  {item.q}
                  <svg className="w-4 h-4 text-gray-500 group-open:rotate-180 transition-transform flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="px-5 pb-5 text-gray-400 text-sm leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h2 className="text-4xl md:text-5xl font-black text-white mb-6">Ready to Start Mining?</h2>
        <p className="text-gray-400 text-xl mb-10 max-w-xl mx-auto">
          Pick an algorithm, set your hashrate, pay with crypto, and let our platform handle the rest.
        </p>
        <Link
          href="/packages"
          className="inline-flex items-center gap-2 px-10 py-5 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-bold text-lg rounded-xl hover:from-orange-400 hover:to-yellow-400 transition-all shadow-2xl shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-105"
        >
          Build Your Package →
        </Link>
      </section>
    </>
  );
}
