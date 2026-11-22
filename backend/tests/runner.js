import { spawnSync, execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(__dirname, '../..');
const testDbPath = path.resolve(rootDir, 'database/test.db').replace(/\\/g, '/');
const schemaPath = path.resolve(rootDir, 'database/schema.prisma');

console.log('🧪 Starting Backend Test Suite in Isolated Database Mode...');
console.log(`  - Target test database: ${testDbPath}`);

// 1. Clean up any previous test.db and journals
for (const p of [testDbPath, `${testDbPath}-journal`]) {
  if (fs.existsSync(p)) {
    try { fs.unlinkSync(p); } catch {}
  }
}

const testEnv = {
  ...process.env,
  DATABASE_URL: `file:${testDbPath}`,
  NODE_ENV: 'test'
};

try {
  // 2. Push schema to test.db
  console.log('  - Deploying fresh schema to test.db...');
  execSync(`npx prisma db push --schema "${schemaPath}" --accept-data-loss --skip-generate`, {
    cwd: backendDir,
    env: testEnv,
    stdio: 'pipe'
  });

  // 3. Seed test.db with required test data
  console.log('  - Seeding test.db fixtures...');
  const { PrismaClient } = await import('@prisma/client');
  const testPrisma = new PrismaClient({
    datasources: {
      db: { url: `file:${testDbPath}` }
    }
  });

  const { seedDatabase } = await import('../../database/seed.js');
  await seedDatabase(testPrisma);
  await testPrisma.$disconnect();

  // 4. Run tests targeting test.db
  console.log('  - Executing test runner...\n');
  const testProc = spawnSync('node', ['--test', 'tests/**/*.test.js'], {
    cwd: backendDir,
    env: testEnv,
    stdio: 'inherit'
  });

  // 5. Clean up test.db
  console.log('\n🧹 Cleaning up isolated test database...');
  for (const p of [testDbPath, `${testDbPath}-journal`]) {
    if (fs.existsSync(p)) {
      try { fs.unlinkSync(p); } catch {}
    }
  }

  process.exit(testProc.status || 0);
} catch (err) {
  console.error('❌ Test isolation error:', err);
  // Attempt cleanup on failure
  for (const p of [testDbPath, `${testDbPath}-journal`]) {
    if (fs.existsSync(p)) {
      try { fs.unlinkSync(p); } catch {}
    }
  }
  process.exit(1);
}
