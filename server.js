import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Self-check: print tree and check that public/index.html exists
function list(dir, prefix='') {
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    items.forEach(it => {
      console.log(prefix + (it.isDirectory() ? '[D] ' : '[F] ') + it.name);
      if (it.isDirectory()) list(path.join(dir, it.name), prefix + '  ');
    });
  } catch(e) { console.log('list error', e.message); }
}

console.log('>>> MEGAFIX: Project tree from', process.cwd());
list(process.cwd());
console.log('>>> Checking public/index.html at', path.join(__dirname, 'public', 'index.html'));
console.log('exists?', fs.existsSync(path.join(__dirname, 'public', 'index.html')));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/debug/tree', (req, res) => {
  res.type('text/plain');
  function collect(dir, prefix='') {
    const lines = [];
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const it of items) {
        lines.push(prefix + (it.isDirectory() ? '[D] ' : '[F] ') + it.name);
        if (it.isDirectory()) lines.push(...collect(path.join(dir, it.name), prefix + '  '));
      }
    } catch(e) { lines.push('error: ' + e.message); }
    return lines;
  }
  res.send(collect(process.cwd()).join('\n'));
});

app.get('*', (req, res) => {
  const p = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.status(500).send('MEGAFIX: public/index.html NOT FOUND on server');
});

app.listen(PORT, () => console.log('ArcTrack MegaFix listening on', PORT));
