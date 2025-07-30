Param()

Write-Host "Checking if Git ignores public/index.html ..."
git check-ignore -v public/index.html
if ($LASTEXITCODE -ne 0) { Write-Host "Not ignored (or file missing locally)." }

Write-Host "Removing cached 'public' from Git index (if present)..."
git rm -r --cached public
if ($LASTEXITCODE -ne 0) { Write-Host "public not cached or already removed." }

Write-Host "Force-adding public folder..."
git add -f public

Write-Host "Adding other changes..."
git add .

Write-Host "Committing..."
git commit -m "Force-track public folder (ForcePatch)"
if ($LASTEXITCODE -ne 0) { Write-Host "Nothing to commit." }

Write-Host "Pushing to main..."
git push origin main
Write-Host "Done."
