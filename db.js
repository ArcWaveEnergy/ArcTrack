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
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  job_number TEXT,
  client TEXT,
  location TEXT,
  client_contact TEXT,
  address TEXT, city TEXT, state TEXT, zip TEXT,
  site_lat REAL, site_lng REAL,
  generator_model TEXT, generator_kw REAL,
  fuel_type TEXT, on_site_fuel TEXT,
  start_kwh REAL,
  notes TEXT,
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

CREATE TABLE IF NOT EXISTS hotels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  cost REAL DEFAULT 0,
  nights INTEGER DEFAULT 0,
  receipt_path TEXT
);

CREATE TABLE IF NOT EXISTS parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  part_number TEXT,
  qty REAL DEFAULT 1,
  price REAL DEFAULT 0,
  vendor TEXT
);
`);

// Seed a sample job if not already seeded
const seeded = db.prepare("SELECT value FROM settings WHERE key='sample_seeded'").get()?.value === '1';
if (!seeded) {
  const job = db.prepare(`
    INSERT INTO jobs (
      name, job_number, client, location, client_contact,
      address, city, state, zip,
      site_lat, site_lng,
      generator_model, generator_kw, fuel_type, on_site_fuel,
      start_kwh, notes, is_complete
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    'Sample Job - Mobile Generator', 'SAMPLE-1001',
    'ArcWave Energy', '605 E. Willow Ave., Duncan, OK', 'John Doe (555) 555-5555',
    '605 E. Willow Ave.', 'Duncan', 'OK', '73533',
    34.5026, -97.9573,
    'CAT XQ200', 200, 'Diesel', 'Full at start', 0,
    'Demo data — will be cleared on first real job creation.'
  );

  const jobId = job.lastInsertRowid;
  db.prepare('INSERT INTO hotels (job_id, date, cost, nights) VALUES (?, ?, ?, ?)').run(jobId, '2025-07-29', 129.99, 1);
  db.prepare('INSERT INTO hotels (job_id, date, cost, nights) VALUES (?, ?, ?, ?)').run(jobId, '2025-07-30', 129.99, 1);
  db.prepare('INSERT INTO parts (job_id, part_number, qty, price, vendor) VALUES (?, ?, ?, ?, ?)').run(jobId, 'FILTER-XL', 2, 39.95, 'PartsCo');
  db.prepare('INSERT INTO parts (job_id, part_number, qty, price, vendor) VALUES (?, ?, ?, ?, ?)').run(jobId, 'OIL-15W40', 5, 22.50, 'LubePlus');

  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run('sample_seeded', '1');
}

export default db;
