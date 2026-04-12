'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-md border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center shadow-lg shadow-orange-500/25">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">
              Miner<span className="text-orange-400">4</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/#pricing" className="text-gray-400 hover:text-white text-sm font-medium transition-colors">
              Pricing
            </Link>
            <Link href="/packages" className="text-gray-400 hover:text-white text-sm font-medium transition-colors">
              Packages
            </Link>
            <Link href="/#how-it-works" className="text-gray-400 hover:text-white text-sm font-medium transition-colors">
              How It Works
            </Link>
            <Link href="/#faq" className="text-gray-400 hover:text-white text-sm font-medium transition-colors">
              FAQ
            </Link>
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/packages"
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white text-sm font-semibold rounded-lg hover:from-orange-400 hover:to-yellow-400 transition-all shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40"
            >
              Start Mining →
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-gray-400 hover:text-white p-2"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {open
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-gray-950 border-t border-gray-800 px-4 py-4 flex flex-col gap-4">
          <Link href="/#pricing" className="text-gray-400 hover:text-white text-sm font-medium" onClick={() => setOpen(false)}>Pricing</Link>
          <Link href="/packages" className="text-gray-400 hover:text-white text-sm font-medium" onClick={() => setOpen(false)}>Packages</Link>
          <Link href="/#how-it-works" className="text-gray-400 hover:text-white text-sm font-medium" onClick={() => setOpen(false)}>How It Works</Link>
          <Link href="/#faq" className="text-gray-400 hover:text-white text-sm font-medium" onClick={() => setOpen(false)}>FAQ</Link>
          <Link
            href="/packages"
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white text-sm font-semibold rounded-lg text-center"
            onClick={() => setOpen(false)}
          >
            Start Mining →
          </Link>
        </div>
      )}
    </header>
  );
}
