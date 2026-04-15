/**
 * Curated list of public solo mining pools for every supported algorithm × coin
 * combination.
 *
 * Fields:
 *   algorithm – internal algorithm name (must match ALGORITHM_UNIT_MAP keys)
 *   coin      – coin ticker this pool mines
 *   name      – human-readable pool name (must be unique per algorithm for
 *               idempotent MRR pool registration)
 *   host      – Stratum hostname
 *   port      – Stratum port
 *   password  – Stratum password (commonly 'x' or 'd=1')
 */

export interface PoolConfig {
  algorithm: string;
  coin: string;
  name: string;
  host: string;
  port: number;
  password: string;
}

export const POOLS: PoolConfig[] = [
  // SHA-256 / Bitcoin
  {
    algorithm: 'SHA-256',
    coin: 'BTC',
    name: 'solo.ckpool.org – BTC',
    host: 'solo.ckpool.org',
    port: 3333,
    password: 'x',
  },
  {
    algorithm: 'SHA-256',
    coin: 'BTC',
    name: 'btc.solo.luxor.tech – BTC',
    host: 'btc.solo.luxor.tech',
    port: 700,
    password: 'x',
  },
  // SHA-256 / Bitcoin Cash
  {
    algorithm: 'SHA-256',
    coin: 'BCH',
    name: 'bch.solo.luxor.tech – BCH',
    host: 'bch.solo.luxor.tech',
    port: 700,
    password: 'x',
  },
  // Scrypt / Litecoin
  {
    algorithm: 'Scrypt',
    coin: 'LTC',
    name: 'ltc.solo.luxor.tech – LTC',
    host: 'ltc.solo.luxor.tech',
    port: 700,
    password: 'x',
  },
  {
    algorithm: 'Scrypt',
    coin: 'LTC',
    name: 'ltc.solopool.org – LTC',
    host: 'ltc.solopool.org',
    port: 5600,
    password: 'x',
  },
  // X11 / Dash
  {
    algorithm: 'X11',
    coin: 'DASH',
    name: 'dash.solopool.org – DASH',
    host: 'dash.solopool.org',
    port: 4500,
    password: 'x',
  },
  // RandomX / Monero
  {
    algorithm: 'RandomX',
    coin: 'XMR',
    name: 'xmr.solo.moneroocean.stream – XMR',
    host: 'xmr.solo.moneroocean.stream',
    port: 10001,
    password: 'x',
  },
  // Ethash / Ethereum Classic
  {
    algorithm: 'Ethash',
    coin: 'ETC',
    name: 'etc.solopool.org – ETC',
    host: 'etc.solopool.org',
    port: 3333,
    password: 'x',
  },
];
