import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const sourcePath = path.resolve(rootDir, 'database/seed-data/planner-config.json');
const targetDir = path.resolve(rootDir, 'frontend/src/offline/generated');
const targetPath = path.resolve(targetDir, 'planner-config.json');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

if (fs.existsSync(sourcePath)) {
  fs.copyFileSync(sourcePath, targetPath);
  console.log('✓ [sync-planner-config] Copied planner-config.json to frontend/src/offline/generated/');
} else {
  console.error('❌ [sync-planner-config] Source file not found:', sourcePath);
  process.exit(1);
}
