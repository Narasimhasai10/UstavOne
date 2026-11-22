import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🔍 Running Utsavora Workspace Integrity & Hygiene Audit...\n');
let failed = false;

function fail(msg) {
  console.error(`❌ [FAIL] ${msg}`);
  failed = true;
}

function pass(msg) {
  console.log(`✓ [PASS] ${msg}`);
}

// 1. Check for stray .html files in root (only index.html permitted)
const rootFiles = fs.readdirSync(rootDir);
const htmlFiles = rootFiles.filter(f => f.endsWith('.html') && f !== 'index.html');
if (htmlFiles.length > 0) {
  fail(`Found stray .html files in root: ${htmlFiles.join(', ')}`);
} else {
  pass('No stray .html files in root (only generated index.html exists).');
}

// 2. Check for duplicate/stale CSS files
if (fs.existsSync(path.resolve(rootDir, 'css/style.css')) || fs.existsSync(path.resolve(rootDir, 'style.css'))) {
  fail('Found duplicate/stale css/style.css stylesheet. Styles must reside in frontend/src/index.css.');
} else {
  pass('No duplicate CSS files.');
}

// 3. Check that LoginPage.jsx is removed
if (fs.existsSync(path.resolve(rootDir, 'frontend/src/components/LoginPage.jsx'))) {
  fail('Found unused frontend/src/components/LoginPage.jsx.');
} else {
  pass('Unused LoginPage.jsx has been removed.');
}

// 4. Check that backend/prisma was properly moved to database/
if (fs.existsSync(path.resolve(rootDir, 'backend/prisma'))) {
  fail('backend/prisma directory still exists; must be moved to database/');
} else {
  pass('backend/prisma moved cleanly to database/');
}

// 5. Check database files exist
if (!fs.existsSync(path.resolve(rootDir, 'database/schema.prisma'))) {
  fail('database/schema.prisma not found.');
} else {
  pass('database/schema.prisma exists.');
}

// 6. Check git index for committed node_modules, dist, .env, or .db files
try {
  const tracked = execSync('git ls-files', { cwd: rootDir, encoding: 'utf-8' });
  const forbiddenTracked = tracked
    .split('\n')
    .map(s => s.trim())
    .filter(f => {
      if (!f) return false;
      if (f.endsWith('.example')) return false; // .env.example allowed
      return (
        f.includes('node_modules/') ||
        f.startsWith('dist/') ||
        f.endsWith('.env') ||
        f.endsWith('.db') ||
        f.endsWith('.db-journal')
      );
    });

  if (forbiddenTracked.length > 0) {
    fail(`Found forbidden tracked files in git index: ${forbiddenTracked.join(', ')}`);
  } else {
    pass('Git index is clean: zero node_modules, dist, .env, or .db files tracked.');
  }
} catch (err) {
  console.warn('⚠️ Git check skipped or error:', err.message);
}

// 7. Verify generated root index.html integrity
const indexHtmlPath = path.resolve(rootDir, 'index.html');
if (!fs.existsSync(indexHtmlPath)) {
  fail('Root index.html does not exist. Run "npm run build:standalone".');
} else {
  const content = fs.readFileSync(indexHtmlPath, 'utf-8');
  const firstLine = content.split('\n')[0].trim();

  if (!firstLine.includes('GENERATED – do not edit. Run npm run build:standalone.')) {
    fail('Root index.html first line must be "<!-- GENERATED – do not edit. Run npm run build:standalone. -->"');
  } else {
    pass('Root index.html has exact required generated header comment.');
  }

  const headAndTags = content.slice(0, content.indexOf('<script>') > -1 ? content.indexOf('<script>') : 2000);

  if (headAndTags.includes('type="module"')) {
    fail('Root index.html must not contain type="module" (must be classic inline script for file://).');
  } else {
    pass('Root index.html contains no type="module" tags.');
  }

  if (/<(link|script|img)\s+[^>]*\bcrossorigin\b/i.test(content)) {
    fail('Root index.html must not contain crossorigin attribute on HTML tags.');
  } else {
    pass('Root index.html contains no crossorigin attributes on HTML tags.');
  }

  if (content.includes('src="./assets"') || content.includes('src="/')) {
    fail('Root index.html contains external src="./assets" or absolute root paths.');
  } else {
    pass('Root index.html contains zero external asset references or absolute paths.');
  }

  if (!content.includes('<div id="root"></div>')) {
    fail('Root index.html must contain <div id="root"></div>.');
  } else {
    pass('Root index.html contains root mount container.');
  }
}

// 8. Verify async call-sites
try {
  execSync('node scripts/check-async.mjs', { cwd: rootDir, stdio: 'inherit' });
  pass('All component data-service calls are properly awaited.');
} catch (err) {
  fail('Async data-service usage audit failed.');
}

// 9. Verify imports, declarations, circular deps & duplicate modules
try {
  execSync('node scripts/check-imports.mjs', { cwd: rootDir, stdio: 'inherit' });
  pass('All frontend imports, declarations, dependencies and module copies are clean.');
} catch (err) {
  fail('Frontend import and module integrity audit failed.');
}

if (failed) {
  console.error('\n❌ Workspace check FAILED. Please resolve errors above.\n');
  process.exit(1);
} else {
  console.log('\n✅ All workspace hygiene and integrity checks PASSED.\n');
  process.exit(0);
}
