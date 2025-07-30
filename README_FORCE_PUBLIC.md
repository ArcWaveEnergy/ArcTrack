# Force-Track `public/` Patch

Your Render logs showed `public/index.html` did not exist on the server. This patch ensures:
- Git will not ignore the `public/` folder.
- You can force-add the folder even if it was previously ignored/cached by Git.

## Apply the Patch
1) Drop the contents of this ZIP into the **root of your repo** (merge/replace files).  
   Ensure your project has this structure:
```
server.js
db.js
public/
  index.html
  styles.css
  app.js
  logo.png
.gitignore   <-- from this patch
scripts/force-add-public.sh
scripts/force-add-public.ps1
.github/workflows/verify-public.yml
```

2) Run the force-add script (choose one):
### macOS/Linux
```
bash scripts/force-add-public.sh
```
### Windows PowerShell
```
powershell -ExecutionPolicy Bypass -File scripts/force-add-public.ps1
```

This will:
- Show if Git is ignoring `public/index.html`,
- Remove cached ignore for `public/`,
- Force-add `public/`,
- Commit and push to `main`.

3) In **Render**:
- Settings -> Clear Build Cache
- Manual Deploy

4) Verify
- Open your app root URL. If you still see an error, visit `/debug/tree` (if you have the MegaFix server) to view the server file tree.
