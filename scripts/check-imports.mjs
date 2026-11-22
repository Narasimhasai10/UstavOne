import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ESLint } from 'eslint';
import reactPlugin from 'eslint-plugin-react';
import globals from 'globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'frontend', 'src');

console.log('🔍 Running comprehensive frontend import & module integrity auditor...');

// Collect all target files
function collectFiles(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', '.test-cache', '__tests__'].includes(entry.name)) continue;
      files = files.concat(collectFiles(full));
    } else if (entry.isFile()) {
      if (/\.(jsx?)$/.test(entry.name) && !entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
        files.push(full);
      }
    }
  }
  return files;
}

const targetFiles = collectFiles(srcDir);
console.log(`Found ${targetFiles.length} source files to audit in frontend/src.`);

let errors = [];

// ==========================================
// 1. CHECK UNRESOLVED IMPORTS
// ==========================================
console.log('\n[1/4] Checking module import resolution...');
const importRegex = /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]|export\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;

const fileImports = new Map(); // file -> Set of resolved imported file paths

for (const file of targetFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(file);
  const imports = new Set();
  fileImports.set(file, imports);

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const specifier = match[1] || match[2] || match[3] || match[4];
    if (!specifier) continue;

    // Check relative or alias imports
    if (specifier.startsWith('.')) {
      const resolved = resolveImport(dir, specifier);
      if (!resolved) {
        errors.push(`[UNRESOLVED IMPORT] In ${path.relative(rootDir, file)}: Cannot resolve "${specifier}"`);
      } else {
        imports.add(resolved);
      }
    } else if (!specifier.startsWith('http') && !isPackageDep(specifier)) {
      // Possible broken non-package import
      errors.push(`[UNKNOWN SPECIFIER] In ${path.relative(rootDir, file)}: Non-package import "${specifier}" not found`);
    }
  }
}

function resolveImport(dir, specifier) {
  const cleanSpec = specifier.split('?')[0].split('#')[0];
  const target = path.resolve(dir, cleanSpec);

  const candidates = [
    target,
    target + '.js',
    target + '.jsx',
    target + '.json',
    target + '.css',
    path.join(target, 'index.js'),
    path.join(target, 'index.jsx')
  ];

  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      return c;
    }
  }
  return null;
}

function isPackageDep(specifier) {
  const base = specifier.startsWith('@') 
    ? specifier.split('/').slice(0, 2).join('/') 
    : specifier.split('/')[0];
  const valid = new Set(['react', 'react-dom', 'socket.io-client', 'lucide-react', 'globals']);
  return valid.has(base);
}

// ==========================================
// 2. CHECK UNDECLARED IDENTIFIERS (ESLINT no-undef & react/jsx-no-undef)
// ==========================================
console.log('[2/4] Checking for undeclared variables/components (no-undef & jsx-no-undef)...');

const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ['**/*.{js,jsx}'],
      plugins: {
        react: reactPlugin
      },
      languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        parserOptions: {
          ecmaFeatures: {
            jsx: true
          }
        },
        globals: {
          ...globals.browser,
          ...globals.es2021,
          React: 'readonly',
          JSX: 'readonly'
        }
      },
      rules: {
        'no-undef': 'error',
        'react/jsx-no-undef': 'error'
      }
    }
  ]
});

const lintResults = await eslint.lintFiles(targetFiles);
for (const res of lintResults) {
  for (const msg of res.messages) {
    if (msg.ruleId === 'no-undef' || msg.ruleId === 'react/jsx-no-undef') {
      errors.push(`[UNDECLARED VARIABLE] ${path.relative(rootDir, res.filePath)}:${msg.line}:${msg.column} - ${msg.message}`);
    }
  }
}

// ==========================================
// 3. CHECK CIRCULAR IMPORTS
// ==========================================
console.log('[3/4] Checking for circular dependencies...');

function detectCycles(graph) {
  const visited = new Set();
  const recursionStack = new Set();
  const cycles = [];

  function dfs(node, path) {
    visited.add(node);
    recursionStack.add(node);

    const neighbors = graph.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path, neighbor]);
      } else if (recursionStack.has(neighbor)) {
        const cycleStartIndex = path.indexOf(neighbor);
        const cycle = path.slice(cycleStartIndex).concat(neighbor);
        cycles.push(cycle);
      }
    }

    recursionStack.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node, [node]);
    }
  }
  return cycles;
}

const cycles = detectCycles(fileImports);
if (cycles.length > 0) {
  for (const cycle of cycles) {
    const formatted = cycle.map(p => path.relative(rootDir, p)).join(' -> ');
    errors.push(`[CIRCULAR IMPORT] ${formatted}`);
  }
}

// ==========================================
// 4. CHECK DUPLICATE MODULE COPIES
// ==========================================
console.log('[4/4] Checking for duplicate module copies under frontend/src...');

const duplicatePairs = [
  { legacy: 'frontend/src/utils', primary: 'frontend/src/shared/utils' },
  { legacy: 'frontend/src/data', primary: 'frontend/src/shared/data' },
  { legacy: 'frontend/src/api', primary: 'frontend/src/shared/api' },
  { legacy: 'frontend/src/offline', primary: 'frontend/src/features/dashboard-plan/offline' },
  { legacy: 'frontend/src/engine', primary: 'frontend/src/features/dashboard-plan/engine' },
  { legacy: 'frontend/src/services', primary: 'frontend/src/shared/services' }
];

for (const pair of duplicatePairs) {
  const legacyDir = path.join(rootDir, pair.legacy);
  const primaryDir = path.join(rootDir, pair.primary);
  if (!fs.existsSync(legacyDir)) continue;

  const entries = fs.readdirSync(legacyDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.js')) {
      const filePath = path.join(legacyDir, entry.name);
      const content = fs.readFileSync(filePath, 'utf8').trim();
      const cleaned = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').trim();
      const isReexport = cleaned.startsWith('export *') || cleaned.startsWith('export {') || cleaned.startsWith('export default');
      if (!isReexport) {
        errors.push(`[DUPLICATE MODULE] ${path.relative(rootDir, filePath)} is a full duplicate of ${pair.primary}/${entry.name}. Must be a thin re-export.`);
      }
    }
  }
}

// ==========================================
// SUMMARY & EXIT
// ==========================================
if (errors.length > 0) {
  console.error(`\n❌ Found ${errors.length} import / module issues:`);
  errors.forEach(e => console.error('  ' + e));
  process.exit(1);
} else {
  console.log('\n✅ All checks passed: 0 unresolved imports, 0 undeclared variables/components, 0 circular imports, 0 duplicate module copies.');
  process.exit(0);
}
