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

---

## 6. Enable Auto-Deploy from GitHub (Render)

This repo includes a GitHub Action that triggers a Render deploy every time you push to the `main` branch.

**Steps (one-time):**
1. In Render, open your web service → **Settings** → **Deploy Hooks** → **New Deploy Hook** → copy the URL.
2. In GitHub, go to your repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:
   - Name: `RENDER_DEPLOY_HOOK_URL`
   - Value: *(paste the hook URL from Render)*
3. Push a commit to `main` (or click **Run workflow** in the Actions tab). Render will build and deploy automatically.

> If you prefer using the Render API instead of a Deploy Hook, replace the workflow step with:
> ```yaml
> - name: Trigger Render Deploy via API
>   run: |
>     curl -fsSL -X POST >       -H "Authorization: Bearer ${{ secrets.RENDER_API_KEY }}" >       -H "Content-Type: application/json" >       -d '{"branch":"main"}' >       https://api.render.com/v1/services/${{ secrets.RENDER_SERVICE_ID }}/deploys
> ```
> and add repo secrets `RENDER_API_KEY` and `RENDER_SERVICE_ID`.
