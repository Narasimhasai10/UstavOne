#!/usr/bin/env node
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const schemaPath = path.resolve(rootDir, 'database/schema.prisma');

function maskDatabaseUrl(url) {
  if (!url) return '(unspecified)';
  try {
    return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
  } catch {
    return url;
  }
}

const dbUrl = process.env.DATABASE_URL || 'file:../database/utsavora.db';
const isDryRun = process.argv.includes('--dry-run');

console.log(`[DB Deploy] Target database: ${maskDatabaseUrl(dbUrl)}`);

if (isDryRun) {
  console.log('🔍 [DRY RUN] Simulating database schema deployment...');
  console.log(`  - Schema path: ${schemaPath}`);
  console.log('  - Action: Would run prisma db push --skip-generate');
  console.log('✅ [DRY RUN] Simulation complete. No changes were applied.');
  process.exit(0);
}

try {
  console.log('🚀 Deploying schema to target database...');
  execSync(`npx prisma db push --schema "${schemaPath}" --skip-generate`, {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: dbUrl }
  });
  console.log('✅ Database schema deployment succeeded.');
} catch (err) {
  console.error('❌ Database schema deployment failed:', err.message);
  process.exit(1);
}
