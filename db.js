import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'arctrack.sqlite'));

// Base schema
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

// ---- MIGRATIONS: add extended job info columns if missing ----
const cols = db.prepare('PRAGMA table_info(jobs)').all().map(r=>r.name);
function ensureCol(name, sqlType) {
  if (!cols.includes(name)) {
    db.exec(`ALTER TABLE jobs ADD COLUMN ${name} ${sqlType}`);
  }
}
ensureCol('client_contact', 'TEXT');
ensureCol('address', 'TEXT');
ensureCol('city', 'TEXT');
ensureCol('state', 'TEXT');
ensureCol('zip', 'TEXT');
ensureCol('site_lat', 'REAL');
ensureCol('site_lng', 'REAL');
ensureCol('generator_model', 'TEXT');
ensureCol('generator_kw', 'REAL');
ensureCol('fuel_type', 'TEXT');
ensureCol('on_site_fuel', 'TEXT');
ensureCol('start_kwh', 'REAL');
ensureCol('notes', 'TEXT');

// Seed sample job if none
const count = db.prepare('SELECT COUNT(*) AS c FROM jobs').get().c;
if (count === 0) {
  db.prepare(`INSERT INTO jobs (name, job_number, client, location, client_contact, address, city, state, zip, generator_model, generator_kw, fuel_type, on_site_fuel, start_kwh, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run('Sample Job - Generator Install', '1001', 'ArcWave Energy', 'Houston, TX',
      'John Doe, (555) 555-5555', '123 Power Ln', 'Houston', 'TX', '77001',
      'Cat XQ200', 200, 'Diesel', 'Full at start', 0, 'Initial sample job.');
}

export default db;
