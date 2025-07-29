# ArcTrack

Field-friendly job tracking for ArcWave Energy:
- Clock In/Out with GPS
- Regular vs Overtime (8:00–17:00 America/Chicago)
- Hotel costs & nights
- PDF job reports emailed to jobinformation@arcwaveenergy.com (CC to user)
- ArcWave branding + PWA
- Auto-deploy to Render via GitHub Actions

## Quick Start (Local)
```bash
npm install
npm run db:init
cp .env.example .env  # fill SMTP values
npm run dev
# open http://localhost:8080
```

## Deploy (Render)
- Build command: `npm install && npm run db:init`
- Start command: `npm start`
- Set env vars: PORT, APP_BASE_URL, SMTP_* , MAIL_FROM

## Auto-Deploy
A GitHub Action at `.github/workflows/deploy-render.yml` triggers a Render Deploy Hook on each push to `main`.
Add repo secret: `RENDER_DEPLOY_HOOK_URL` (from Render → Settings → Deploy Hooks).

## Scripts
- `npm run db:init` – creates/updates the SQLite DB
- `npm run db:reset` – wipes the DB and re-initializes
