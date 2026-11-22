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
const prodDbPath = path.resolve(rootDir, 'database/utsavora.db').replace(/\\/g, '/');

console.log('🧪 Starting Backend Test Suite in Isolated Database Mode...');
console.log(`  - Target test database: ${testDbPath}`);

// Safety Guard: verify testDbPath is strictly test.db and not production utsavora.db
const resolvedDbFile = path.basename(testDbPath).toLowerCase();
if (resolvedDbFile !== 'test.db') {
  console.error(`❌ [SAFETY GUARD] Refusing to run tests: test database must be named "test.db", got: "${resolvedDbFile}"`);
  process.exit(1);
}
if (path.resolve(testDbPath).toLowerCase() === path.resolve(prodDbPath).toLowerCase()) {
  console.error(`❌ [SAFETY GUARD] Refusing to run tests: test database matches production database (${prodDbPath})`);
  process.exit(1);
}

// Ensure process.env has test variables set for current process and child processes
process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.TEST_DB = testDbPath;
process.env.NODE_ENV = 'test';

// 1. Clean up any previous test.db and journals
for (const p of [testDbPath, `${testDbPath}-journal`, `${testDbPath}-wal`, `${testDbPath}-shm`]) {
  if (fs.existsSync(p)) {
    try { fs.unlinkSync(p); } catch {}
  }
}

const testEnv = {
  ...process.env,
  DATABASE_URL: `file:${testDbPath}`,
  TEST_DB: testDbPath,
  NODE_ENV: 'test'
};

function findTestFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findTestFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

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
  await seedDatabase(testPrisma, { allowDestructive: true });
  await testPrisma.$disconnect();

  // 4. Run tests targeting test.db with explicit file list
  const testFiles = findTestFiles(path.join(backendDir, 'tests')).map(f => path.relative(backendDir, f));
  console.log(`  - Executing test runner with ${testFiles.length} test files...\n`);
  const testProc = spawnSync(process.execPath, ['--test', ...testFiles], {
    cwd: backendDir,
    env: testEnv,
    stdio: 'inherit'
  });

  // 5. Clean up test.db
  console.log('\n🧹 Cleaning up isolated test database...');
  for (const p of [testDbPath, `${testDbPath}-journal`, `${testDbPath}-wal`, `${testDbPath}-shm`]) {
    if (fs.existsSync(p)) {
      try { fs.unlinkSync(p); } catch {}
    }
  }

  process.exit(testProc.status || 0);
} catch (err) {
  console.error('❌ Test isolation error:', err);
  // Attempt cleanup on failure
  for (const p of [testDbPath, `${testDbPath}-journal`, `${testDbPath}-wal`, `${testDbPath}-shm`]) {
    if (fs.existsSync(p)) {
      try { fs.unlinkSync(p); } catch {}
    }
  }
  process.exit(1);
}
