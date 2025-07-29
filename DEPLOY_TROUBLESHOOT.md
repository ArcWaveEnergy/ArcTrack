# Render Deployment: Quick Fixes

If you see **Cannot find module** on Render, do this:

1) Ensure Node 20 on Render (set in package.json):
```json
"engines": { "node": "20.x" }
```

2) Rebuild native module on Render image:
```json
"scripts": {
  "postinstall": "npm rebuild better-sqlite3 --update-binary || echo 'skipped'"
}
```

3) Render commands:
- **Build Command:** `npm install && npm run db:init`
- **Start Command:** `npm start`

4) Clear build cache & redeploy:
Render → Settings → **Clear build cache** → Manual deploy.

5) Shell checks (Render → Shell):
```bash
node -v
npm -v
node -e "console.log('express:', require.resolve('express'))"
node -e "console.log('better-sqlite3:', require.resolve('better-sqlite3'))"
node -e "console.log('dotenv:', require.resolve('dotenv'))"
```

If one fails, that module didn't build—redeploy after clearing cache.
