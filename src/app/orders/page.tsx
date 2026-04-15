'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function OrdersPage() {
  const router = useRouter();
  const [orderId, setOrderId] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = orderId.trim();
    if (!trimmed) {
      setError('Please enter an order ID.');
      return;
    }
    router.push(`/order/${trimmed}`);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-2xl mb-4">
            🔍
          </div>
          <h1 className="text-white font-black text-3xl mb-2">Look Up Your Order</h1>
          <p className="text-gray-400 text-sm">
            Enter your order ID to view payment status and mining details.
          </p>
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">
          {error && (
            <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Order ID
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                value={orderId}
                onChange={e => { setOrderId(e.target.value); setError(''); }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 text-sm font-mono focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
              />
              <p className="text-gray-500 text-xs mt-1">
                Your order ID was included in your confirmation email.
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-bold rounded-xl hover:from-orange-400 hover:to-yellow-400 transition-all shadow-lg shadow-orange-500/25"
            >
              View Order →
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <Link href="/packages" className="text-gray-500 hover:text-white text-sm transition-colors">
            ← Back to packages
          </Link>
        </div>
      </div>
    </div>
  );
}
