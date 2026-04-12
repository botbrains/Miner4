export interface Package {
  id: string;
  name: string;
  algorithm: string;
  hashrate: number;
  unit: string;
  price_usd: number;
  duration_hours: number;
  description: string;
  popular: number;
}

export interface Order {
  id: string;
  package_id: string;
  package_name: string;
  algorithm: string;
  hashrate: number;
  unit: string;
  price_usd: number;
  duration_hours: number;
  email: string;
  worker_name: string;
  payment_currency: string;
  payment_address: string | null;
  payment_amount: number | null;
  payment_id: string | null;
  payment_status: string;
  status: string;
  mrr_rental_id: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentInvoice {
  paymentId: string;
  payAddress: string;
  payAmount: number;
  payCurrency: string;
  paymentUrl: string;
  status: string;
}

export const SUPPORTED_CURRENCIES = [
  { id: 'btc',  label: 'Bitcoin',  symbol: '₿',  color: '#F7931A' },
  { id: 'eth',  label: 'Ethereum', symbol: 'Ξ',  color: '#627EEA' },
  { id: 'ltc',  label: 'Litecoin', symbol: 'Ł',  color: '#BFBBBB' },
  { id: 'xmr',  label: 'Monero',   symbol: 'ɱ',  color: '#FF6600' },
  { id: 'usdt', label: 'Tether',   symbol: '₮',  color: '#26A17B' },
  { id: 'usdc', label: 'USD Coin', symbol: '$',  color: '#2775CA' },
  { id: 'sol',  label: 'Solana',   symbol: '◎',  color: '#9945FF' },
  { id: 'bnb',  label: 'BNB',      symbol: 'B',  color: '#F0B90B' },
];

export const ALGORITHM_COLORS: Record<string, string> = {
  'SHA-256':  'text-orange-400 bg-orange-400/10',
  'Ethash':   'text-blue-400 bg-blue-400/10',
  'Scrypt':   'text-teal-400 bg-teal-400/10',
  'X11':      'text-purple-400 bg-purple-400/10',
  'RandomX':  'text-green-400 bg-green-400/10',
};
