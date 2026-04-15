'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Package, PaymentInvoice } from '@/types';
import { SUPPORTED_CURRENCIES, ALGORITHM_COLORS } from '@/types';
import type { CoinConfig } from '@/config/coins';
import { ALGORITHM_COINS } from '@/config/coins';
import { CONFIRMATION_TIMES_MIN } from '@/config/confirmationTimes';
import type { PoolConfig } from '@/config/pools';

type CheckoutStep = 'details' | 'payment';

function CheckoutContent() {
  const { packageId } = useParams<{ packageId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [pkg, setPkg] = useState<Package | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<CheckoutStep>('details');
  const [invoice, setInvoice] = useState<PaymentInvoice | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAmountCopied, setIsAmountCopied] = useState(false);
  const [isAddressCopied, setIsAddressCopied] = useState(false);

  // Coin / pool state
  const [availableCoins, setAvailableCoins] = useState<CoinConfig[]>([]);
  const [selectedCoin, setSelectedCoin] = useState<CoinConfig | null>(null);
  const [availablePools, setAvailablePools] = useState<PoolConfig[]>([]);
  const [selectedPool, setSelectedPool] = useState<PoolConfig | null>(null);

  // Pre-fill currency from query param (passed by packages builder)
  const initialCurrency = searchParams.get('currency') ?? 'btc';

  // Form state
  const [form, setForm] = useState({
    email: '',
    workerName: '',
    paymentCurrency: initialCurrency,
  });
  const [workerNameError, setWorkerNameError] = useState('');

  // Fetch package and validate it is not expired or already purchased
  useEffect(() => {
    if (!packageId) return;
    fetch(`/api/packages/${packageId}`)
      .then(r => r.json())
      .then(async (d) => {
        if (!d.data) {
          router.replace('/packages?error=expired');
          return;
        }
        const p = d.data as Package;
        // Check if the package was created more than 24 hours ago
        const createdAt = new Date(p.created_at);
        if (Date.now() - createdAt.getTime() > 24 * 3600_000) {
          router.replace('/packages?error=expired');
          return;
        }
        setPkg(p);

        // Derive coins and pools for this algorithm
        const coins = ALGORITHM_COINS[p.algorithm] ?? [];
        setAvailableCoins(coins);
        setSelectedCoin(coins[0] ?? null);

        // Fetch available pools
        try {
          const poolsRes = await fetch(`/api/pools?algorithm=${encodeURIComponent(p.algorithm)}`);
          const poolsData = await poolsRes.json() as { success: boolean; data: PoolConfig[] };
          if (poolsData.success && poolsData.data.length > 0) {
            setAvailablePools(poolsData.data);
            setSelectedPool(poolsData.data[0]);
          }
        } catch { /* pools are optional */ }

        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setError('Package not found.');
      });
  }, [packageId, router]);

  const handleSubmitDetails = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkg) return;

    // Client-side coin address validation
    if (selectedCoin && form.workerName) {
      if (!selectedCoin.addressRe.test(form.workerName.split('.')[0])) {
        // Soft warning – some users may not include address in workerName
        setWorkerNameError(`Note: address may not be a valid ${selectedCoin.coin} address. Verify before proceeding.`);
      } else {
        setWorkerNameError('');
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Create order
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: pkg.id,
          email: form.email,
          workerName: form.workerName,
          paymentCurrency: form.paymentCurrency,
          coin: selectedCoin?.coin,
          poolId: selectedPool?.name,
          poolUrl: selectedPool ? `${selectedPool.host}:${selectedPool.port}` : undefined,
          poolHost: selectedPool?.host,
          poolPort: selectedPool?.port,
          poolPass: selectedPool?.password,
        }),
      });
      if (orderRes.status === 409) {
        router.replace('/packages?error=already_purchased');
        return;
      }
      const orderData = await orderRes.json();
      if (!orderData.success) throw new Error(orderData.error ?? 'Failed to create order');

      const oid = orderData.data.id as string;
      setOrderId(oid);

      // 2. Create payment invoice
      const payRes = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: oid, payCurrency: form.paymentCurrency }),
      });
      const payData = await payRes.json();
      if (!payData.success) throw new Error(payData.error ?? 'Failed to create payment');

      setInvoice(payData.data as PaymentInvoice);
      setStep('payment');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  }, [pkg, form, selectedCoin, selectedPool, router]);

  const handleCopyAmount = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setIsAmountCopied(true);
      setTimeout(() => setIsAmountCopied(false), 2000);
    });
  }, []);

  const handleCopyAddress = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setIsAddressCopied(true);
      setTimeout(() => setIsAddressCopied(false), 2000);
    });
  }, []);

  const handleConfirmed = useCallback(() => {
    if (orderId) router.push(`/order/${orderId}`);
  }, [orderId, router]);

  const confirmationTime = CONFIRMATION_TIMES_MIN[form.paymentCurrency];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400 text-lg">Package not found.</p>
        <Link href="/packages" className="text-orange-400 hover:text-orange-300">← Back to packages</Link>
      </div>
    );
  }

  const algColor = ALGORITHM_COLORS[pkg.algorithm] ?? 'text-gray-400 bg-gray-400/10';
  const currency = SUPPORTED_CURRENCIES.find(c => c.id === form.paymentCurrency);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Back link */}
      <Link href="/packages" className="inline-flex items-center gap-2 text-gray-500 hover:text-white text-sm mb-8 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to packages
      </Link>

      {/* Step indicator */}
      <div className="flex items-center gap-4 mb-10">
        {(['details', 'payment'] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className="w-12 h-px bg-gray-700" />}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all
              ${step === s || (s === 'details' && step !== 'details')
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : 'bg-gray-800 text-gray-500 border border-gray-700'
              }`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold
                ${step === s || (s === 'details' && step !== 'details') ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
                {i + 1}
              </span>
              {s === 'details' ? 'Your Details' : 'Pay with Crypto'}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: form or payment */}
        <div className="lg:col-span-2">
          {step === 'details' && (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">
              <h2 className="text-white font-bold text-2xl mb-6">Your Details</h2>
              {error && (
                <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmitDetails} className="space-y-5">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                  />
                  <p className="text-gray-500 text-xs mt-1">Order confirmation will be sent here.</p>
                </div>

                {/* Coin selector */}
                {availableCoins.length > 0 && (
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">Mine Which Coin?</label>
                    <div className="flex flex-wrap gap-2">
                      {availableCoins.map(c => (
                        <button
                          key={c.coin}
                          type="button"
                          onClick={() => setSelectedCoin(c)}
                          className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-all
                            ${selectedCoin?.coin === c.coin
                              ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                              : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:text-white'
                            }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    Worker / Stratum Username
                    {selectedCoin && <span className="text-gray-500 font-normal ml-1">({selectedCoin.coin} payout address)</span>}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={selectedCoin ? `${selectedCoin.coin.toLowerCase()}_address.worker1` : 'your_wallet_address.worker1'}
                    value={form.workerName}
                    onChange={e => { setForm(f => ({ ...f, workerName: e.target.value })); setWorkerNameError(''); }}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 text-sm font-mono focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                  />
                  {workerNameError ? (
                    <p className="text-yellow-400 text-xs mt-1">{workerNameError}</p>
                  ) : (
                    <p className="text-gray-500 text-xs mt-1">
                      Your pool username — typically <code className="text-gray-400">walletAddress.workerName</code>.
                    </p>
                  )}
                </div>

                {/* Pool selector */}
                {availablePools.length > 0 && (
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">Solo Mining Pool</label>
                    <select
                      value={selectedPool?.name ?? ''}
                      onChange={e => {
                        const p = availablePools.find(p => p.name === e.target.value);
                        setSelectedPool(p ?? null);
                      }}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                    >
                      {availablePools.map(p => (
                        <option key={p.name} value={p.name}>
                          {p.name} — {p.host}:{p.port}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Pay With</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {SUPPORTED_CURRENCIES.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, paymentCurrency: c.id }))}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-semibold transition-all
                          ${form.paymentCurrency === c.id
                            ? 'border-orange-500 bg-orange-500/10 text-white'
                            : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:text-white'
                          }`}
                      >
                        <span className="text-xl font-bold" style={{ color: c.color }}>{c.symbol}</span>
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                  {/* Confirmation time estimate */}
                  {confirmationTime !== undefined && (
                    <p className="text-gray-500 text-xs mt-2">
                      ⏱ Mining typically starts in ~{confirmationTime < 1 ? `${confirmationTime * 60} sec` : `${confirmationTime} min`} after payment (estimate)
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-bold text-base rounded-xl hover:from-orange-400 hover:to-yellow-400 transition-all shadow-lg shadow-orange-500/25 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating Invoice...
                    </span>
                  ) : (
                    `Proceed to Pay $${pkg.price_usd.toFixed(2)} →`
                  )}
                </button>
              </form>
            </div>
          )}

          {step === 'payment' && invoice && (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">
              <h2 className="text-white font-bold text-2xl mb-2">Send Payment</h2>
              <p className="text-gray-400 text-sm mb-8">
                Send exactly the amount below to the address provided. Mining starts automatically once your payment is confirmed.
              </p>

              {/* Amount */}
              <div className="p-5 rounded-xl bg-gray-800/80 border border-gray-700 mb-5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-400 text-sm">Amount to send</span>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">{invoice.payCurrency}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-black text-white font-mono">
                    {invoice.payAmount}
                  </span>
                  <button
                    onClick={() => handleCopyAmount(String(invoice.payAmount))}
                    className="text-orange-400 hover:text-orange-300 text-xs flex items-center gap-1 transition-colors"
                  >
                    {isAmountCopied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-gray-500 text-xs mt-1">≈ ${pkg.price_usd.toFixed(2)} USD</p>
              </div>

              {/* Address */}
              <div className="p-5 rounded-xl bg-gray-800/80 border border-gray-700 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Payment address</span>
                  <button
                    onClick={() => handleCopyAddress(invoice.payAddress)}
                    className="text-orange-400 hover:text-orange-300 text-xs flex items-center gap-1 transition-colors"
                  >
                    {isAddressCopied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-white font-mono text-sm break-all leading-relaxed">{invoice.payAddress}</p>
              </div>

              {/* Confirmation time estimate */}
              {confirmationTime !== undefined && (
                <div className="flex gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 mb-5">
                  <span className="text-blue-400 text-sm">⏱</span>
                  <p className="text-blue-300 text-xs leading-relaxed">
                    Mining typically starts in ~{confirmationTime < 1 ? `${confirmationTime * 60} sec` : `${confirmationTime} min`} after payment confirmation (estimate).
                  </p>
                </div>
              )}

              {/* Warning */}
              <div className="flex gap-3 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 mb-8">
                <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-yellow-300 text-xs leading-relaxed">
                  <strong className="font-semibold block mb-1">Important</strong>
                  Send exactly the amount shown above in {currency?.label ?? invoice.payCurrency}.
                  Do not send from an exchange. Payment ID: <code className="font-mono">{invoice.paymentId}</code>
                </div>
              </div>

              <button
                onClick={handleConfirmed}
                className="w-full py-3 border border-gray-700 text-gray-300 font-semibold rounded-xl hover:border-orange-500/50 hover:text-orange-400 transition-all text-sm"
              >
                I&apos;ve sent the payment → Check Order Status
              </button>
            </div>
          )}
        </div>

        {/* Right column: order summary */}
        <div className="lg:col-span-1">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 sticky top-24">
            <h3 className="text-white font-bold text-lg mb-5">Order Summary</h3>

            <div className="flex items-center justify-between mb-3">
              <span className={`px-2 py-1 rounded-md text-xs font-semibold uppercase ${algColor}`}>
                {pkg.algorithm}
              </span>
              <span className="text-gray-500 text-xs">{pkg.duration_hours}h</span>
            </div>

            <p className="text-white font-bold text-base mb-1">{pkg.name}</p>
            <p className="text-gray-400 text-sm mb-5">{pkg.description}</p>

            <div className="space-y-3 border-t border-gray-800 pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Hashrate</span>
                <span className="text-white font-semibold">{pkg.hashrate.toLocaleString()} {pkg.unit}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Duration</span>
                <span className="text-white font-semibold">{pkg.duration_hours} hours</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Algorithm</span>
                <span className="text-white font-semibold">{pkg.algorithm}</span>
              </div>
              {selectedCoin && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Mine</span>
                  <span className="text-white font-semibold">{selectedCoin.coin}</span>
                </div>
              )}
              {selectedPool && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Pool</span>
                  <span className="text-white font-semibold text-xs truncate max-w-[120px]">{selectedPool.host}</span>
                </div>
              )}
              {invoice && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Pay with</span>
                  <span className="text-white font-semibold uppercase">{invoice.payCurrency}</span>
                </div>
              )}
            </div>

            <div className="border-t border-gray-800 mt-4 pt-4 flex justify-between">
              <span className="text-white font-bold">Total</span>
              <span className="text-white font-black text-xl">${pkg.price_usd.toFixed(2)}</span>
            </div>

            <div className="mt-5 flex items-center gap-2 text-gray-500 text-xs">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Secured by NOWPayments
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <CheckoutContent />
    </Suspense>
  );
}
