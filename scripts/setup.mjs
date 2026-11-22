import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🚀 Setting up Utsavora Workspace...\n');

// 1. Install root dependencies if needed
console.log('-> 1. Installing root workspace dependencies...');
try {
  execSync('npm.cmd install', { cwd: rootDir, stdio: 'inherit' });
} catch (e) {
  console.warn('Root install completed or skipped');
}

// 2. Install backend dependencies
console.log('-> 2. Installing backend dependencies...');
try {
  execSync('npm.cmd install', { cwd: path.resolve(rootDir, 'backend'), stdio: 'inherit' });
} catch (e) {
  console.warn('Backend install completed');
}

// 3. Install frontend dependencies
console.log('-> 3. Installing frontend dependencies...');
try {
  execSync('npm.cmd install', { cwd: path.resolve(rootDir, 'frontend'), stdio: 'inherit' });
} catch (e) {
  console.warn('Frontend install completed');
}

// 4. Reset & seed database
console.log('-> 4. Initializing database and running seeds...');
execSync('node scripts/db-reset.mjs', { cwd: rootDir, stdio: 'inherit' });

// 5. Build standalone single-file index.html
console.log('-> 5. Building frontend and standalone single-file index.html...');
execSync('npm.cmd run build:standalone', { cwd: rootDir, stdio: 'inherit' });

console.log('\n🎉 Setup complete! You can now run:');
console.log('   npm run dev       -> Run backend (4000) and frontend (5173)');
console.log('   npm start         -> Run backend serving full app and API at 4000');
console.log('   or double-click index.html to run 100% offline.\n');
