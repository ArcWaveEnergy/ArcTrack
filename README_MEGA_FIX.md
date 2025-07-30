# ArcTrack Mega Fix

This package guarantees the `public/` folder is committed and deployed.

## How to install

1. Replace your repo contents with this package (root level).
2. Run:
   git add .
   git commit -m "MegaFix: ensure public folder"
   git push origin main

3. On Render:
   - Build Command: npm install
   - Start Command: npm start
   - Clear build cache
   - Redeploy

## If public still won't show in Git

Run these in your repo:

git check-ignore -v public/index.html
git rm -r --cached public
git add -f public
git commit -m "Force-add public folder"
git push origin main

Then redeploy on Render and open /debug/tree to see the server file tree.
