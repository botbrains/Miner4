import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// In Vercel/Lambda the CWD (/var/task) is read-only; use /tmp instead.
// A DB_PATH env var can override the location entirely (e.g. for a persistent volume).
const DB_DIR = process.env.DB_PATH
  ? path.dirname(process.env.DB_PATH)
  : process.env.VERCEL
    ? '/tmp'
    : path.join(process.cwd(), 'data');
const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, 'miner4.db');

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

    CREATE TABLE IF NOT EXISTS pricing_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      algorithm   TEXT NOT NULL,
      price_usd   REAL NOT NULL,
      source      TEXT NOT NULL,
      btc_rate    REAL NOT NULL,
      recorded_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Unique index: at most one pricing snapshot per algorithm per calendar hour
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS pricing_history_algo_hour
      ON pricing_history(algorithm, strftime('%Y-%m-%dT%H', recorded_at));
  `);

  // Unique index on payment_id for idempotency guard
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_id_unique
      ON orders(payment_id) WHERE payment_id IS NOT NULL;
  `);

  // Idempotent column migrations --------------------------------------------------

  // mrr_rental_ids: JSON-encoded array of rental IDs for multi-rig orders
  addColumnIfMissing(db, 'orders', 'mrr_rental_ids', 'TEXT');

  // coin: the mineable coin chosen at checkout (e.g. 'BTC', 'LTC')
  addColumnIfMissing(db, 'orders', 'coin', 'TEXT');

  // pool_id / pool_url: solo mining pool chosen at checkout
  addColumnIfMissing(db, 'orders', 'pool_id', 'TEXT');
  addColumnIfMissing(db, 'orders', 'pool_url', 'TEXT');
  // pool_host / pool_port / pool_pass: normalized stratum settings used during provisioning
  addColumnIfMissing(db, 'orders', 'pool_host', 'TEXT');
  addColumnIfMissing(db, 'orders', 'pool_port', 'INTEGER');
  addColumnIfMissing(db, 'orders', 'pool_pass', 'TEXT');

  // reminder_sent: 1 once the 1-hour-before-expiry reminder email has been sent
  addColumnIfMissing(db, 'orders', 'reminder_sent', 'INTEGER DEFAULT 0');
}

/** Add a column to a table if it does not already exist (idempotent). */
function addColumnIfMissing(
  db: Database.Database,
  table: string,
  column: string,
  definition: string,
) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(`duplicate column name: ${column}`)) {
      throw error;
    }
  }
}
