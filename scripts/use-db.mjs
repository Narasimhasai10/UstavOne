#!/usr/bin/env node
/**
 * scripts/use-db.mjs
 * Switches the active Prisma schema between SQLite (development default) and PostgreSQL (production).
 * Generates database/schema.prisma from database/schema.base.prisma.
 *
 * Usage:
 *   node scripts/use-db.mjs sqlite [--skip-generate] [--dry-run]
 *   node scripts/use-db.mjs postgres [--skip-generate] [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const basePath = path.resolve(rootDir, 'database/schema.base.prisma');
const targetPath = path.resolve(rootDir, 'database/schema.prisma');

const args = process.argv.slice(2);
const providerArg = (args[0] || 'sqlite').toLowerCase();
const skipGenerate = args.includes('--skip-generate');
const isDryRun = args.includes('--dry-run');

let provider = 'sqlite';
if (providerArg === 'postgres' || providerArg === 'postgresql') {
  provider = 'postgresql';
} else if (providerArg === 'sqlite') {
  provider = 'sqlite';
} else {
  console.error(`❌ Unknown provider "${providerArg}". Use "sqlite" or "postgres".`);
  process.exit(1);
}

if (!fs.existsSync(basePath)) {
  console.error(`❌ Source schema template not found at: ${basePath}`);
  process.exit(1);
}

const baseContent = fs.readFileSync(basePath, 'utf8');

let datasourceBlock = '';
if (provider === 'sqlite') {
  datasourceBlock = `datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}`;
} else {
  datasourceBlock = `datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}`;
}

const generatedSchema = baseContent.replace('// __DATASOURCE_BLOCK__', datasourceBlock);

if (isDryRun) {
  console.log(`[use-db:dry-run] Target: ${targetPath}`);
  console.log(`[use-db:dry-run] Selected provider: ${provider}`);
  console.log('[use-db:dry-run] Datasource block that would be written:');
  console.log(datasourceBlock);
  process.exit(0);
}

fs.writeFileSync(targetPath, generatedSchema, 'utf8');
console.log(`✅ [use-db] Successfully generated database/schema.prisma configured for ${provider}.`);

if (!skipGenerate) {
  console.log(`⏳ [use-db] Running "prisma generate" for ${provider}...`);
  try {
    const prismaCliPath = fs.existsSync(path.resolve(rootDir, 'node_modules/prisma/build/index.js'))
      ? path.resolve(rootDir, 'node_modules/prisma/build/index.js')
      : path.resolve(rootDir, 'backend/node_modules/prisma/build/index.js');
    const cmd = fs.existsSync(prismaCliPath)
      ? `node "${prismaCliPath}" generate --schema database/schema.prisma`
      : 'npx --no-install prisma generate --schema database/schema.prisma';

    execSync(cmd, {
      cwd: rootDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        // Provide dummy valid env variables so Prisma CLI doesn't complain during generate
        DATABASE_URL: process.env.DATABASE_URL || (provider === 'sqlite' ? 'file:./utsavora.db' : 'postgresql://dummy:dummy@localhost:5432/utsavora'),
        DIRECT_URL: process.env.DIRECT_URL || 'postgresql://dummy:dummy@localhost:5432/utsavora'
      }
    });
    console.log(`✨ [use-db] Prisma client regenerated successfully for ${provider}.`);
  } catch (err) {
    console.error(`❌ [use-db] Failed to regenerate Prisma client:`, err.message);
    process.exit(1);
  }
}
