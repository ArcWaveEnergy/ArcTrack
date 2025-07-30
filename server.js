import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import { DateTime, Interval } from 'luxon';
import PDFDocument from 'pdfkit';
import nodemailer from 'nodemailer';
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
  let reg = 0, ot = 0; let cursor = start;
  while (cursor < end) {
    const dayEnd = cursor.endOf('day');
    const segmentEnd = end < dayEnd ? end : dayEnd;
    const regularStart = cursor.set({ hour: REG_START_HOUR, minute: 0, second: 0, millisecond: 0 });
    const regularEnd = cursor.set({ hour: REG_END_HOUR, minute: 0, second: 0, millisecond: 0 });
    const worked = Interval.fromDateTimes(cursor, segmentEnd);
    const regWindow = Interval.fromDateTimes(regularStart, regularEnd);
    const regOverlap = worked.intersection(regWindow);
    const regMinutes = regOverlap ? regOverlap.length('minutes') : 0;
    const workedMinutes = worked.length('minutes');
    reg += Math.round(regMinutes);
    ot += Math.round(workedMinutes - regMinutes);
    cursor = segmentEnd.plus({ milliseconds: 1 });
  }
  return { reg, ot };
}

// Minimal user profile (email only)
app.get('/api/me', (req, res) => {
  const row = db.prepare('SELECT email FROM users WHERE id = 1').get();
  res.json({ email: row?.email || '' });
});
app.post('/api/me', (req, res) => {
  const email = (req.body.email || '').toString().trim();
  db.prepare('INSERT INTO users (id, email) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET email=excluded.email').run(email);
  res.json({ ok: true, email });
});

// Jobs
app.get('/api/jobs', (_req, res) => {
  const rows = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all();
  res.json(rows);
});
app.post('/api/jobs', (req, res) => {
  const { name, client, location, jobNumber } = req.body;
  const info = db.prepare('INSERT INTO jobs (name, client, location, job_number, is_complete, created_at) VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)')
                 .run(name, client, location, jobNumber || null);
  res.json({ id: info.lastInsertRowid });
});

// Time tracking
app.post('/api/clock/start', (req, res) => {
  try {
    const { jobId, lat, lng, startISO } = req.body;
    const sISO = startISO || DateTime.now().setZone(TZ).toISO();
    const info = db.prepare('INSERT INTO time_entries (job_id, user_id, start_time, start_lat, start_lng) VALUES (?, 1, ?, ?, ?)')
                   .run(jobId, sISO, lat ?? null, lng ?? null);
    res.json({ id: info.lastInsertRowid, startISO: sISO });
  } catch (e) {
    console.error('clock/start error:', e);
    res.status(500).json({ error: 'clock start failed' });
  }
});

app.post('/api/clock/end', (req, res) => {
  try {
    const { entryId, lat, lng, endISO } = req.body;
    const row = db.prepare('SELECT start_time FROM time_entries WHERE id=?').get(entryId);
    if (!row) return res.status(404).json({ error: 'Entry not found' });
    const eISO = endISO || DateTime.now().setZone(TZ).toISO();
    const { reg, ot } = splitRegularOT(row.start_time, eISO);
    const sql = 'UPDATE time_entries SET end_time=?, end_lat=?, end_lng=?, reg_minutes=?, ot_minutes=? WHERE id=?';
    db.prepare(sql).run(eISO, lat ?? null, lng ?? null, reg, ot, entryId);
    res.json({ ok: true, regMinutes: reg, otMinutes: ot, endISO: eISO });
  } catch (e) {
    console.error('clock/end error:', e);
    res.status(500).json({ error: 'clock end failed' });
  }
});

app.get('/api/time/:jobId', (req, res) => {
  const jobId = Number(req.params.jobId);
  const rows = db.prepare('SELECT * FROM time_entries WHERE job_id=? ORDER BY start_time ASC').all(jobId);
  res.json(rows);
});

// Hotels
app.post('/api/hotel', (req, res) => {
  const { jobId, date, cost, nights } = req.body;
  const info = db.prepare('INSERT INTO hotels (job_id, date, cost, nights) VALUES (?, ?, ?, ?)')
                 .run(jobId, date, cost, nights);
  res.json({ id: info.lastInsertRowid });
});

// Reports
app.post('/api/reports/send', async (req, res) => {
  try {
    const { jobId } = req.body;
    const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const time = db.prepare('SELECT * FROM time_entries WHERE job_id=? ORDER BY start_time ASC').all(jobId);
    const hotels = db.prepare('SELECT * FROM hotels WHERE job_id=? ORDER BY date ASC').all(jobId);
    const userRow = db.prepare('SELECT email FROM users WHERE id=1').get();
    const userEmail = userRow?.email || process.env.DEFAULT_USER_CC || '';

    const regMinutes = time.reduce((a, t) => a + (t.reg_minutes || 0), 0);
    const otMinutes = time.reduce((a, t) => a + (t.ot_minutes || 0), 0);
    const hotelCost = hotels.reduce((a, h) => a + (h.cost || 0), 0);
    const hotelNights = hotels.reduce((a, h) => a + (h.nights || 0), 0);

    const reportsDir = path.join(__dirname, 'reports'); fs.mkdirSync(reportsDir, { recursive: true });
    const pdfName = `job-${jobId}-report-${Date.now()}.pdf`;
    const pdfPath = path.join(reportsDir, pdfName);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(fs.createWriteStream(pdfPath));
    doc.fontSize(20).text('ArcTrack Job Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Job: ${job.name} ${job.job_number ? '(#' + job.job_number + ')' : ''}`);
    doc.text(`Client: ${job.client || ''} | Location: ${job.location || ''}`);
    doc.text(`Created: ${new Date().toLocaleString('en-US', { timeZone: TZ })}`);
    doc.moveDown();
    doc.fontSize(14).text('Time Summary');
    doc.fontSize(12).text(`Regular Hours: ${(regMinutes/60).toFixed(2)}`);
    doc.text(`Overtime Hours: ${(otMinutes/60).toFixed(2)}`);
    doc.moveDown();
    doc.fontSize(14).text('Hotel Summary');
    doc.fontSize(12).text(`Nights: ${hotelNights}`);
    doc.text(`Costs: $${hotelCost.toFixed(2)}`);
    doc.moveDown();
    doc.fontSize(14).text('Time Entries');
    time.forEach(t => {
      doc.fontSize(10).text(`Start: ${t.start_time}  End: ${t.end_time || ''}  Reg: ${(t.reg_minutes||0)/60}h  OT: ${(t.ot_minutes||0)/60}h  Start GPS: ${t.start_lat||''},${t.start_lng||''}  End GPS: ${t.end_lat||''},${t.end_lng||''}`);
    });
    doc.end();

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || 'false') === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    const to = 'jobinformation@arcwaveenergy.com';
    const cc = userEmail || undefined;
    const message = {
      from: process.env.MAIL_FROM || 'ArcTrack <no-reply@example.com>',
      to, cc,
      subject: `ArcTrack Job Report - ${job.job_number ? ('#' + job.job_number + ' - ') : ''}${job.name}`,
      text: `Job report for ${job.name} is attached.`,
      attachments: [{ filename: pdfName, path: pdfPath }]
    };

    try { await transporter.sendMail(message); }
    catch (err) { console.error('Email error:', err.message); }

    res.json({ ok: true, pdfPath, email: { to, cc } });
  } catch (e) {
    console.error('report send error:', e);
    res.status(500).json({ error: 'report failed' });
  }
});

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// SPA fallback
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

app.listen(PORT, () => console.log(`ArcTrack server running on port ${PORT}`));
