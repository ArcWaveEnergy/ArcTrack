# ArcTrack - Setup

## 1) Environment
Copy and edit:
```bash
cp .env.example .env
```
Fill SMTP_* and MAIL_FROM. Update APP_BASE_URL to your deployed URL after deployment.

## 2) Install & Init
```bash
npm install
npm run db:init
```

## 3) Run
```bash
npm run dev
```

## 4) Render Deploy
- Build: `npm install && npm run db:init`
- Start: `npm start`
- Env: PORT, APP_BASE_URL, SMTP_*

## 5) Auto-Deploy from GitHub to Render
- In Render: create a **Deploy Hook** and copy the URL.
- In GitHub: Settings → Secrets → Actions → New secret
  - Name: `RENDER_DEPLOY_HOOK_URL`
  - Value: *(paste hook URL)*
- Pushing to `main` triggers deploy.

## 6) Test
- Create a job or use sample job "#1001 - Sample Job - Generator Install"
- Clock In, Clock Out
- Send Report
