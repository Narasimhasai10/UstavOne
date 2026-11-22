import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const dbFile = path.resolve(rootDir, 'database/vedika.db');
const backupDir = path.resolve(rootDir, 'database/backups');

if (!fs.existsSync(dbFile)) {
  console.error('❌ Database file not found at:', dbFile);
  process.exit(1);
}

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const now = new Date();
const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
const backupFile = path.resolve(backupDir, `vedika-backup-${timestamp}.db`);

fs.copyFileSync(dbFile, backupFile);
console.log(`✅ [db:backup] Successfully backed up database to: database/backups/${path.basename(backupFile)}`);
