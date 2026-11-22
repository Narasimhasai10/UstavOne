#!/usr/bin/env node
/**
 * scripts/export-data.mjs
 * 
 * Exports local SQLite database (database/utsavora.db) into data-export/data.json
 * and data-export/manifest.json in dependency order.
 * 
 * Excludes sessions, refresh tokens, rate-limit/lockout counters, and audit logs.
 * Preserves IDs, relations, bcrypt password hashes, and dates.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const require = createRequire(path.join(rootDir, 'backend/package.json'));
const { PrismaClient } = require('@prisma/client');

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

async function runExport() {
  console.log('📦 Starting Utsavora Data Export from local SQLite...');

  const dbPath = path.resolve(rootDir, 'database/utsavora.db');
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Source database file not found at: ${dbPath}`);
    process.exit(1);
  }

  const exportDir = path.resolve(rootDir, 'data-export');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: `file:${dbPath}` } }
  });

  const exportData = {};
  const modelCounts = {};
  const filePaths = [];
  const privateDocumentFiles = [];

  try {
    for (const model of MODEL_DEPENDENCY_ORDER) {
      const accessor = model.charAt(0).toLowerCase() + model.slice(1);
      if (!prisma[accessor]) {
        console.warn(`⚠️ Warning: Accessor prisma.${accessor} not found on client. Skipping.`);
        continue;
      }

      let rows = await prisma[accessor].findMany();

      // Model-specific sanitization & rules
      if (model === 'User') {
        // Reset rate-limit / lockout counters as requested; keep bcrypt hashes intact
        rows = rows.map(u => ({
          ...u,
          failedLogins: 0,
          lockedUntil: null
        }));
      } else if (model === 'FileRecord') {
        for (const r of rows) {
          if (r.path) filePaths.push(r.path);
        }
      } else if (model === 'Document') {
        for (const d of rows) {
          if (d.fileId) {
            privateDocumentFiles.push({
              documentId: d.id,
              type: d.type,
              number: d.number,
              fileId: d.fileId
            });
          }
        }
      }

      exportData[model] = rows;
      modelCounts[model] = rows.length;
      console.log(`  ✓ Exported ${model.padEnd(20)}: ${String(rows.length).padStart(5)} records`);
    }

    // Also scan physical private uploads folder if any files exist
    const privateUploadsDir = path.resolve(rootDir, 'backend/uploads/private');
    if (fs.existsSync(privateUploadsDir)) {
      const files = fs.readdirSync(privateUploadsDir);
      for (const f of files) {
        if (!privateDocumentFiles.some(d => d.filename === f)) {
          privateDocumentFiles.push({
            type: 'uploaded_private_file',
            filename: f,
            path: `/uploads/private/${f}`
          });
        }
      }
    }

    // Write data-export/data.json
    const dataJsonPath = path.resolve(exportDir, 'data.json');
    const jsonString = JSON.stringify(exportData, null, 2);
    fs.writeFileSync(dataJsonPath, jsonString, 'utf8');

    // Compute checksum of data.json
    const sha256 = crypto.createHash('sha256').update(jsonString, 'utf8').digest('hex');

    // Write data-export/manifest.json
    const manifest = {
      exportVersion: '1.0.0',
      timestamp: new Date().toISOString(),
      sourceDatabase: 'database/utsavora.db',
      checksumSha256: sha256,
      totalModelsExported: Object.keys(exportData).length,
      excludedModels: ['RefreshToken', 'AuditLog'],
      modelCounts,
      fileRecordPathsCount: filePaths.length,
      fileRecordPaths: filePaths,
      privateDocumentFilesCount: privateDocumentFiles.length,
      privateDocumentFiles
    };

    const manifestJsonPath = path.resolve(exportDir, 'manifest.json');
    fs.writeFileSync(manifestJsonPath, JSON.stringify(manifest, null, 2), 'utf8');

    console.log('\n================ EXPORT COMPLETE ================');
    console.log(`✅ Data written to:     ${dataJsonPath} (${(jsonString.length / 1024).toFixed(1)} KB)`);
    console.log(`✅ Manifest written to: ${manifestJsonPath}`);
    console.log(`🔑 SHA-256 Checksum:   ${sha256}`);
    console.log(`📁 Total Models:       ${Object.keys(exportData).length}`);
    console.log(`🖼️  Total FileRecords:   ${filePaths.length}`);
    console.log(`🔒 Private Documents:  ${privateDocumentFiles.length}`);
    console.log('=================================================\n');

  } catch (err) {
    console.error('❌ Data export failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runExport();
}
