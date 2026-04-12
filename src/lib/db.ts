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

  // Add mrr_rental_ids column for multi-rig orders (JSON-encoded array of rental IDs).
  // Use try/catch instead of a PRAGMA pre-check to stay idempotent under concurrency.
  try {
    db.exec('ALTER TABLE orders ADD COLUMN mrr_rental_ids TEXT');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('duplicate column name: mrr_rental_ids')) {
      throw error;
    }
  }
}
