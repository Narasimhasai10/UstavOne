#!/usr/bin/env node
/**
 * VEDIKA Export Script
 * 
 * Creates a clean VEDIKA-export.zip archive of the entire project
 * excluding node_modules, .git, .env, dist, backups, and backend/uploads.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outputFile = path.join(rootDir, 'VEDIKA-export.zip');

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'backups',
  'uploads',
  '.test-cache',
  'coverage'
]);

function shouldExclude(relPath, isDir) {
  const norm = relPath.replace(/\\/g, '/');
  const parts = norm.split('/');

  // Check excluded directory names
  for (const part of parts) {
    if (EXCLUDED_DIRS.has(part)) {
      return true;
    }
  }

  // Check specific path rules
  if (norm === 'VEDIKA-export.zip') return true;
  if (norm.endsWith('.db') || norm.endsWith('.db-journal')) return true;

  // Exclude .env files but preserve .env.example
  const fileName = parts[parts.length - 1];
  if (fileName.startsWith('.env') && !fileName.endsWith('.example')) {
    return true;
  }

  return false;
}

function collectFiles(dir, baseDir = dir) {
  const entries = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    const relPath = path.relative(baseDir, fullPath);

    if (item.isDirectory()) {
      if (!shouldExclude(relPath, true)) {
        entries.push(...collectFiles(fullPath, baseDir));
      }
    } else if (item.isFile()) {
      if (!shouldExclude(relPath, false)) {
        entries.push({
          fullPath,
          relPath: relPath.replace(/\\/g, '/')
        });
      }
    }
  }

  return entries;
}

function buildZip(files) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;
  let totalUncompressed = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.relPath, 'utf8');
    const content = fs.readFileSync(file.fullPath);
    const uncompressedSize = content.length;
    totalUncompressed += uncompressedSize;

    const crc = zlib.crc32(content);
    const compressed = zlib.deflateRawSync(content);
    const compressedSize = compressed.length;

    // Local Header
    const lh = Buffer.alloc(30 + nameBuf.length);
    lh.writeUInt32LE(0x04034b50, 0); // signature
    lh.writeUInt16LE(20, 4); // version needed (2.0)
    lh.writeUInt16LE(0, 6); // general purpose bit flag
    lh.writeUInt16LE(8, 8); // compression method (8 = deflate)
    lh.writeUInt16LE(0, 10); // file last mod time
    lh.writeUInt16LE(0, 12); // file last mod date
    lh.writeUInt32LE(crc, 14); // crc-32
    lh.writeUInt32LE(compressedSize, 18); // compressed size
    lh.writeUInt32LE(uncompressedSize, 22); // uncompressed size
    lh.writeUInt16LE(nameBuf.length, 26); // file name length
    lh.writeUInt16LE(0, 28); // extra field length
    nameBuf.copy(lh, 30);

    // Central Directory Header
    const ch = Buffer.alloc(46 + nameBuf.length);
    ch.writeUInt32LE(0x02014b50, 0); // signature
    ch.writeUInt16LE(20, 4); // version made by
    ch.writeUInt16LE(20, 6); // version needed to extract
    ch.writeUInt16LE(0, 8); // flags
    ch.writeUInt16LE(8, 10); // compression method
    ch.writeUInt16LE(0, 12); // mod time
    ch.writeUInt16LE(0, 14); // mod date
    ch.writeUInt32LE(crc, 16); // crc-32
    ch.writeUInt32LE(compressedSize, 20); // compressed size
    ch.writeUInt32LE(uncompressedSize, 24); // uncompressed size
    ch.writeUInt16LE(nameBuf.length, 28); // file name length
    ch.writeUInt16LE(0, 30); // extra field length
    ch.writeUInt16LE(0, 32); // file comment length
    ch.writeUInt16LE(0, 34); // disk number start
    ch.writeUInt16LE(0, 36); // internal file attributes
    ch.writeUInt32LE(0, 38); // external file attributes
    ch.writeUInt32LE(offset, 42); // relative offset of local header
    nameBuf.copy(ch, 46);

    localHeaders.push(lh, compressed);
    centralHeaders.push(ch);
    offset += lh.length + compressed.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const ch of centralHeaders) centralDirSize += ch.length;

  // End of Central Directory Record
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // start disk
  eocd.writeUInt16LE(files.length, 8); // total entries on disk
  eocd.writeUInt16LE(files.length, 10); // total entries
  eocd.writeUInt32LE(centralDirSize, 12); // central directory size
  eocd.writeUInt32LE(centralDirOffset, 16); // offset of central directory
  eocd.writeUInt16LE(0, 20); // comment length

  return {
    buffer: Buffer.concat([...localHeaders, ...centralHeaders, eocd]),
    totalUncompressed
  };
}

console.log('📦 Scanning project files for clean export...');
const files = collectFiles(rootDir);
console.log(`  Found ${files.length} clean source and asset files.`);

console.log('📦 Creating VEDIKA-export.zip...');
const { buffer: zipBuffer, totalUncompressed } = buildZip(files);
fs.writeFileSync(outputFile, zipBuffer);

const uncompMB = (totalUncompressed / (1024 * 1024)).toFixed(2);
const compMB = (zipBuffer.length / (1024 * 1024)).toFixed(2);
console.log(`✅ Export complete: ${outputFile}`);
console.log(`   Files: ${files.length}`);
console.log(`   Uncompressed: ${uncompMB} MB -> Compressed: ${compMB} MB`);
