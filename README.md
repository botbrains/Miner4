# Miner4

A full-stack hashrate rental marketplace — like NiceHash and Mining Rig Rentals — built with **Next.js 16**, **Tailwind CSS**, and **SQLite**.

## Features

- 🖥 **Modern dark UI** — responsive, gradient-accented design with animated elements
- ⚡ **Dynamic hashrate packages** — build custom packages across SHA-256, Ethash, Scrypt, X11, RandomX with live pricing
- 🔒 **Crypto-only checkout** — integrates with [NOWPayments](https://nowpayments.io) to accept BTC, ETH, LTC, XMR, USDT, USDC, SOL, BNB
- ⛏ **Auto-provisioning** — on confirmed payment, automatically rents the best-priced rig from [Mining Rig Rentals API v2](https://www.miningrigrentals.com/apidocv2)
- 📦 **Order tracking** — real-time order status page with payment confirmation polling
- 📧 **Transactional email** — order confirmations, active mining notifications, and expiry reminders via SMTP
- 🗃 **Admin dashboard** — protected dashboard to view and filter all orders with links to MRR rentals and NOWPayments invoices
- 🛡 **Security built-in** — server-side pricing, webhook signature verification, CSRF protection, rate limiting on package creation
- 🗄 **Embedded SQLite** — zero-config database, no external services required

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.3 (App Router) |
| Styling | Tailwind CSS v4 |
| Database | SQLite via `better-sqlite3` |
| Payments | NOWPayments API |
| Mining | Mining Rig Rentals API v2 |
| Email | Nodemailer (SMTP) |
| Testing | Vitest |

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with hero, algorithm cards, how-it-works, FAQ |
| `/packages` | Interactive hashrate builder (algorithm, hashrate slider, duration, currency) |
| `/checkout/[packageId]` | Two-step checkout: enter details → pay with crypto |
| `/order/[id]` | Order status & payment tracking (auto-refreshes every 15 s while awaiting payment/confirmation) |
| `/orders` | Customer order lookup by order ID |
| `/admin` | Admin dashboard — view, filter, and manage all orders (requires login) |
| `/admin/login` | Admin login page |

## API Routes

### Public

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pricing` | GET | Live price estimate from MRR market data |
| `/api/packages` | GET | List all packages |
| `/api/packages` | POST | Create a dynamic package (rate-limited: 10 req/min per IP) |
| `/api/packages/[id]` | GET | Get a single package |
| `/api/orders` | POST | Create an order |
| `/api/orders/[id]` | GET | Get order status |
| `/api/payments/create` | POST | Create a NOWPayments invoice |
| `/api/payments/webhook` | POST | NOWPayments IPN handler — confirms payment and provisions miner |
| `/api/mrr` | GET | Proxy live market data from Mining Rig Rentals |
| `/api/pools` | GET | List curated solo mining pools (filter by `?algorithm=`) |
| `/api/rentals/[rentalId]` | GET | Fetch live MRR rental status (60 s cache) |
| `/api/health` | GET | Connectivity check for MRR, NOWPayments, and SQLite |

### Admin (authorized by session cookie or `X-Admin-Key` header; `/api/admin/login` uses credentials)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/login` | POST | Exchange email + password for a signed session cookie |
| `/api/orders` | GET | Paginated order listing with optional filters (`status`, `email`, `from`, `to`) |
| `/api/cron/expire-orders` | POST | Expire overdue orders, delete stale packages, record pricing snapshots |
| `/api/cron/expiry-reminders` | POST | Send expiry reminder emails for orders expiring within the next hour |

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/botbrains/Miner4.git
cd Miner4
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local — see Environment Variables below

# 3. Run in development
npm run dev

# 4. Or build for production
npm run build && npm start
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values below.

### Mining Rig Rentals

```env
MRR_API_KEY=        # API key from https://www.miningrigrentals.com/account/apikey
MRR_API_SECRET=     # API secret from the same page
```

### NOWPayments

```env
NOWPAYMENTS_API_KEY=    # API key from https://nowpayments.io/account
NOWPAYMENTS_IPN_SECRET= # IPN secret for webhook signature verification
```

### Base URL

The base URL is used to build callback URLs for NOWPayments webhooks.

```env
NEXT_PUBLIC_BASE_URL=https://yourdomain.com  # Exposed to the browser (used in client-side code)
BASE_URL=https://yourdomain.com              # Server-side only (takes priority over NEXT_PUBLIC_BASE_URL)
```

### Admin Dashboard

```env
ADMIN_API_KEY=          # Secret key required in the X-Admin-Key header for admin API routes
ADMIN_EMAIL=            # Admin login email
ADMIN_PASSWORD=         # Admin login password
ADMIN_SESSION_SECRET=   # Long random string used to sign admin session cookies (keep secret)
```

Generate a strong session secret with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Email (SMTP)

Leave these empty to log emails to the console in development mode.

```env
SMTP_HOST=          # e.g. smtp.gmail.com, smtp.sendgrid.net
SMTP_PORT=587       # 587 for STARTTLS, 465 for SSL
SMTP_USER=          # SMTP username / account
SMTP_PASS=          # SMTP password / API key
EMAIL_FROM=         # Sender name and address, e.g. "Miner4 <noreply@miner4.io>"
```

> **Demo mode**: You can explore the UI locally without full configuration, and if SMTP settings are omitted emails are logged to the console in development. However, pricing/package creation and miner provisioning require Mining Rig Rentals API credentials, and real payment creation/webhook verification require NOWPayments credentials.

## How the Checkout Flow Works

1. Customer picks a hashrate package and clicks **Rent Now**
2. They enter their email, pool worker username, coin, and preferred payment cryptocurrency
3. The app creates an order in SQLite and calls NOWPayments to generate a payment address
4. Customer sends the exact crypto amount to the displayed address
5. NOWPayments calls `/api/payments/webhook` on confirmation
6. The webhook verifies the IPN signature, confirms the MRR deposit, and auto-provisions the best-priced rig(s) from Mining Rig Rentals
7. The order status updates to **active** with rental ID(s) and expiry time
8. Transactional emails are sent at order creation, mining activation, and 1 hour before expiry

## Supported Algorithms

| Algorithm | Hashrate Unit | Min Hashrate |
|-----------|--------------|-------------|
| SHA-256 | TH/s | 1 TH/s |
| Ethash | MH/s | 100 MH/s |
| Scrypt | MH/s | 100 MH/s |
| X11 | GH/s | 1 GH/s |
| RandomX | KH/s | 1,000 KH/s |

## Cron Jobs

Two cron endpoints must be called periodically by your scheduler (e.g. GitHub Actions, Render cron, or cURL from a systemd timer). Both require the `X-Admin-Key` header.

| Endpoint | Recommended frequency | What it does |
|----------|-----------------------|--------------|
| `POST /api/cron/expire-orders` | Every 15 minutes | Marks overdue active orders as `expired`, deletes unordered packages older than 24 h, records hourly pricing snapshots |
| `POST /api/cron/expiry-reminders` | Every 5–15 minutes | Emails customers whose rental expires within the next hour (once per order) |

Example cURL call:

```bash
curl -X POST https://yourdomain.com/api/cron/expire-orders \
  -H "X-Admin-Key: $ADMIN_API_KEY"
```

## Admin Dashboard

Navigate to `/admin` to access the protected dashboard. You will be redirected to `/admin/login` if you are not authenticated.

- View all orders with status, algorithm, hashrate, email, and payment info
- Filter by status, date range, or email
- Links to MRR rentals and NOWPayments invoices for each order

Session cookies are `HttpOnly` and signed with `ADMIN_SESSION_SECRET`. The `X-Admin-Key` header is used only for API endpoints (cron jobs and programmatic access); it is **not** required for normal browser navigation.

## Health Check

```
GET /api/health
```

Returns HTTP `200` when all services are reachable, `503` when any are not:

```json
{ "db": "ok", "mrr": "ok", "nowpayments": "ok", "timestamp": "..." }
```

## Development

```bash
npm run dev      # Start Next.js dev server on http://localhost:3000
npm run build    # Production build
npm start        # Start production server
npm run lint     # ESLint
npm test         # Vitest unit tests
```
