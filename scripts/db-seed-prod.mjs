#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const seedScript = path.resolve(rootDir, 'database/seed.js');

function maskDatabaseUrl(url) {
  if (!url) return '(unspecified)';
  try {
    return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
  } catch {
    return url;
  }
}

const dbUrl = process.env.DATABASE_URL || 'file:../database/utsavora.db';
const args = process.argv.slice(2);

console.log(`[DB Seed Prod] Target database: ${maskDatabaseUrl(dbUrl)}`);
console.log('🌱 Executing production seed (SEED_MODE=minimal)...');

const result = spawnSync('node', [seedScript, ...args], {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    SEED_MODE: 'minimal',
    DATABASE_URL: dbUrl
  }
});

process.exit(result.status || 0);
