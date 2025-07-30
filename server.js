import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import PDFDocument from 'pdfkit';
import nodemailer from 'nodemailer';
import { DateTime, Interval } from 'luxon';
import db from './db.js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const TZ = 'America/Chicago';

// Regular time hours (8 am - 5 pm)
const REG_START_HOUR = 8;
const REG_END_HOUR = 17;

// Helpers for time split
function splitRegularOT(startISO, endISO) {
  const start = DateTime.fromISO(startISO, { zone: TZ });
  const end = DateTime.fromISO(endISO, { zone: TZ });
  if (!start.isValid || !end.isValid || end <= start) return { reg: 0, ot: 0 };

  let reg = 0, ot = 0, cursor = start;
  while (cursor < end) {
    const dayEnd = cursor.endOf('day');
    const segEnd = end < dayEnd ? end : dayEnd;

    const rStart = cursor.set({ hour: REG_START_HOUR, minute: 0 });
    const rEnd = cursor.set({ hour: REG_END_HOUR, minute: 0 });

    const totalInterval = Interval.fromDateTimes(cursor, segEnd);
    const regOverlap = totalInterval.intersection(Interval.fromDateTimes(rStart, rEnd));
    const regMinutes = regOverlap ? regOverlap.length('minutes') : 0;
    const totalMinutes = totalInterval.length('minutes');

    reg += regMinutes;
    ot += totalMinutes - regMinutes;

    cursor = segEnd.plus({ seconds: 1 });
  }
  return { reg, ot };
}

// Helpers
function money(val) {
  return `$${Number(val || 0).toFixed(2)}`;
}

// Static + middleware
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

//
// ROUTES
//

// ---- Users ----
app.get('/api/me', (_req, res) => {
  const row = db.prepare('SELECT email FROM users WHERE id=1').get();
  res.json({ email: row?.email || '' });
});

app.post('/api/me', (req, res) => {
  const email = (req.body.email || '').trim();
  db.prepare(`
    INSERT INTO users (id, email)
    VALUES (1, ?)
    ON CONFLICT(id) DO UPDATE SET email = excluded.email
  `).run(email);
  res.json({ ok: true, email });
});

// ---- Jobs ----
app.get('/api/jobs', (_req, res) => {
  const jobs = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all();
  res.json(jobs);
});

app.post('/api/jobs', (req, res) => {
  const p = req.body;
  const result = db.prepare(`
    INSERT INTO jobs (
      name, job_number, client, location, client_contact,
      address, city, state, zip,
      site_lat, site_lng, generator_model, generator_kw,
      fuel_type, on_site_fuel, start_kwh, notes, is_complete
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    p.name, p.jobNumber || null, p.client || null, p.location || null, p.clientContact || null,
    p.address || null, p.city || null, p.state || null, p.zip || null,
    p.site_lat || null, p.site_lng || null, p.generator_model || null, p.generator_kw || null,
    p.fuel_type || null, p.on_site_fuel || null, p.start_kwh || null, p.notes || null
  );

  // Clear sample job permanently after first real job
  const cleared = db.prepare("SELECT value FROM settings WHERE key='sample_cleared'").get()?.value === '1';
  if (!cleared) {
    const sample = db.prepare("SELECT id FROM jobs WHERE job_number LIKE 'SAMPLE-%'").get();
    if (sample) {
      db.prepare('DELETE FROM time_entries WHERE job_id=?').run(sample.id);
      db.prepare('DELETE FROM hotels WHERE job_id=?').run(sample.id);
      db.prepare('DELETE FROM parts WHERE job_id=?').run(sample.id);
      db.prepare('DELETE FROM jobs WHERE id=?').run(sample.id);
    }
    db.prepare("INSERT INTO settings (key,value) VALUES ('sample_cleared','1') ON CONFLICT(key) DO UPDATE SET value='1'").run();
  }

  res.json({ id: result.lastInsertRowid });
});

app.post('/api/job/close', (req, res) => {
  db.prepare('UPDATE jobs SET is_complete = 1 WHERE id = ?').run(req.body.jobId);
  res.json({ ok: true });
});

// ---- Hotels ----
app.get('/api/hotel/:jobId', (req, res) => {
  const hotels = db.prepare('SELECT * FROM hotels WHERE job_id=? ORDER BY date ASC').all(Number(req.params.jobId));
  res.json(hotels);
});

app.post('/api/hotel', (req, res) => {
  const { jobId, date, cost, nights } = req.body;
  const result = db.prepare('INSERT INTO hotels (job_id, date, cost, nights) VALUES (?, ?, ?, ?)').run(jobId, date, cost, nights);
  res.json({ id: result.lastInsertRowid });
});

app.delete('/api/hotel/:id', (req, res) => {
  db.prepare('DELETE FROM hotels WHERE id=?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ---- Parts ----
app.get('/api/parts/:jobId', (req, res) => {
  const parts = db.prepare('SELECT * FROM parts WHERE job_id=? ORDER BY id ASC').all(Number(req.params.jobId));
  res.json(parts);
});

app.post('/api/parts', (req, res) => {
  const { jobId, part_number, qty, price, vendor } = req.body;
  const result = db.prepare(`
    INSERT INTO parts (job_id, part_number, qty, price, vendor)
    VALUES (?, ?, ?, ?, ?)
  `).run(jobId, part_number, qty, price, vendor);
  res.json({ id: result.lastInsertRowid });
});

app.delete('/api/parts/:id', (req, res) => {
  db.prepare('DELETE FROM parts WHERE id=?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ---- Time Tracking ----
app.get('/api/active', (_req, res) => {
  const row = db.prepare(`
    SELECT te.*, j.name AS job_name, j.job_number
    FROM time_entries te
    JOIN jobs j ON j.id = te.job_id
    WHERE te.user_id = 1 AND te.end_time IS NULL
    ORDER BY te.id DESC LIMIT 1
  `).get();
  res.json(row || null);
});

app.post('/api/clock/start', (req, res) => {
  const { jobId } = req.body;

  // Stop any active entry
  const active = db.prepare('SELECT * FROM time_entries WHERE user_id=1 AND end_time IS NULL').get();
  if (active) {
    const endISO = DateTime.now().setZone(TZ).toISO();
    const { reg, ot } = splitRegularOT(active.start_time, endISO);
    db.prepare('UPDATE time_entries SET end_time=?, reg_minutes=?, ot_minutes=? WHERE id=?').run(endISO, reg, ot, active.id);
  }

  const startISO = DateTime.now().setZone(TZ).toISO();
  const result = db.prepare('INSERT INTO time_entries (job_id, user_id, start_time) VALUES (?, 1, ?)').run(jobId, startISO);
  res.json({ id: result.lastInsertRowid, startISO });
});

app.post('/api/clock/end', (req, res) => {
  const entry = db.prepare('SELECT * FROM time_entries WHERE id=?').get(req.body.entryId);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  const endISO = DateTime.now().setZone(TZ).toISO();
  const { reg, ot } = splitRegularOT(entry.start_time, endISO);
  db.prepare('UPDATE time_entries SET end_time=?, reg_minutes=?, ot_minutes=? WHERE id=?').run(endISO, reg, ot, entry.id);
  res.json({ ok: true });
});

// ---- Totals ----
app.get('/api/totals/:jobId', (req, res) => {
  const jobId = Number(req.params.jobId);
  const t = db.prepare('SELECT SUM(reg_minutes) reg, SUM(ot_minutes) ot FROM time_entries WHERE job_id=?').get(jobId);
  const parts = db.prepare('SELECT SUM(qty*price) parts FROM parts WHERE job_id=?').get(jobId)?.parts || 0;
  const hotels = db.prepare('SELECT SUM(cost) hotels FROM hotels WHERE job_id=?').get(jobId)?.hotels || 0;

  res.json({
    hours: ((t?.reg || 0) + (t?.ot || 0)) / 60,
    reg: (t?.reg || 0) / 60,
    ot: (t?.ot || 0) / 60,
    parts,
    hotels
  });
});

// ---- Reports & Work Orders ----
function generatePDF(job, type = 'report') {
  const reportsDir = path.join(__dirname, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const pdfPath = path.join(reportsDir, `${type}-job-${job.id}.pdf`);

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(fs.createWriteStream(pdfPath));

  // Header
  doc.fontSize(20).text('ArcTrack', { align: 'left' });
  doc.fontSize(10).text('ArcWave Energy', { align: 'left' });
  doc.moveDown(2);

  // Job info
  doc.fontSize(14).text(type === 'workorder' ? 'Work Order' : 'Job Report', { underline: true });
  doc.moveDown();
  doc.text(`Job: ${job.name} (#${job.job_number || ''})`);
  doc.text(`Client: ${job.client || ''}`);
  doc.text(`Location: ${job.location || ''}`);
  doc.moveDown();

  // Footer
  doc.moveDown(4);
  doc.fontSize(9).text('ArcWave Energy • 605 E. Willow Ave. Duncan, Ok. 73533 • Phone: 5807364494');

  if (type === 'workorder') {
    doc.moveDown(2);
    doc.text('Customer Signature: ___________________________');
    doc.moveDown();
    doc.text('Date: ___________________________');
  }

  doc.end();
  return pdfPath;
}

app.post('/api/reports/send', async (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.body.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const pdfPath = generatePDF(job, 'report');
  res.json({ ok: true, pdfPath });
});

app.post('/api/workorder/generate', (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.body.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const pdfPath = generatePDF(job, 'workorder');
  res.json({ ok: true, pdfPath });
});

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Fallback to frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`ArcTrack server running on port ${PORT}`));
