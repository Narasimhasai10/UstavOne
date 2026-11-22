import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dbFile = path.resolve(rootDir, 'database/vedika.db');
const dbJournal = path.resolve(rootDir, 'database/vedika.db-journal');
const backendDir = path.resolve(rootDir, 'backend');
const schemaPath = path.resolve(rootDir, 'database/schema.prisma');

console.log('🔄 Resetting Vedika database...\n');

// 1. Remove database file if exists
try {
  if (fs.existsSync(dbFile)) {
    fs.unlinkSync(dbFile);
    console.log('✓ Removed existing database/vedika.db');
  }
  if (fs.existsSync(dbJournal)) {
    fs.unlinkSync(dbJournal);
  }
} catch (err) {
  console.warn('⚠️ Could not remove file directly:', err.message);
}

// 2. Push schema to database
console.log('-> Applying schema to database/vedika.db...');
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
execSync(`${npxCmd} prisma db push --schema "${schemaPath}" --accept-data-loss`, {
  cwd: backendDir,
  env: {
    ...process.env,
    DATABASE_URL: `file:${dbFile.replace(/\\/g, '/')}`
  },
  stdio: 'inherit'
});

// 3. Seed database
console.log('-> Seeding database...');
execSync('node database/seed.js', {
  cwd: rootDir,
  stdio: 'inherit'
});

// 4. Sync planner config
console.log('-> Synchronizing planner configuration...');
execSync('node scripts/sync-planner-config.mjs', {
  cwd: rootDir,
  stdio: 'inherit'
});

console.log('\n✅ Database reset & seeded successfully.');
