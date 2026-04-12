# Miner4

A full-stack hashrate rental marketplace — like NiceHash and Mining Rig Rentals — built with **Next.js 16**, **Tailwind CSS**, and **SQLite**.

## Features

- 🖥 **Modern dark UI** — responsive, gradient-accented design with animated elements
- ⚡ **Dynamic hashrate packages** — build custom packages across SHA-256, Ethash, Scrypt, X11, RandomX with live pricing
- 🔒 **Crypto-only checkout** — integrates with [NOWPayments](https://nowpayments.io) to accept BTC, ETH, LTC, XMR, USDT, USDC, SOL, BNB
- ⛏ **Auto-provisioning** — on confirmed payment, automatically rents the best-priced rig from [Mining Rig Rentals API v2](https://www.miningrigrentals.com/apidoc/v2)
- 📦 **Order tracking** — real-time order status page with payment confirmation polling
- 🗄 **Embedded SQLite** — zero-config database, no external services required

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS v4 |
| Database | SQLite via `better-sqlite3` |
| Payments | NOWPayments API |
| Mining | Mining Rig Rentals API v2 |

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with hero, algorithm cards, how-it-works, FAQ |
| `/packages` | Interactive hashrate builder (algorithm, hashrate slider, duration, currency) |
| `/checkout/[packageId]` | Two-step checkout: enter details → pay with crypto |
| `/order/[id]` | Order status & payment tracking (auto-refreshes) |

## API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pricing` | GET | Live price from MRR market data |
| `/api/packages` | GET | List all hashrate packages |
| `/api/packages` | POST | Create a dynamic package with computed price |
| `/api/packages/[id]` | GET | Get a single package |
| `/api/orders` | POST | Create an order |
| `/api/orders/[id]` | GET | Get order status |
| `/api/payments/create` | POST | Create a NOWPayments invoice |
| `/api/payments/webhook` | POST | Handle payment confirmation & auto-provision miner |
| `/api/mrr` | GET | Proxy live price data from Mining Rig Rentals |

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/botbrains/Miner4.git
cd Miner4
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your MRR and NOWPayments API keys

# 3. Run in development
npm run dev

# 4. Or build for production
npm run build && npm start
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your API keys:

```env
MRR_API_KEY=            # Mining Rig Rentals API key
MRR_API_SECRET=         # Mining Rig Rentals API secret
NOWPAYMENTS_API_KEY=    # NOWPayments API key
NOWPAYMENTS_IPN_SECRET= # NOWPayments IPN secret for webhook verification
NEXT_PUBLIC_BASE_URL=   # Your production URL (for webhook callbacks)
# Also accepted as BASE_URL for server-side-only use
BASE_URL=               # Optional server-side-only base URL
```

> **Demo mode**: The app works without API keys — payments and miner provisioning are simulated for development.

## How the Checkout Flow Works

1. Customer picks a hashrate package and clicks **Rent Now**
2. They enter their email, pool worker username, and preferred cryptocurrency
3. The app creates an order in SQLite and calls NOWPayments to generate a payment address
4. Customer sends the exact crypto amount to the displayed address
5. NOWPayments calls the `/api/payments/webhook` endpoint on confirmation
6. The webhook auto-provisions the best available rig from Mining Rig Rentals API v2
7. The order status updates to **active** with rental ID and expiry time
