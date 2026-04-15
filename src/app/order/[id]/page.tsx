'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Order } from '@/types';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; desc: string }> = {
  pending:              { label: 'Pending',           color: 'text-gray-400',   icon: '⏳', desc: 'Order created, waiting for payment details.' },
  awaiting_payment:    { label: 'Awaiting Payment',  color: 'text-yellow-400', icon: '💳', desc: 'Send your crypto payment to the address provided.' },
  active:              { label: 'Mining Active',      color: 'text-green-400',  icon: '⛏️', desc: 'Your miner is active and earning rewards.' },
  provisioning_failed: { label: 'Provisioning Failed',color: 'text-red-400',    icon: '❌', desc: 'We could not provision a miner. Please contact support.' },
  expired:             { label: 'Expired',            color: 'text-gray-500',   icon: '🕐', desc: 'This rental period has ended.' },
  payment_expired:     { label: 'Payment Expired',    color: 'text-gray-500',   icon: '⌛', desc: 'The payment window has expired.' },
  partially_paid:      { label: 'Partially Paid',     color: 'text-yellow-500', icon: '⚠️', desc: 'Partial payment received. Please top up to complete your order.' },
};

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  waiting:   { label: 'Waiting for Payment', color: 'text-yellow-400' },
  confirming:{ label: 'Confirming on Chain', color: 'text-blue-400'   },
  confirmed: { label: 'Confirmed',           color: 'text-green-400'  },
  finished:  { label: 'Finished',            color: 'text-green-400'  },
  failed:    { label: 'Failed',              color: 'text-red-400'    },
  expired:   { label: 'Expired',             color: 'text-gray-400'   },
  partially_paid: { label: 'Partially Paid', color: 'text-yellow-500' },
};

interface RentalStatus {
  rentalId: string;
  data: {
    status?: string;
    hashrate?: { hash?: number; type?: string };
    start?: string;
    end?: string;
  } | null;
  loading: boolean;
}

function getOrderRentalIds(order: Order): string[] {
  const ids: string[] = [];
  if (order.mrr_rental_ids) {
    try {
      const parsed = JSON.parse(order.mrr_rental_ids) as unknown;
      if (Array.isArray(parsed)) {
        ids.push(...parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0));
      }
    } catch {
      // ignore malformed JSON and fall back to primary rental ID
    }
  }
  if (ids.length === 0 && order.mrr_rental_id) ids.push(order.mrr_rental_id);
  return [...new Set(ids)];
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

function OrderContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState<string>('');
  const [rentalStatuses, setRentalStatuses] = useState<RentalStatus[]>([]);
  const [renewing, setRenewing] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const successParam = searchParams.get('status');

  const fetchOrder = useCallback(() => {
    if (!id) return;
    fetch(`/api/orders/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setOrder(d.data);
        else setError(d.error ?? 'Order not found');
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to fetch order');
        setLoading(false);
      });
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  // Auto-refresh while order is active/awaiting
  useEffect(() => {
    const needsRefresh = order?.status === 'awaiting_payment' || order?.payment_status === 'confirming';
    if (!needsRefresh) return;
    const refreshInterval = setInterval(fetchOrder, 15_000);
    return () => clearInterval(refreshInterval);
  }, [order, fetchOrder]);

  // Live countdown for active orders
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (order?.status === 'active' && order?.expires_at) {
      const update = () => {
        const ms = new Date(order.expires_at!).getTime() - Date.now();
        setCountdown(formatCountdown(ms));
      };
      update();
      countdownRef.current = setInterval(update, 1000);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [order?.status, order?.expires_at]);

  const refreshRentalStatuses = useCallback((activeOrder: Order) => {
    const ids = getOrderRentalIds(activeOrder);
    if (!ids.length) {
      setRentalStatuses([]);
      return;
    }

    setRentalStatuses(prev => {
      const prevById = new Map(prev.map(status => [status.rentalId, status] as const));
      return ids.map(rid => ({
        rentalId: rid,
        data: prevById.get(rid)?.data ?? null,
        loading: true,
      }));
    });

    ids.forEach(rid => {
      fetch(`/api/rentals/${rid}`)
        .then(r => r.json())
        .then(d => {
          setRentalStatuses(prev => prev.map(rs =>
            rs.rentalId === rid
              ? { ...rs, data: d.success ? d.data : null, loading: false }
              : rs,
          ));
        })
        .catch(() => {
          setRentalStatuses(prev => prev.map(rs =>
            rs.rentalId === rid ? { ...rs, loading: false } : rs,
          ));
        });
    });
  }, []);

  // Fetch live rental statuses for active orders and keep refreshing
  useEffect(() => {
    if (!order || order.status !== 'active') {
      setRentalStatuses([]);
      return;
    }

    refreshRentalStatuses(order);
    const statusInterval = setInterval(() => refreshRentalStatuses(order), 30_000);
    return () => clearInterval(statusInterval);
  }, [order, refreshRentalStatuses]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRenew = async () => {
    if (!order) return;
    setRenewing(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json() as { success: boolean; data?: { packageId: string }; error?: string };
      if (!data.success || !data.data) throw new Error(data.error ?? 'Failed to create renewal');
      router.push(`/checkout/${data.data.packageId}?currency=${order.payment_currency}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Renewal failed');
    } finally {
      setRenewing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-gray-400 text-lg">{error ?? 'Order not found'}</p>
        <Link href="/packages" className="text-orange-400 hover:text-orange-300">← Browse packages</Link>
      </div>
    );
  }

  const statusCfg   = STATUS_CONFIG[order.status]  ?? STATUS_CONFIG.pending;
  const payStatusCfg = PAYMENT_STATUS_CONFIG[order.payment_status] ?? { label: order.payment_status, color: 'text-gray-400' };

  const isActive = order.status === 'active';
  const expiresAt = order.expires_at ? new Date(order.expires_at) : null;
  const now = new Date();
  const msLeft = expiresAt ? expiresAt.getTime() - now.getTime() : null;
  const hoursLeft = msLeft !== null ? Math.max(0, msLeft / 3_600_000) : null;
  const showRenewCta = isActive && msLeft !== null && msLeft <= 2 * 3600_000;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Back */}
      <Link href="/packages" className="inline-flex items-center gap-2 text-gray-500 hover:text-white text-sm mb-8 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to packages
      </Link>

      {/* Success banner */}
      {successParam === 'success' && isActive && (
        <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3">
          <span className="text-2xl">🎉</span>
          <div>
            <p className="text-green-400 font-semibold text-sm">Payment received!</p>
            <p className="text-gray-400 text-xs mt-0.5">Your miner has been provisioned and is now active.</p>
          </div>
        </div>
      )}

      {/* Renewal CTA banner */}
      {showRenewCta && (
        <div className="mb-6 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⏰</span>
            <div>
              <p className="text-orange-400 font-semibold text-sm">Rental Expiring Soon</p>
              <p className="text-gray-400 text-xs mt-0.5">Renew now to keep mining without interruption.</p>
            </div>
          </div>
          <button
            onClick={handleRenew}
            disabled={renewing}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white font-semibold text-sm rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {renewing ? 'Creating…' : 'Renew →'}
          </button>
        </div>
      )}

      {/* Order status card */}
      <div className={`rounded-2xl border p-8 mb-6 ${isActive ? 'border-green-500/30 bg-green-500/5' : 'border-gray-800 bg-gray-900'}`}>
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Order ID</p>
            <p className="text-white font-mono text-sm">{order.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{statusCfg.icon}</span>
            <div>
              <p className={`font-bold text-base ${statusCfg.color}`}>{statusCfg.label}</p>
              <p className="text-gray-500 text-xs">{statusCfg.desc}</p>
            </div>
          </div>
        </div>

        {/* Package info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Package',   value: order.package_name },
            { label: 'Hashrate',  value: `${order.hashrate.toLocaleString()} ${order.unit}` },
            { label: 'Algorithm', value: order.algorithm },
            { label: 'Duration',  value: `${order.duration_hours}h` },
          ].map(item => (
            <div key={item.label} className="bg-gray-800/50 rounded-xl p-4">
              <p className="text-gray-500 text-xs mb-1">{item.label}</p>
              <p className="text-white font-semibold text-sm">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Active mining countdown */}
        {isActive && expiresAt && hoursLeft !== null && (
          <div className="p-5 rounded-xl bg-green-500/10 border border-green-500/20 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-green-400 font-semibold text-sm">⛏️ Mining is active</p>
                <p className="text-gray-400 text-xs mt-0.5">
                  Expires {expiresAt.toLocaleString()} ({hoursLeft.toFixed(1)}h remaining)
                </p>
              </div>
              <div className="flex items-center gap-4">
                {countdown && (
                  <div className="text-right">
                    <p className="text-gray-500 text-xs">Time left</p>
                    <p className="text-white font-mono font-bold text-xl tabular-nums">{countdown}</p>
                  </div>
                )}
                {order.mrr_rental_id && (
                  <div className="text-right">
                    <p className="text-gray-500 text-xs">Rental ID</p>
                    <p className="text-gray-300 font-mono text-xs">{order.mrr_rental_id}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Live rental statuses (multi-rig) */}
        {rentalStatuses.length > 0 && (
          <div className="mb-6">
            <h3 className="text-white font-semibold text-sm mb-3">Live Rental Status</h3>
            <div className="overflow-x-auto rounded-xl border border-gray-800">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500">
                    <th className="px-4 py-2 text-left font-medium">Rental ID</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-left font-medium">Hashrate</th>
                    <th className="px-4 py-2 text-left font-medium">Ends</th>
                  </tr>
                </thead>
                <tbody>
                  {rentalStatuses.map(rs => (
                    <tr key={rs.rentalId} className="border-b border-gray-800/50 last:border-0">
                      <td className="px-4 py-2 font-mono text-gray-300">{rs.rentalId}</td>
                      <td className="px-4 py-2">
                        {rs.loading
                          ? <span className="text-gray-500">Loading…</span>
                          : <span className="text-green-400">{rs.data?.status ?? '–'}</span>
                        }
                      </td>
                      <td className="px-4 py-2 text-gray-300">
                        {rs.data?.hashrate
                          ? `${rs.data.hashrate.hash ?? '–'} ${rs.data.hashrate.type ?? ''}`
                          : '–'
                        }
                      </td>
                      <td className="px-4 py-2 text-gray-400">
                        {rs.data?.end ? new Date(rs.data.end).toLocaleString() : '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payment details */}
        <div className="border-t border-gray-800 pt-6">
          <h3 className="text-white font-semibold text-sm mb-4">Payment Details</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Status</span>
              <span className={`font-semibold ${payStatusCfg.color}`}>{payStatusCfg.label}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Currency</span>
              <span className="text-white font-semibold uppercase">{order.payment_currency}</span>
            </div>
            {order.payment_amount && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Amount</span>
                <span className="text-white font-semibold font-mono">
                  {order.payment_amount} {order.payment_currency.toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">USD Total</span>
              <span className="text-white font-bold">${order.price_usd.toFixed(2)}</span>
            </div>
            {order.payment_address && (
              <div className="flex justify-between items-start text-sm gap-4">
                <span className="text-gray-500 flex-shrink-0">Address</span>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-white font-mono text-xs truncate">{order.payment_address}</span>
                  <button
                    onClick={() => handleCopy(order.payment_address!)}
                    className="text-orange-400 hover:text-orange-300 text-xs flex-shrink-0 transition-colors"
                  >
                    {copied ? '✓' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Renew button (always visible for active/expired) */}
      {(order.status === 'active' || order.status === 'expired') && (
        <div className="mb-6">
          <button
            onClick={handleRenew}
            disabled={renewing}
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-bold rounded-xl hover:from-orange-400 hover:to-yellow-400 transition-all shadow-lg shadow-orange-500/25 disabled:opacity-50"
          >
            {renewing ? 'Creating renewal…' : '↻ Renew This Rental'}
          </button>
        </div>
      )}

      {/* Refresh + support */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <button
          onClick={fetchOrder}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh status
        </button>
        <p className="text-gray-600 text-xs">
          Questions? <a href="mailto:support@miner4.io" className="text-gray-400 hover:text-white">support@miner4.io</a>
        </p>
      </div>
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <OrderContent />
    </Suspense>
  );
}
