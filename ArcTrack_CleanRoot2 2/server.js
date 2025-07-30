import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

console.log(">>> Checking public/index.html at:", path.join(__dirname, 'public', 'index.html'));
console.log("exists?", fs.existsSync(path.join(__dirname, 'public', 'index.html')));

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log('ArcTrack CleanRoot2 listening on', PORT));