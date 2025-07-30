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
const REG_START_HOUR = 8;
const REG_END_HOUR = 17;

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function splitRegularOT(startISO, endISO) {
  const start = DateTime.fromISO(startISO, { zone: TZ });
  const end = DateTime.fromISO(endISO, { zone: TZ });
  if (!start.isValid || !end.isValid || end <= start) return { reg: 0, ot: 0 };
  let reg = 0, ot = 0, cursor = start;
  while (cursor < end) {
    const dayEnd = cursor.endOf('day');
    const segEnd = end < dayEnd ? end : dayEnd;
    const rStart = cursor.set({ hour: REG_START_HOUR, minute: 0, second: 0, millisecond: 0 });
    const rEnd = cursor.set({ hour: REG_END_HOUR, minute: 0, second: 0, millisecond: 0 });
    const sub = Interval.fromDateTimes(cursor, segEnd);
    const regOverlap = sub.intersection(Interval.fromDateTimes(rStart, rEnd));
    const regMin = regOverlap ? regOverlap.length('minutes') : 0;
    const durMin = sub.length('minutes');
    reg += Math.round(regMin);
    ot += Math.round(durMin - regMin);
    cursor = segEnd.plus({ milliseconds: 1 });
  }
  return { reg, ot };
}

// User email for CC
app.get('/api/me', (_req, res) => {
  const row = db.prepare('SELECT email FROM users WHERE id=1').get();
  res.json({ email: row?.email || '' });
});
app.post('/api/me', (req, res) => {
  const email = (req.body.email || '').toString().trim();
  db.prepare('INSERT INTO users (id, email) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET email=excluded.email').run(email);
  res.json({ ok: true, email });
});

// Jobs basic
app.get('/api/jobs', (_req, res) => {
  const rows = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all();
  res.json(rows);
});

// Create job with extended info
app.post('/api/jobs', (req, res) => {
  const {
    name, jobNumber, client, location, clientContact, address, city, state, zip,
    site_lat, site_lng, generator_model, generator_kw, fuel_type, on_site_fuel, start_kwh, notes
  } = req.body;
  const info = db.prepare(`
    INSERT INTO jobs (name, job_number, client, location, client_contact, address, city, state, zip, site_lat, site_lng, generator_model, generator_kw, fuel_type, on_site_fuel, start_kwh, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, jobNumber || null, client || null, location || null, clientContact || null, address || null, city || null, state || null, zip || null,
         site_lat || null, site_lng || null, generator_model || null, generator_kw || null, fuel_type || null, on_site_fuel || null, start_kwh || null, notes || null);
  res.json({ id: info.lastInsertRowid });
});

// Active entry
app.get('/api/active', (_req, res) => {
  const row = db.prepare(`
    SELECT te.*, j.name as job_name, j.job_number
    FROM time_entries te JOIN jobs j ON j.id=te.job_id
    WHERE te.user_id=1 AND te.end_time IS NULL
    ORDER BY te.id DESC LIMIT 1
  `).get();
  res.json(row || null);
});

// Clock in/out
app.post('/api/clock/start', (req, res) => {
  const { jobId, lat, lng } = req.body;
  const active = db.prepare('SELECT id, start_time FROM time_entries WHERE user_id=1 AND end_time IS NULL ORDER BY id DESC LIMIT 1').get();
  if (active) {
    const endISO = DateTime.now().setZone(TZ).toISO();
    const { reg, ot } = splitRegularOT(active.start_time, endISO);
    db.prepare('UPDATE time_entries SET end_time=?, reg_minutes=?, ot_minutes=? WHERE id=?').run(endISO, reg, ot, active.id);
  }
  const startISO = DateTime.now().setZone(TZ).toISO();
  const info = db.prepare('INSERT INTO time_entries (job_id, user_id, start_time, start_lat, start_lng) VALUES (?, 1, ?, ?, ?)')
    .run(jobId, startISO, lat ?? null, lng ?? null);
  res.json({ id: info.lastInsertRowid, startISO });
});
app.post('/api/clock/end', (req, res) => {
  const { entryId, lat, lng } = req.body;
  const row = db.prepare('SELECT start_time FROM time_entries WHERE id=?').get(entryId);
  if (!row) return res.status(404).json({ error: 'Entry not found' });
  const endISO = DateTime.now().setZone(TZ).toISO();
  const { reg, ot } = splitRegularOT(row.start_time, endISO);
  db.prepare('UPDATE time_entries SET end_time=?, end_lat=?, end_lng=?, reg_minutes=?, ot_minutes=? WHERE id=?')
    .run(endISO, lat ?? null, lng ?? null, reg, ot, entryId);
  res.json({ ok: true, endISO, regMinutes: reg, otMinutes: ot });
});

// Hotel
app.post('/api/hotel', (req, res) => {
  const { jobId, date, cost, nights } = req.body;
  const info = db.prepare('INSERT INTO hotels (job_id, date, cost, nights) VALUES (?, ?, ?, ?)')
    .run(jobId, date, cost || 0, nights || 0);
  res.json({ id: info.lastInsertRowid });
});

// Report with logo + job info
app.post('/api/reports/send', async (req, res) => {
  try {
    const { jobId } = req.body;
    const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    const time = db.prepare('SELECT * FROM time_entries WHERE job_id=? ORDER BY start_time ASC').all(jobId);
    const hotels = db.prepare('SELECT * FROM hotels WHERE job_id=? ORDER BY date ASC').all(jobId);
    const userRow = db.prepare('SELECT email FROM users WHERE id=1').get();
    const userEmail = userRow?.email || process.env.DEFAULT_USER_CC || '';

    const regMin = time.reduce((a, t) => a + (t.reg_minutes || 0), 0);
    const otMin = time.reduce((a, t) => a + (t.ot_minutes || 0), 0);
    const hotelCost = hotels.reduce((a, h) => a + (h.cost || 0), 0);
    const hotelNights = hotels.reduce((a, h) => a + (h.nights || 0), 0);

    const reportsDir = path.join(__dirname, 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });
    const pdfName = `job-${jobId}-report-${Date.now()}.pdf`;
    const pdfPath = path.join(reportsDir, pdfName);
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(fs.createWriteStream(pdfPath));

    // Header with Logo
    const logoPath = path.join(__dirname, 'public', 'logo.png');
    try { if (fs.existsSync(logoPath)) doc.image(logoPath, 50, 40, { width: 80 }); } catch {}
    doc.fontSize(22).text('ArcTrack Job Report', 150, 50);
    doc.moveDown(2);

    // Job info block
    doc.fontSize(14).text('Job Information', { underline: true });
    doc.fontSize(11);
    const lines = [
      `Job: ${job.name} ${job.job_number ? '(#' + job.job_number + ')' : ''}`,
      `Client: ${job.client || ''}`,
      `Contact: ${job.client_contact || ''}`,
      `Location: ${job.location || ''}`,
      `Address: ${[job.address, job.city, job.state, job.zip].filter(Boolean).join(', ')}`,
      `Site GPS: ${job.site_lat || ''}, ${job.site_lng || ''}`,
      `Generator: ${[job.generator_model, job.generator_kw ? job.generator_kw + ' kW' : ''].filter(Boolean).join(' | ')}`,
      `Fuel: ${[job.fuel_type, job.on_site_fuel].filter(Boolean).join(' | ')}`,
      `Start kWh: ${job.start_kwh ?? ''}`,
      `Notes: ${job.notes || ''}`
    ];
    lines.forEach(l => doc.text(l));
    doc.moveDown();

    // Summaries
    doc.fontSize(14).text('Summary', { underline: true });
    doc.fontSize(11).text(`Regular Hours: ${(regMin/60).toFixed(2)}`);
    doc.text(`Overtime Hours: ${(otMin/60).toFixed(2)}`);
    doc.text(`Hotel Nights: ${hotelNights}`);
    doc.text(`Hotel Costs: $${hotelCost.toFixed(2)}`);
    doc.moveDown();

    // Time entries
    doc.fontSize(14).text('Time Entries', { underline: true });
    doc.fontSize(10);
    time.forEach(t => {
      doc.text(`Start: ${t.start_time}  End: ${t.end_time || '(running)'}  Reg: ${(t.reg_minutes||0)/60}h  OT: ${(t.ot_minutes||0)/60}h  StartGPS: ${t.start_lat||''},${t.start_lng||''}  EndGPS: ${t.end_lat||''},${t.end_lng||''}`);
    });
    doc.end();

    // Email (optional)
    let email = { sent: false };
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_SECURE || 'false') === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
      });
      await transporter.sendMail({
        from: process.env.MAIL_FROM || 'ArcTrack <no-reply@example.com>',
        to: 'jobinformation@arcwaveenergy.com',
        cc: userEmail || undefined,
        subject: `ArcTrack Job Report - ${job.job_number ? ('#' + job.job_number + ' - ') : ''}${job.name}`,
        text: 'ArcTrack job report attached.',
        attachments: [{ filename: pdfName, path: pdfPath }]
      });
      email.sent = true;
    } catch (e) {
      email.error = e.message;
      console.warn('Email not sent:', e.message);
    }

    res.json({ ok: true, pdfPath, email });
  } catch (e) {
    console.error('report error', e);
    res.status(500).json({ error: 'report failed' });
  }
});

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// SPA fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log('ArcTrack Patch3 server on', PORT));
