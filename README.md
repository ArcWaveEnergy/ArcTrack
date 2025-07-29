# ArcTrack (GitHub-ready)

A lightweight, full‑stack app for ArcWave Energy to track time, GPS, hotel costs/nights, differentiate regular vs overtime (8:00–17:00 America/Chicago), and generate job reports that email to **jobinformation@arcwaveenergy.com** with the user CC'd.

## Quick Start

```bash
# 1) Unzip, then:
npm install

# 2) Initialize the local SQLite database
npm run db:init

# 3) Copy env file and fill SMTP settings
cp .env.example .env

# 4) Run
npm run dev
# open http://localhost:8080
```

## Regular vs Overtime Rules

- Regular time window: **08:00–17:00 America/Chicago**.  
- Time outside that window is counted as **overtime**.  
- The server calculates the split when you end a clock entry and supports entries that span midnight.

## Features

- Time tracking with **Start/End** buttons and optional GPS capture (browser permission required).
- Jobs management (create, list, mark complete via API).
- Hotel costs & nights logging (+ optional receipt uploads endpoint).
- Report generation (PDF) and email via **Nodemailer** (SMTP).
- Simple dashboard (vanilla JS/CSS) + **PWA manifest** for install.
- GitHub Actions workflow included.

## Email

Reports send to `jobinformation@arcwaveenergy.com` and CC to the email saved in the header field (stored in the local DB). Configure `.env` with your SMTP:

```
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_SECURE=false
MAIL_FROM="ArcTrack Reports <no-reply@arcwaveenergy.com>"
```

## API Overview

- `GET /api/jobs` – list jobs
- `POST /api/jobs {name, client, location}` – create job
- `PATCH /api/jobs/:id/complete` – mark complete
- `POST /api/clock/start {jobId, lat?, lng?, startISO?}` – start a time entry
- `POST /api/clock/end {entryId, lat?, lng?, endISO?}` – end entry, calculates reg/OT
- `GET /api/time/:jobId` – job time entries
- `POST /api/hotel {jobId, date, cost, nights}` – add hotel record
- `POST /api/hotel/receipt (multipart: receipt)` – upload hotel receipt (optional)
- `POST /api/reports/send {jobId}` – generate PDF and email

## Deploy

- **Self-host**: any Node server (set `PORT`).  
- **Railway/Render/Heroku**: push to GitHub, connect service, set environment variables, and run `npm start`.
- **Docker**: add a Dockerfile if needed (not included by default).

## GitHub Actions

A simple CI workflow (`.github/workflows/node.yml`) runs install and a DB init check.

## Notes / Next Steps

- Replace the dashboard styling once you provide the **inspiration photo**; CSS is organized for quick theming.
- Add authentication (email link or OAuth) if needed.
- Add CSV/PDF export per job detail view (server has PDF support already).
- Validate GPS coordinates and handle offline caching if required.


## Branding
This build includes ArcWave Energy branding with an electric-blue theme and the company logo used for the header and PWA icon.
