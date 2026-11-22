import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const isDryRun = process.argv.includes('--dry-run');
const dbUrl = process.env.DATABASE_URL || '';
const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');

const backupDir = path.resolve(rootDir, 'database/backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const now = new Date();
const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);

if (isPostgres) {
  const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
  console.log(`[db:backup] Target database: PostgreSQL (${maskedUrl})`);
  const backupSqlFile = path.resolve(backupDir, `utsavora-pg-backup-${timestamp}.sql`);
  if (isDryRun) {
    console.log(`[db:backup:dry-run] Would dump PostgreSQL database to: ${backupSqlFile}`);
    process.exit(0);
  }
  try {
    execSync(`pg_dump "${dbUrl}" > "${backupSqlFile}"`, { stdio: 'pipe' });
    console.log(`✅ [db:backup] Successfully created PostgreSQL dump at: database/backups/${path.basename(backupSqlFile)}`);
  } catch (err) {
    console.log(`ℹ️ [db:backup] pg_dump CLI utility not detected locally.`);
    console.log(`   Neon provides automated continuous point-in-time recovery (PITR) & instant branch snapshots.`);
    console.log(`   To take an on-demand SQL dump from your terminal: pg_dump "$DATABASE_URL" > database/backups/utsavora-pg-backup.sql`);
  }
} else {
  const dbFile = path.resolve(rootDir, 'database/utsavora.db');
  console.log(`[db:backup] Target database: SQLite (${dbFile})`);
  if (!fs.existsSync(dbFile)) {
    console.error('❌ Database file not found at:', dbFile);
    process.exit(1);
  }
  const backupFile = path.resolve(backupDir, `utsavora-backup-${timestamp}.db`);
  if (isDryRun) {
    console.log(`[db:backup:dry-run] Would copy SQLite database to: ${backupFile}`);
    process.exit(0);
  }
  fs.copyFileSync(dbFile, backupFile);
  console.log(`✅ [db:backup] Successfully backed up database to: database/backups/${path.basename(backupFile)}`);
}
