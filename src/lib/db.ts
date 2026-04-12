import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'miner4.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema(db);
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS packages (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      algorithm  TEXT NOT NULL,
      hashrate   REAL NOT NULL,
      unit       TEXT NOT NULL,
      price_usd  REAL NOT NULL,
      duration_hours INTEGER NOT NULL,
      description TEXT NOT NULL,
      popular    INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id              TEXT PRIMARY KEY,
      package_id      TEXT NOT NULL,
      email           TEXT NOT NULL,
      worker_name     TEXT NOT NULL,
      payment_currency TEXT NOT NULL,
      payment_address TEXT,
      payment_amount  REAL,
      payment_id      TEXT,
      payment_status  TEXT DEFAULT 'waiting',
      status          TEXT DEFAULT 'pending',
      mrr_rental_id   TEXT,
      expires_at      TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (package_id) REFERENCES packages(id)
    );
  `);

  // Seed default packages if table is empty
  const count = (db.prepare('SELECT COUNT(*) as c FROM packages').get() as { c: number }).c;
  if (count === 0) {
    const insert = db.prepare(`
      INSERT INTO packages (id, name, algorithm, hashrate, unit, price_usd, duration_hours, description, popular)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const seed = db.transaction(() => {
      insert.run('sha256-starter',  'SHA-256 Starter',  'SHA-256',  50,    'TH/s', 12.99,  24, 'Perfect for beginners. Mine Bitcoin with 50 TH/s for 24 hours.',           0);
      insert.run('sha256-pro',      'SHA-256 Pro',      'SHA-256',  200,   'TH/s', 44.99,  24, 'High performance Bitcoin mining. 200 TH/s power for serious miners.',      1);
      insert.run('sha256-elite',    'SHA-256 Elite',    'SHA-256',  500,   'TH/s', 99.99,  24, 'Elite-tier Bitcoin hashrate. 500 TH/s – maximize your daily rewards.',     0);
      insert.run('ethash-starter',  'Ethash Starter',   'Ethash',   500,   'MH/s', 9.99,   24, 'Start Ethereum-compatible mining with 500 MH/s for a full day.',           0);
      insert.run('ethash-pro',      'Ethash Pro',       'Ethash',   2000,  'MH/s', 34.99,  24, 'Serious Ethash mining power – 2 GH/s for 24 hours.',                       1);
      insert.run('scrypt-starter',  'Scrypt Starter',   'Scrypt',   200,   'MH/s', 7.99,   24, 'Mine Litecoin and other Scrypt coins with 200 MH/s.',                      0);
      insert.run('scrypt-pro',      'Scrypt Pro',       'Scrypt',   1000,  'MH/s', 29.99,  24, 'Top-tier Scrypt rental – 1 GH/s for 24 hours of LTC mining.',             0);
      insert.run('x11-starter',     'X11 Starter',      'X11',      5,     'GH/s', 8.99,   24, 'Mine Dash and X11 coins with 5 GH/s for 24 hours.',                       0);
      insert.run('randomx-starter', 'RandomX Starter',  'RandomX',  50,    'KH/s', 6.99,   24, 'Mine Monero with 50 KH/s CPU hashrate for 24 hours.',                     0);
      insert.run('randomx-pro',     'RandomX Pro',      'RandomX',  250,   'KH/s', 24.99,  48, 'Extended 48-hour Monero mining campaign with 250 KH/s.',                  1);
    });
    seed();
  }
}
