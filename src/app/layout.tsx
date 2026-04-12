import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: 'Miner4 – Rent Hashrate Instantly',
  description: 'Rent mining hashrate on demand. Pay with Bitcoin, Ethereum, or any cryptocurrency. Powered by Mining Rig Rentals.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white min-h-screen font-sans">
        <Header />
        <main className="pt-16">
          {children}
        </main>
        <footer className="border-t border-gray-800 mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="md:col-span-2">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <span className="text-white font-bold text-xl">Miner<span className="text-orange-400">4</span></span>
                </div>
                <p className="text-gray-500 text-sm leading-relaxed max-w-sm">
                  Rent mining hashrate instantly. No hardware required, no long-term commitment.
                  Pay with crypto and start mining in minutes.
                </p>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-4 text-sm">Product</h4>
                <ul className="space-y-2">
                  {[['Packages', '/packages'], ['How It Works', '/#how-it-works'], ['Pricing', '/#pricing']].map(([l, h]) => (
                    <li key={l}><a href={h} className="text-gray-500 hover:text-white text-sm transition-colors">{l}</a></li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-4 text-sm">Support</h4>
                <ul className="space-y-2">
                  {[['FAQ', '/#faq'], ['Contact', 'mailto:support@miner4.io']].map(([l, h]) => (
                    <li key={l}><a href={h} className="text-gray-500 hover:text-white text-sm transition-colors">{l}</a></li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-gray-600 text-xs">© {new Date().getFullYear()} Miner4. All rights reserved.</p>
              <p className="text-gray-600 text-xs">Powered by Mining Rig Rentals API v2</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
