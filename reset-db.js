import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'data', 'arctrack.sqlite');
try { fs.unlinkSync(dbPath); console.log('DB removed'); } catch {}
import './init-db.js';
