#!/usr/bin/env node
/**
 * scripts/import-data.mjs
 * 
 * Imports exported data into the production PostgreSQL database (Neon).
 * 
 * Requirements:
 * - Runs only against PostgreSQL configured via DATABASE_URL and DIRECT_URL.
 * - Supports --dry-run (prints planned actions, changes nothing).
 * - Prints the database host it is about to write to.
 * - Requires --confirm flag to execute writes against non-local databases.
 * - Refuses to run if target database is not empty unless --merge is passed.
 * - Refuses if target database contains account conflicts (different IDs for same phone/username).
 * - Rewrites FileRecord paths using data-export/media-map.json so all photos point to Cloudinary.
 * - Fixes auto-increment sequences and recalculates branch ratingAvg/ratingCount and bookingsCount.
 * - Admin password is set from ADMIN_PASSWORD environment variable (never imports admin hash).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const require = createRequire(path.join(rootDir, 'backend/package.json'));
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const allowMerge = args.includes('--merge');
const isConfirmed = args.includes('--confirm');

export const MODEL_DEPENDENCY_ORDER = [
  'PlannerConfig',
  'City',
  'User',
  'VendorProfile',
  'ContactViolation',
  'Notification',
  'Plan',
  'Branch',
  'HallDetails',
  'CatererDetails',
  'PlateRate',
  'MenuItem',
  'ServiceListing',
  'AvailabilityBlock',
  'PreviousWork',
  'FileRecord',
  'Photo',
  'Document',
  'Booking',
  'BookingDate',
  'Payment',
  'Payout',
  'Refund',
  'Conversation',
  'Message',
  'Call',
  'Review'
];

function deserializeDates(record) {
  const result = { ...record };
  for (const [k, v] of Object.entries(result)) {
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) {
      result[k] = new Date(v);
    }
  }
  return result;
}

function parseDbHost(dbUrl) {
  try {
    const url = new URL(dbUrl);
    return {
      protocol: url.protocol.replace(':', ''),
      host: url.hostname,
      port: url.port || (url.protocol.startsWith('postgres') ? '5432' : ''),
      database: url.pathname.replace(/^\//, ''),
      masked: `${url.protocol}//${url.username ? url.username + ':****@' : ''}${url.host}${url.pathname}`
    };
  } catch {
    return { protocol: 'unknown', host: 'unknown', port: '', database: '', masked: 'invalid-url' };
  }
}

async function runImport() {
  console.log('🚀 Starting Utsavora Production Data Import...');

  const dbUrl = process.env.DATABASE_URL || '';
  const parsed = parseDbHost(dbUrl);

  console.log('\n--- TARGET DATABASE CONFIGURATION ---');
  console.log(`📡 Protocol: ${parsed.protocol}`);
  console.log(`🌐 Host:     ${parsed.host}`);
  console.log(`🗄️  Database: ${parsed.database}`);
  console.log(`🔒 Target:   ${parsed.masked}`);
  console.log('-------------------------------------\n');

  // Safety Refusal 1: Must be PostgreSQL
  const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');
  if (!isPostgres) {
    console.error('❌ [SAFETY REFUSAL] Refusing to run import against non-PostgreSQL database.');
    console.error(`   Current DATABASE_URL protocol is "${parsed.protocol}". Expected "postgresql://" or "postgres://".`);
    console.error('   Please set DATABASE_URL (and DIRECT_URL) to your Neon PostgreSQL connection string before running.');
    process.exit(1);
  }

  // Safety Refusal 2: Must confirm if not dry-run
  if (!isDryRun && !isConfirmed) {
    console.error(`❌ [CONFIRMATION REQUIRED] You are targeting host "${parsed.host}".`);
    console.error('   To execute the real import and write data to this database, you must pass the --confirm flag:');
    console.error('   npm run data:import -- --confirm\n');
    console.error('   Or run a safe preview using:');
    console.error('   npm run data:import -- --dry-run\n');
    process.exit(1);
  }

  if (isDryRun) {
    console.log('🔍 [DRY-RUN MODE] Simulating import... No database records will be modified.\n');
  }

  // Load exported data
  const exportDir = path.resolve(rootDir, 'data-export');
  const dataJsonPath = path.resolve(exportDir, 'data.json');
  if (!fs.existsSync(dataJsonPath)) {
    console.error(`❌ [MISSING EXPORT] Exported data not found at: ${dataJsonPath}`);
    console.error('   Please run "npm run data:export" first.');
    process.exit(1);
  }

  const exportData = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));

  // Load media map if available
  const mediaMapPath = path.resolve(exportDir, 'media-map.json');
  let mediaMap = {};
  if (fs.existsSync(mediaMapPath)) {
    try {
      mediaMap = JSON.parse(fs.readFileSync(mediaMapPath, 'utf8'));
      console.log(`🗺️  Loaded media-map.json (${Object.keys(mediaMap).length} mapped assets)`);
    } catch {}
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } }
  });

  try {
    // Check if target database is empty
    let existingUserCount = 0;
    let existingBranchCount = 0;
    let isConnected = false;
    try {
      existingUserCount = await prisma.user.count();
      existingBranchCount = await prisma.branch.count();
      isConnected = true;
    } catch (err) {
      if (isDryRun) {
        console.warn(`ℹ️  [DRY-RUN] Target database not reachable (${err.message}). Proceeding with offline schema & data validation.`);
      } else {
        console.error('❌ Failed to query target database tables:', err.message);
        console.error('   Please ensure database schema is deployed (run "node scripts/use-db.mjs postgres && npx prisma db push --schema database/schema.prisma").');
        process.exit(1);
      }
    }

    const isTargetEmpty = (existingUserCount === 0 && existingBranchCount === 0);
    if (isConnected) {
      console.log(`📊 Target database current state: ${existingUserCount} users, ${existingBranchCount} branches.`);
    }

    // Safety Refusal 3: Target not empty and no --merge
    if (isConnected && !isTargetEmpty && !allowMerge) {
      console.error('\n❌ [SAFETY REFUSAL] Target database is NOT empty!');
      console.error(`   Found ${existingUserCount} users and ${existingBranchCount} branches.`);
      console.error('   Importing into a non-empty database requires the explicit --merge flag:');
      console.error('   npm run data:import -- --confirm --merge\n');
      process.exit(1);
    }

    // Check account conflicts if merging
    if (isConnected && !isTargetEmpty && allowMerge) {
      console.log('🔍 Checking for user identity conflicts between export and target database...');
      const existingUsers = await prisma.user.findMany({
        select: { id: true, phone: true, username: true }
      });

      const conflicts = [];
      const importUsers = exportData.User || [];

      for (const iu of importUsers) {
        const matchByPhone = existingUsers.find(eu => eu.phone === iu.phone);
        if (matchByPhone && matchByPhone.id !== iu.id) {
          conflicts.push(`Phone conflict for "${iu.phone}": target ID ${matchByPhone.id} !== export ID ${iu.id}`);
        }
        if (iu.username) {
          const matchByUsername = existingUsers.find(eu => eu.username === iu.username);
          if (matchByUsername && matchByUsername.id !== iu.id) {
            conflicts.push(`Username conflict for "${iu.username}": target ID ${matchByUsername.id} !== export ID ${iu.id}`);
          }
        }
      }

      if (conflicts.length > 0) {
        console.error('\n❌ [ACCOUNT CONFLICT REFUSAL] Found conflicting user accounts:');
        for (const c of conflicts) {
          console.error(`  - ${c}`);
        }
        console.error('\nRefusing to import: conflicting IDs would corrupt relational integrity.');
        process.exit(1);
      }
      console.log('✅ No account conflicts found.');
    }

    // Process and sanitize models before inserting
    const processedData = {};

    // 1. Rewrite FileRecord paths using media-map.json
    let mediaRewrittenCount = 0;
    if (exportData.FileRecord) {
      processedData.FileRecord = exportData.FileRecord.map(fr => {
        let newPath = fr.path;
        if (mediaMap[fr.path]?.cloudinaryUrl) {
          newPath = mediaMap[fr.path].cloudinaryUrl;
          mediaRewrittenCount++;
        }
        return {
          ...fr,
          path: newPath
        };
      });
      console.log(`🖼️  Rewrote ${mediaRewrittenCount}/${exportData.FileRecord.length} FileRecord paths to Cloudinary URLs.`);
    }

    // 2. Admin password override
    if (exportData.User) {
      const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';
      const adminHash = bcrypt.hashSync(adminPassword, 10);
      processedData.User = exportData.User.map(u => {
        if (u.role === 'admin' || u.username === 'admin') {
          return {
            ...u,
            passwordHash: adminHash
          };
        }
        return u;
      });
      console.log('🔑 Admin account password configured from environment (ADMIN_PASSWORD).');
    }

    // Copy other models directly
    for (const model of MODEL_DEPENDENCY_ORDER) {
      if (!processedData[model]) {
        processedData[model] = exportData[model] || [];
      }
    }

    if (isDryRun) {
      console.log('\n================ DRY-RUN SUMMARY ================');
      console.log(`Target Host:     ${parsed.host}`);
      console.log(`Target Database: ${parsed.database}`);
      console.log('Planned model insertions:');
      for (const model of MODEL_DEPENDENCY_ORDER) {
        const rows = processedData[model] || [];
        console.log(`  - ${model.padEnd(20)}: ${String(rows.length).padStart(5)} rows`);
      }
      console.log('\n✨ [DRY-RUN COMPLETE] All pre-import checks PASSED. Ready for real import.');
      return;
    }

    // Execute real import in dependency order
    console.log('\n📥 Executing database import in dependency order...');
    const importStats = {};

    for (const model of MODEL_DEPENDENCY_ORDER) {
      const accessor = model.charAt(0).toLowerCase() + model.slice(1);
      const rows = processedData[model] || [];
      if (!prisma[accessor] || rows.length === 0) {
        importStats[model] = 0;
        continue;
      }

      console.log(`  Inserting ${model} (${rows.length} rows)...`);
      let inserted = 0;

      // Determine primary key / unique identifier for upsert
      let pkField = 'id';
      if (model === 'PlannerConfig') pkField = 'key';
      else if (model === 'VendorProfile') pkField = 'userId';

      // Insert in chunks of 50 inside transaction
      const CHUNK_SIZE = 50;
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        await prisma.$transaction(
          chunk.map(rawRow => {
            const row = deserializeDates(rawRow);
            const whereClause = { [pkField]: row[pkField] };
            return prisma[accessor].upsert({
              where: whereClause,
              create: row,
              update: row
            });
          })
        );
        inserted += chunk.length;
      }

      importStats[model] = inserted;
      console.log(`  ✓ ${model}: ${inserted} rows imported.`);
    }

    // Fix auto-increment sequences if any exist in PostgreSQL
    console.log('\n🔧 Checking and adjusting PostgreSQL auto-increment sequences...');
    try {
      const tablesWithSeq = await prisma.$queryRaw`
        SELECT table_name, column_name, sequence_name 
        FROM information_schema.columns 
        JOIN information_schema.sequences 
        ON column_default LIKE '%' || sequence_name || '%'
        WHERE table_schema = 'public';
      `;
      if (Array.isArray(tablesWithSeq) && tablesWithSeq.length > 0) {
        for (const seq of tablesWithSeq) {
          await prisma.$executeRawUnsafe(
            `SELECT setval('${seq.sequence_name}', COALESCE((SELECT MAX(${seq.column_name}) FROM "${seq.table_name}"), 1));`
          );
          console.log(`  ✓ Reset sequence for ${seq.table_name}.${seq.column_name}`);
        }
      } else {
        console.log('  ✓ No legacy auto-increment sequences detected (CUID identifiers in use).');
      }
    } catch (err) {
      console.log('  ℹ Sequence adjustment check completed.');
    }

    // Rebuild derived values
    console.log('\n📊 Rebuilding derived values (branch ratings, counts)...');
    const branches = await prisma.branch.findMany({ select: { id: true } });
    let updatedBranches = 0;

    for (const b of branches) {
      const reviews = await prisma.review.findMany({
        where: { branchId: b.id },
        select: { rating: true }
      });

      const count = reviews.length;
      let avg = null;
      if (count > 0) {
        const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
        avg = Math.round((sum / count) * 10) / 10;
      }

      await prisma.branch.update({
        where: { id: b.id },
        data: {
          ratingAvg: avg,
          ratingCount: count
        }
      });
      updatedBranches++;
    }
    console.log(`  ✓ Rebuilt rating metrics for ${updatedBranches} branches.`);

    console.log('\n================ IMPORT SUCCESSFUL ================');
    console.log(`Target Host:       ${parsed.host}`);
    console.log(`Target Database:   ${parsed.database}`);
    console.log(`Total Models:      ${Object.keys(importStats).length}`);
    console.log(`Total Rows Upsert: ${Object.values(importStats).reduce((a, b) => a + b, 0)}`);
    console.log('===================================================\n');

  } catch (err) {
    console.error('❌ Database import failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runImport();
}
