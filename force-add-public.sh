#!/usr/bin/env bash
set -e

echo "Checking if Git ignores public/index.html ..."
git check-ignore -v public/index.html || echo "Not ignored (or file missing locally)."

echo "Removing cached 'public' from Git index (if present)..."
git rm -r --cached public || true

echo "Force-adding public folder..."
git add -f public

echo "Adding other changes..."
git add .

echo "Committing..."
git commit -m "Force-track public folder (ForcePatch)" || echo "Nothing to commit."

echo "Pushing to main..."
git push origin main
echo "Done."
