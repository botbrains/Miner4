# Miner4 – Feature TODO

Tracks all features needed to fully support **renting**, **managing**, and
**observing** purchased hashrate packages.

---

## Legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done

---

## 1. Renting (Purchase Flow)

These features cover everything from configuring a hashrate package through to
a confirmed, active rental.

### 1.1 Package Creation
- [x] `POST /api/packages` – create dynamic package with server-side pricing
- [x] `GET /api/packages/:id` – fetch a single package by ID
- [x] Algorithm allowlist + server-authoritative unit derivation (`ALGORITHM_UNIT_MAP`)
- [x] Live pricing preview on `/packages` via `GET /api/pricing`
- [ ] Stale package cleanup – delete packages older than 24 hours that never
      received an order (prevents unbounded DB growth); run as part of the
      same cron route as order expiry (`POST /api/cron/expire-orders`),
      protected by a valid `X-Admin-Key` header matching the `ADMIN_API_KEY`
      environment variable and returning `Cache-Control: no-store`
- [ ] Rate-limit `POST /api/packages` per IP to prevent pricing-scraping
      abuse – allow a maximum of 10 requests per minute per IP address;
      return `429 Too Many Requests` with a `Retry-After` header when the
      limit is exceeded

### 1.2 Checkout & Order Creation
- [x] `POST /api/orders` – create an order for a package
- [x] Checkout page `/checkout/[packageId]` – collect email, worker name,
      payment currency
- [x] `POST /api/payments/create` – create a NOWPayments invoice and attach it
      to the order
- [ ] Validate that the package has not already expired or been purchased before
      showing the checkout page (guard against stale package IDs in deep links)
- [ ] Coin selection at checkout – let the user pick which coin to mine from
      those mineable with the selected algorithm (e.g., Bitcoin vs. Bitcoin Cash
      for SHA-256). The chosen coin must determine the address format validation
      applied to the worker/payout address field, and the `worker` field sent to
      MRR must be set to a valid address for that coin so payouts are credited to
      the correct wallet.
- [ ] Research and catalogue solo mining pools for every supported
      algorithm × coin combination (e.g. SHA-256 / BTC, SHA-256 / BCH,
      Scrypt / LTC, etc.). For each combination, identify a reliable public
      solo pool (Stratum URL, port, any required password) and store it in a
      static server-side seed file (e.g. `src/config/pools.ts`). Once the
      pool list is finalised, register each pool with the MRR account via
      `POST /pool` (MRR API v2) so users can select from MRR's pre-defined
      pool list as well as the app's own curated list. The seed/registration
      script should be idempotent (skip pools already present by name).
- [ ] Solo mining pool selection at checkout – present a curated list of solo
      mining pools compatible with the selected algorithm (populated from a
      server-side config or `GET /api/pools?algorithm=<algo>`). The chosen pool's
      Stratum URL must be sent to MRR as the rental pool config, overriding any
      default pool. A sensible default pool should be pre-selected so this field
      remains optional for most users.
- [ ] Minimum hashrate floor enforcement per algorithm at the API level
      (currently only enforced by the UI slider) – define a new
      `ALGORITHM_MIN_HASHRATE` map in `src/app/api/packages/route.ts`
      alongside `ALGORITHM_UNIT_MAP`; reject `POST /api/packages` requests
      where the requested hashrate is below the floor for that algorithm
      with `400 Bad Request` and a message stating the minimum value and unit
- [ ] Show estimated mining start time at checkout – use a hardcoded
      per-currency average confirmation time map (e.g. BTC ≈ 60 min,
      ETH ≈ 5 min, LTC ≈ 2.5 min, USDT ≈ 5 min); display the value as
      "typically ready in ~X min" and note it is an estimate; store the map
      in `src/config/confirmationTimes.ts`

### 1.3 Payment Processing
- [x] `POST /api/payments/webhook` – NOWPayments IPN handler
- [x] Signature verification via `verifyWebhookSignature`
- [x] Auto-provision miners on `confirmed`/`finished` payment status
- [ ] Handle `partially_paid` webhook status – update the order status to
      `partially_paid` and send the user an email showing the shortfall
      amount and the original NOWPayments payment address so they can top
      up; do not provision miners; if full payment is never completed the
      order will be expired by the scheduled expiry job
- [ ] Idempotency guard – skip re-provisioning if the order is already `active`
      when the same `confirmed` webhook fires a second time (currently guarded
      by `order.status === 'awaiting_payment'` check, but worth an explicit
      DB-level unique constraint on `payment_id`)
- [ ] Payment expiry handling – if NOWPayments marks payment `expired`, update
      order to `payment_expired` and release the package slot

### 1.4 Miner Provisioning (MRR)
- [x] `provisionMiner` – auto-selects and rents one or more MRR rigs
- [x] Multi-rig support (`mrr_rental_ids` JSON array)
- [x] Cost-aware rig selection heuristic (`selectRigsForHashrate`)
- [ ] Retry logic for transient MRR API failures during provisioning – retry
      up to 3 times with exponential back-off (delays of 1 s, 2 s, 4 s);
      mark the order `provisioning_failed` only after all retries are
      exhausted
- [ ] Cancel already-rented rigs automatically when partial provisioning fails
      (currently only logs rental IDs for manual cancellation)
- [ ] `DELETE /api/rentals/:rentalId` – expose MRR rental cancellation via app
      API for admin/support use

---

## 2. Managing (Order & Rental Lifecycle)

### 2.1 Order Listing & Lookup
- [ ] `GET /api/orders` – admin-only list endpoint; callers must supply a
      valid `X-Admin-Key` header matching the `ADMIN_API_KEY` environment
      variable to receive orders; return `401` for all other requests
- [ ] `/orders` page – customer order lookup must not support email-only
      listing; use the existing unguessable `GET /api/orders/:id` endpoint
      (for example via an order-specific link or ID-based lookup) instead of
      returning all orders for an email address
- [ ] Order search by email or order ID (useful for customer support)

### 2.2 Order Status Management
- [x] Order statuses: `pending`, `awaiting_payment`, `active`,
      `provisioning_failed`, `expired`
- [ ] Scheduled job / cron route (`POST /api/cron/expire-orders`) that
      requires a valid `X-Admin-Key` header matching the `ADMIN_API_KEY`
      environment variable, marks `active` orders as `expired` once
      `expires_at` has passed, and cancels the associated MRR rental if it is
      still running
- [ ] `PATCH /api/orders/:id` – admin-only endpoint (requires valid
      `X-Admin-Key` header) to manually override order status (e.g.,
      force-retry provisioning, mark as refunded)
- [ ] Refund workflow – `POST /api/orders/:id/refund` admin-only endpoint
      (requires valid `X-Admin-Key` header) that triggers a NOWPayments
      refund via the NOWPayments refund API and updates order status to
      `refunded`

### 2.3 Rental Extension / Renewal
- [ ] `POST /api/orders/:id/renew` – create a follow-on order pre-filled with
      the same algorithm/hashrate/worker so users can extend mining time
      without re-entering all details
- [ ] Display "Renew" CTA on the order page when less than 2 hours remain

### 2.4 Admin Dashboard
- [ ] Protected `/admin` route – require a browser-compatible auth flow
      (preferred: login that sets an HttpOnly session cookie; alternatively
      route-level middleware/basic auth); do **not** gate normal browser
      navigation to `/admin` with a custom `X-Admin-Key` request header;
      keep header-based auth (`X-Admin-Key` / `ADMIN_API_KEY`) for admin
      API endpoints only; redirect unauthenticated users to a login page
      or return `401`; the dashboard shows:
  - All orders with status, package details, email, payment info
  - Filterable by status, date range, algorithm
  - Links to the MRR rental and NOWPayments invoice for each order
- [ ] Bulk-expire stale orders action in admin dashboard

---

## 3. Observing (Status & Monitoring)

### 3.1 Per-Order Status Page (existing, extend)
- [x] `/order/[id]` – order status page with payment and mining details
- [x] Auto-refresh every 15 s while `awaiting_payment` or `confirming`
- [ ] Show live MRR rental status on the order page (rig online/offline,
      actual hashrate if available) – fetches from `GET /api/rentals/:rentalId`;
      **implement §3.2 `GET /api/rentals/:rentalId` first**
- [ ] Countdown timer updating in real time (currently computed once on render)
- [ ] Show all rental IDs when multiple rigs were provisioned
      (`mrr_rental_ids`) with individual status for each – **depends on
      `GET /api/rentals/:rentalId` from §3.2**

### 3.2 MRR Live Rental Status API
- [ ] `GET /api/rentals/:rentalId` – proxy to MRR `GET /rental/:id` and return
      status, start/end times, and actual hashrate
- [ ] Cache MRR rental responses for 60 s to avoid hammering the MRR API when
      multiple users refresh the same order page

### 3.3 Notifications
- [ ] Email confirmation on order creation (order ID, package summary, payment
      address)
- [ ] Email notification when mining goes `active` (rental ID, expected expiry)
- [ ] Email notification when rental is about to expire (e.g., 1 h before
      `expires_at`) with renewal link
- [ ] Email notification on `provisioning_failed` with support contact

### 3.4 Market Data & Pricing Observability
- [x] `GET /api/mrr` – live MRR market data (rig count, avg/min/max BTC/hash,
      top 5 cheapest rigs)
- [x] `GET /api/pricing` – live price estimate for a given algorithm/hashrate/
      duration combo
- [ ] Expose pricing source in the UI (algo suggested price vs. rig-based
      fallback) so users understand what drives the quoted price
- [ ] Historical pricing chart on `/packages` (store one pricing snapshot per
      algorithm per hour in a `pricing_history` table)

---

## 4. Cross-Cutting Concerns

### 4.1 Security & Validation
- [x] Server-side price computation (prevents price-manipulation)
- [x] Server-side algorithm + unit validation
- [x] Webhook signature verification
- [ ] CSRF protection on all state-mutating API routes (POST/PATCH/DELETE) –
      set `SameSite=Strict` on any cookies used by the app and add a
      middleware check that rejects requests whose `Content-Type` is not
      `application/json`; revisit if server-side session cookies are
      introduced (adopt a CSRF-token middleware at that point)
- [ ] Input sanitization audit for `workerName` (currently regex-validated but
      not length-checked at the DB layer)
- [ ] Webhook endpoint should return `200 OK` for unknown `order_id` values to
      avoid NOWPayments retrying indefinitely (currently returns `404`)

### 4.2 Observability & Ops
- [ ] Structured logging (replace `console.error` with a logger that includes
      request IDs and order IDs for tracing)
- [ ] Health-check endpoint `GET /api/health` – returns MRR connectivity status,
      NOWPayments connectivity status, and DB health
- [ ] Error tracking integration (e.g., Sentry) for production alerts on
      provisioning failures or webhook errors

### 4.3 Testing
- [ ] Unit tests for `selectRigsForHashrate` (edge cases: no rigs, exact match,
      multi-rig aggregation, unit mismatch)
- [ ] Unit tests for `computePrice` (MRR suggested-price path, rig-fallback
      path, missing keys path)
- [ ] Integration tests for the webhook handler (confirmed, partial, expired,
      already-active idempotency)
- [ ] E2E smoke test for the full purchase flow (package → checkout → order →
      simulated webhook → active state)
