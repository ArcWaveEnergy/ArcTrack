# ArcTrack - Deployment & Setup Instructions

## 1. Configure Environment Variables

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Then edit `.env` with your actual values:
- SMTP credentials (see your email provider)
- PORT (optional, defaults to 8080)
- APP_BASE_URL (e.g., http://localhost:8080 or your deployed URL)

---

## 2. Install and Initialize

Run from the root of the project:
```bash
npm install
npm run db:init
```

---

## 3. Start the App

```bash
npm run dev
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

---

## 4. Deploy to Render/Railway

- Connect your GitHub repo
- Set env variables in the dashboard
- Build command: `npm install && npm run db:init`
- Start command: `npm start`

---

## 5. Send Test Report

1. Create a job
2. Clock in and out
3. Click "Send Report"

A PDF will be sent to `jobinformation@arcwaveenergy.com` and to your user email as CC.
