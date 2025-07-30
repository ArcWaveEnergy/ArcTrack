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

// Utility: split into reg/ot minutes (8:00-17:00 regular)
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

// Self-check
console.log('>>> Checking public/index.html at', path.join(__dirname, 'public', 'index.html'));
console.log('exists?', fs.existsSync(path.join(__dirname, 'public', 'index.html')));

// User setup (email for CC)
app.get('/api/me', (req, res) => {
  const row = db.prepare('SELECT email FROM users WHERE id=1').get();
  res.json({ email: row?.email || '' });
});
app.post('/api/me', (req, res) => {
  const email = (req.body.email || '').toString().trim();
  db.prepare('INSERT INTO users (id, email) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET email=excluded.email').run(email);
  res.json({ ok: true, email });
});

// Jobs
app.get('/api/jobs', (req, res) => {
  const rows = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all();
  res.json(rows);
});
app.post('/api/jobs', (req, res) => {
  const { name, client, location, jobNumber } = req.body;
  const info = db.prepare('INSERT INTO jobs (name, client, location, job_number) VALUES (?, ?, ?, ?)')
    .run(name, client || null, location || null, jobNumber || null);
  res.json({ id: info.lastInsertRowid });
});

// Active status (current charging job / entry)
app.get('/api/active', (req, res) => {
  const row = db.prepare(`
    SELECT te.*, j.name as job_name, j.job_number
    FROM time_entries te
    JOIN jobs j ON j.id = te.job_id
    WHERE te.user_id=1 AND te.end_time IS NULL
    ORDER BY te.id DESC LIMIT 1
  `).get();
  res.json(row || null);
});

// Clock in
app.post('/api/clock/start', (req, res) => {
  try {
    const { jobId, lat, lng } = req.body;
    // End any existing active entry for safety
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
  } catch (e) {
    console.error('clock/start', e);
    res.status(500).json({ error: 'clock start failed' });
  }
});

// Clock out
app.post('/api/clock/end', (req, res) => {
  try {
    const { entryId, lat, lng } = req.body;
    const row = db.prepare('SELECT start_time FROM time_entries WHERE id=?').get(entryId);
    if (!row) return res.status(404).json({ error: 'Entry not found' });
    const endISO = DateTime.now().setZone(TZ).toISO();
    const { reg, ot } = splitRegularOT(row.start_time, endISO);
    db.prepare('UPDATE time_entries SET end_time=?, end_lat=?, end_lng=?, reg_minutes=?, ot_minutes=? WHERE id=?')
      .run(endISO, lat ?? null, lng ?? null, reg, ot, entryId);
    res.json({ ok: true, endISO, regMinutes: reg, otMinutes: ot });
  } catch (e) {
    console.error('clock/end', e);
    res.status(500).json({ error: 'clock end failed' });
  }
});

// Hotels
app.post('/api/hotel', (req, res) => {
  const { jobId, date, cost, nights } = req.body;
  const info = db.prepare('INSERT INTO hotels (job_id, date, cost, nights) VALUES (?, ?, ?, ?)')
    .run(jobId, date, cost || 0, nights || 0);
  res.json({ id: info.lastInsertRowid });
});

// Report
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

    // PDF
    const reportsDir = path.join(__dirname, 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });
    const pdfName = `job-${jobId}-report-${Date.now()}.pdf`;
    const pdfPath = path.join(reportsDir, pdfName);
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(fs.createWriteStream(pdfPath));
    doc.fontSize(20).text('ArcTrack Job Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Job: ${job.name} ${job.job_number ? '(#' + job.job_number + ')' : ''}`);
    doc.text(`Client: ${job.client || ''}`);
    doc.text(`Location: ${job.location || ''}`);
    doc.moveDown();
    doc.fontSize(14).text('Summary');
    doc.fontSize(12).text(`Regular Hours: ${(regMin/60).toFixed(2)}`);
    doc.text(`Overtime Hours: ${(otMin/60).toFixed(2)}`);
    doc.text(`Hotel Nights: ${hotelNights}`);
    doc.text(`Hotel Costs: $${hotelCost.toFixed(2)}`);
    doc.moveDown();
    doc.fontSize(14).text('Entries');
    time.forEach(t => {
      doc.fontSize(10).text(`Start: ${t.start_time}  End: ${t.end_time || '(running)'}  Reg: ${(t.reg_minutes||0)/60}h  OT: ${(t.ot_minutes||0)/60}h`);
    });
    doc.end();

    // Email (safe if SMTP not set)
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
        text: `ArcTrack job report attached.`,
        attachments: [{ filename: pdfName, path: pdfPath }]
      });
      email.sent = true;
    } catch (e) {
      console.warn('Email not sent:', e.message);
      email.error = e.message;
    }
    res.json({ ok: true, pdfPath, email });
  } catch (e) {
    console.error('report', e);
    res.status(500).json({ error: 'report failed' });
  }
});

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Fallback to app
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log('ArcTrack full server running on', PORT));
