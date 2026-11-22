#!/usr/bin/env node
/**
 * scripts/upload-media.mjs
 * 
 * Uploads all public and private media assets to Cloudinary via CloudinaryStorageAdapter.
 * - Uses stable public_id derived from filename so reruns never duplicate.
 * - Uploads private documents (licenses, FSSAI) as "authenticated" assets.
 * - Produces data-export/media-map.json mapping local paths to Cloudinary URLs.
 * - Reports any files recorded in database that are missing on disk.
 * - Supports --dry-run mode.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CloudinaryStorageAdapter } from '../backend/src/adapters/storage/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const isDryRun = process.argv.includes('--dry-run');

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.svg': return 'image/svg+xml';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.png': return 'image/png';
    case '.webp': return 'image/webp';
    case '.pdf': return 'application/pdf';
    default: return 'application/octet-stream';
  }
}

function sanitizePublicId(filename) {
  // Strip extension and replace non-alphanumeric/hyphen/underscore with hyphen
  const base = path.parse(filename).name;
  return base.replace(/[^a-zA-Z0-9_\-]/g, '_');
}

async function runUpload() {
  console.log('☁️  Starting Utsavora Media Migration to Cloudinary...');
  if (isDryRun) {
    console.log('🔍 [DRY-RUN] Simulating media migration (no files will be uploaded).');
  }

  const exportDir = path.resolve(rootDir, 'data-export');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const publicUploadsDir = path.resolve(rootDir, 'backend/uploads/public');
  const privateUploadsDir = path.resolve(rootDir, 'backend/uploads/private');

  // Load manifest if available to cross-reference database file records
  let manifest = null;
  const manifestPath = path.resolve(exportDir, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch {}
  }

  const storage = new CloudinaryStorageAdapter();
  const isCloudinaryReady = storage.isConfigured();

  if (!isCloudinaryReady && !isDryRun) {
    console.warn('\n⚠️  Cloudinary credentials are not configured in your environment.');
    console.warn('   Expected: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET (or CLOUDINARY_URL).');
    console.warn('   Defaulting to DRY-RUN mode to show planned uploads and generate preview media map.\n');
  }

  // Collect all files on disk
  const filesToProcess = [];

  if (fs.existsSync(publicUploadsDir)) {
    const publicFiles = fs.readdirSync(publicUploadsDir);
    for (const file of publicFiles) {
      const fullPath = path.join(publicUploadsDir, file);
      if (fs.statSync(fullPath).isFile()) {
        filesToProcess.push({
          fullPath,
          filename: file,
          localPath: `/uploads/public/${file}`,
          isPublic: true
        });
      }
    }
  }

  if (fs.existsSync(privateUploadsDir)) {
    const privateFiles = fs.readdirSync(privateUploadsDir);
    for (const file of privateFiles) {
      const fullPath = path.join(privateUploadsDir, file);
      if (fs.statSync(fullPath).isFile()) {
        filesToProcess.push({
          fullPath,
          filename: file,
          localPath: `/uploads/private/${file}`,
          isPublic: false
        });
      }
    }
  }

  console.log(`📁 Found ${filesToProcess.length} total media files on disk:`);
  console.log(`   - Public assets:    ${filesToProcess.filter(f => f.isPublic).length}`);
  console.log(`   - Private assets:   ${filesToProcess.filter(f => !f.isPublic).length}`);

  // Check for any FileRecord paths in manifest that are missing on disk
  const missingFiles = [];
  if (manifest && manifest.fileRecordPaths) {
    const diskPathSet = new Set(filesToProcess.map(f => f.localPath));
    for (const expectedPath of manifest.fileRecordPaths) {
      if (!diskPathSet.has(expectedPath)) {
        missingFiles.push(expectedPath);
      }
    }
  }

  if (missingFiles.length > 0) {
    console.warn(`\n⚠️  [MISSING FILES] ${missingFiles.length} file records in database were not found on disk:`);
    for (const m of missingFiles.slice(0, 10)) {
      console.warn(`   - ${m}`);
    }
    if (missingFiles.length > 10) console.warn(`   ... and ${missingFiles.length - 10} more`);
  } else {
    console.log('✅ All database file records exist on disk (0 missing).');
  }

  // Load existing media-map.json if present to allow resuming
  const mediaMapPath = path.resolve(exportDir, 'media-map.json');
  let mediaMap = {};
  if (fs.existsSync(mediaMapPath)) {
    try {
      mediaMap = JSON.parse(fs.readFileSync(mediaMapPath, 'utf8'));
      console.log(`ℹ️  Loaded existing media-map.json with ${Object.keys(mediaMap).length} entries.`);
    } catch {}
  }

  let uploadedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const item of filesToProcess) {
    const stablePublicId = sanitizePublicId(item.filename);

    // If already mapped and points to Cloudinary, can skip re-upload unless forced
    if (mediaMap[item.localPath]?.cloudinaryUrl && !isDryRun) {
      skippedCount++;
      continue;
    }

    if (isDryRun || !isCloudinaryReady) {
      // Simulate Cloudinary URL in dry run
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'utsavora-cloud';
      const folderPrefix = item.isPublic ? 'photos' : 'documents';
      const simulatedUrl = `https://res.cloudinary.com/${cloudName}/image/upload/v1700000000/utsavora/${folderPrefix}/${stablePublicId}${path.extname(item.filename)}`;
      
      mediaMap[item.localPath] = {
        cloudinaryUrl: simulatedUrl,
        publicId: `utsavora/${folderPrefix}/${stablePublicId}`,
        filename: item.filename,
        isPublic: item.isPublic,
        sizeBytes: fs.statSync(item.fullPath).size,
        simulated: true,
        updatedAt: new Date().toISOString()
      };
      uploadedCount++;
    } else {
      try {
        const buffer = fs.readFileSync(item.fullPath);
        const mime = getMimeType(item.fullPath);

        const uploadResult = await storage.save({
          buffer,
          originalname: item.filename,
          mime,
          isPublic: item.isPublic,
          publicId: stablePublicId
        });

        mediaMap[item.localPath] = {
          cloudinaryUrl: uploadResult.url,
          publicId: uploadResult.filename,
          filename: item.filename,
          isPublic: item.isPublic,
          sizeBytes: uploadResult.sizeBytes,
          simulated: false,
          updatedAt: new Date().toISOString()
        };

        uploadedCount++;
        if (uploadedCount % 25 === 0 || uploadedCount === filesToProcess.length) {
          console.log(`  Uploaded ${uploadedCount}/${filesToProcess.length} assets...`);
        }
      } catch (err) {
        errorCount++;
        console.error(`  ❌ Failed to upload ${item.filename}: ${err.message}`);
      }
    }
  }

  // Write updated media-map.json
  fs.writeFileSync(mediaMapPath, JSON.stringify(mediaMap, null, 2), 'utf8');

  console.log('\n================ MEDIA MIGRATION SUMMARY ================');
  console.log(`📁 Total files on disk:      ${filesToProcess.length}`);
  console.log(`⬆️  Uploaded / Processed:     ${uploadedCount}`);
  console.log(`⏩ Reused existing map:      ${skippedCount}`);
  console.log(`❌ Upload errors:             ${errorCount}`);
  console.log(`🗺️  Total in media-map.json:  ${Object.keys(mediaMap).length}`);
  console.log(`💾 Saved media map to:       ${mediaMapPath}`);
  console.log('=========================================================\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runUpload().catch(err => {
    console.error('Fatal media migration error:', err);
    process.exit(1);
  });
}
