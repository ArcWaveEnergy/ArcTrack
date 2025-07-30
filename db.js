import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'arctrack.sqlite'));

db.exec(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT);
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  job_number TEXT,
  client TEXT,
  location TEXT,
  is_complete INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  start_lat REAL, start_lng REAL,
  end_lat REAL, end_lng REAL,
  reg_minutes INTEGER DEFAULT 0,
  ot_minutes INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_time_active ON time_entries (user_id, end_time);
CREATE TABLE IF NOT EXISTS hotels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  cost REAL DEFAULT 0,
  nights INTEGER DEFAULT 0,
  receipt_path TEXT
);
`);

// Seed: sample user & job if none
const count = db.prepare('SELECT COUNT(*) as c FROM jobs').get().c;
if (count === 0) {
  db.prepare('INSERT INTO jobs (name, job_number, client, location) VALUES (?, ?, ?, ?)')
    .run('Sample Job - Generator Install', '1001', 'ArcWave Energy', 'Houston, TX');
}

export default db;
