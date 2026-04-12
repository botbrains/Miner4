/**
 * NOWPayments API service.
 * Docs: https://documenter.getpostman.com/view/7907941/2s93JusNJt
 *
 * Set environment variable:
 *   NOWPAYMENTS_API_KEY – your NOWPayments API key
 *   NOWPAYMENTS_IPN_SECRET – IPN secret for webhook verification
 */

import { createHmac } from 'crypto';

const BASE = 'https://api.nowpayments.io/v1';

function headers() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': process.env.NOWPAYMENTS_API_KEY ?? '',
  };
}

export interface PaymentInvoice {
  paymentId: string;
  payAddress: string;
  payAmount: number;
  payCurrency: string;
  paymentUrl: string;
  status: string;
}

export interface CreatePaymentOptions {
  priceAmount: number;        // USD price
  priceCurrency: string;      // 'usd'
  payCurrency: string;        // 'btc' | 'eth' | 'ltc' | 'xmr' ...
  orderId: string;
  orderDescription: string;
  ipnCallbackUrl: string;
  successRedirectUrl: string;
  cancelRedirectUrl: string;
}

/** Create a payment invoice via NOWPayments. */
export async function createPayment(opts: CreatePaymentOptions): Promise<PaymentInvoice> {
  // Demo mode when no API key is configured
  if (!process.env.NOWPAYMENTS_API_KEY) {
    return simulatePayment(opts);
  }

  const body = {
    price_amount: opts.priceAmount,
    price_currency: opts.priceCurrency,
    pay_currency: opts.payCurrency,
    order_id: opts.orderId,
    order_description: opts.orderDescription,
    ipn_callback_url: opts.ipnCallbackUrl,
    success_url: opts.successRedirectUrl,
    cancel_url: opts.cancelRedirectUrl,
  };

  const res = await fetch(`${BASE}/payment`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NOWPayments error ${res.status}: ${text}`);
  }

  const data = await res.json() as {
    payment_id: string;
    pay_address: string;
    pay_amount: number;
    pay_currency: string;
    payment_status: string;
  };

  return {
    paymentId:  data.payment_id,
    payAddress: data.pay_address,
    payAmount:  data.pay_amount,
    payCurrency: data.pay_currency,
    paymentUrl: `https://nowpayments.io/payment/?iid=${data.payment_id}`,
    status:     data.payment_status,
  };
}

/** Get payment status. */
export async function getPaymentStatus(paymentId: string) {
  if (!process.env.NOWPAYMENTS_API_KEY) {
    return { payment_status: 'waiting', payment_id: paymentId };
  }

  const res = await fetch(`${BASE}/payment/${paymentId}`, { headers: headers() });
  if (!res.ok) throw new Error(`NOWPayments error ${res.status}`);
  return res.json();
}

/** Verify IPN webhook signature. */
export function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) return true; // no secret configured – accept all (demo)

  const expected = createHmac('sha512', secret).update(body).digest('hex');
  return expected === signature;
}

// Demo simulation for development/testing without live API keys
function simulatePayment(opts: CreatePaymentOptions): PaymentInvoice {
  const demoRates: Record<string, number> = {
    btc: 0.000016, eth: 0.00052, ltc: 0.0029, xmr: 0.0059,
    usdc: 1.0, usdt: 1.0, sol: 0.0064, bnb: 0.0014,
  };
  const rate = demoRates[opts.payCurrency.toLowerCase()] ?? 0.001;
  const payAmount = +(opts.priceAmount * rate).toFixed(8);

  const demoAddresses: Record<string, string> = {
    btc:  '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    eth:  '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    ltc:  'LdP8Qox1VAhCzLJNqrr74YovaWYyNBUWvL',
    xmr:  '888tNkZrPN6JsEgekjMnABU4TBzc2Dt29EPAvkRDZVN',
    usdc: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    usdt: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    sol:  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    bnb:  '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  };

  return {
    paymentId:   `demo-${opts.orderId}`,
    payAddress:  demoAddresses[opts.payCurrency.toLowerCase()] ?? '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    payAmount,
    payCurrency: opts.payCurrency,
    paymentUrl:  `/order/${opts.orderId}`,
    status:      'waiting',
  };
}
