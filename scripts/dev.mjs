import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🚀 Starting Utsavora Full-Stack Development Environment...');
console.log('  - Backend API: http://localhost:4000 (Swagger docs at /docs)');
console.log('  - Frontend UI: http://localhost:5173\n');

const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const backend = spawn('node', ['src/server.js'], {
  cwd: path.resolve(rootDir, 'backend'),
  stdio: 'inherit',
  shell: true
});

const frontend = spawn(npxCmd, ['vite', 'frontend', '--host', '0.0.0.0', '--port', '5173'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true
});

const cleanup = () => {
  console.log('\n🛑 Shutting down dev servers...');
  try { backend.kill(); } catch {}
  try { frontend.kill(); } catch {}
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
