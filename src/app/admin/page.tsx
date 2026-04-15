'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Order } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  pending:              'text-gray-400 bg-gray-400/10',
  awaiting_payment:    'text-yellow-400 bg-yellow-400/10',
  active:              'text-green-400 bg-green-400/10',
  provisioning_failed: 'text-red-400 bg-red-400/10',
  expired:             'text-gray-500 bg-gray-500/10',
  payment_expired:     'text-gray-500 bg-gray-500/10',
  partially_paid:      'text-yellow-500 bg-yellow-500/10',
};

export default function AdminDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    params.set('page', String(page));
    params.set('limit', '50');

    try {
      const res = await fetch(`/api/orders?${params.toString()}`);
      if (res.status === 401) {
        router.push('/admin/login');
        return;
      }
      const data = await res.json() as {
        success: boolean;
        data: Order[];
        pagination: { total: number };
        error?: string;
      };
      if (!data.success) throw new Error(data.error);
      setOrders(data.data);
      setTotal(data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFrom, dateTo, page, router]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleBulkExpire = async () => {
    setBulkLoading(true);
    try {
      await fetch('/api/cron/expire-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      await fetchOrders();
    } finally {
      setBulkLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/login', { method: 'DELETE' });
    router.push('/admin/login');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-white font-black text-3xl">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">{total} total orders</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-gray-400 hover:text-white text-sm border border-gray-700 hover:border-gray-600 px-4 py-2 rounded-lg transition-colors"
        >
          Sign Out
        </button>
      </div>

      {/* Filters */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-gray-400 text-xs mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500"
            >
              <option value="">All statuses</option>
              {['pending','awaiting_payment','active','provisioning_failed','expired','payment_expired','partially_paid'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1); }}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500"
            />
          </div>
          <button
            onClick={() => { setStatusFilter(''); setDateFrom(''); setDateTo(''); setPage(1); }}
            className="text-gray-400 hover:text-white text-sm border border-gray-700 px-3 py-2 rounded-lg"
          >
            Clear
          </button>
          <button
            onClick={handleBulkExpire}
            disabled={bulkLoading}
            className="ml-auto bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:text-orange-300 text-sm px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {bulkLoading ? 'Running…' : '⏰ Bulk Expire Stale'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-gray-500">No orders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wide">
                  {['Order ID','Email','Status','Algorithm','Hashrate','Price','Created','Rental / Payment'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <a href={`/order/${o.id}`} className="text-orange-400 hover:text-orange-300 font-mono text-xs">
                        {o.id.slice(0, 8)}…
                      </a>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{o.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[o.status] ?? 'text-gray-400 bg-gray-400/10'}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{o.algorithm}</td>
                    <td className="px-4 py-3 text-gray-300 text-xs font-mono">
                      {o.hashrate?.toLocaleString()} {o.unit}
                    </td>
                    <td className="px-4 py-3 text-white font-semibold text-xs">
                      ${o.price_usd?.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(o.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-xs space-y-0.5">
                      {o.mrr_rental_id && (
                        <a
                          href={`https://www.miningrigrentals.com/account/rentals/${o.mrr_rental_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 block"
                        >
                          MRR #{o.mrr_rental_id}
                        </a>
                      )}
                      {o.payment_id && (
                        <a
                          href={`https://nowpayments.io/payment/?iid=${o.payment_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-400 hover:text-teal-300 block"
                        >
                          NP #{o.payment_id.slice(0, 10)}
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-between mt-6">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="text-gray-400 hover:text-white disabled:opacity-40 text-sm border border-gray-700 px-4 py-2 rounded-lg"
          >
            ← Prev
          </button>
          <span className="text-gray-500 text-sm">
            Page {page} of {Math.ceil(total / 50)}
          </span>
          <button
            disabled={page >= Math.ceil(total / 50)}
            onClick={() => setPage(p => p + 1)}
            className="text-gray-400 hover:text-white disabled:opacity-40 text-sm border border-gray-700 px-4 py-2 rounded-lg"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
