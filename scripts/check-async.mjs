import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const frontendSrc = path.resolve(rootDir, 'frontend/src');

console.log('🔍 Running Async Data-Service Usage & Call-Site Audit...\n');

// 1. Read data-service/index.js and identify all async functions
const dataServicePath = path.resolve(frontendSrc, 'data-service/index.js');
const dataServiceContent = fs.readFileSync(dataServicePath, 'utf8');

// Identify all exported named functions and domain functions
const asyncFunctions = new Set([
  'authenticateUser',
  'authenticateVendor',
  'userLogin',
  'vendorLogin',
  'createVendorAccount',
  'vendorSignup',
  'userSignup',
  'isPhoneTaken',
  'isUsernameTaken',
  'updateUserProfile',
  'changeUserPassword',
  'changeVendorPassword',
  'getLocations',
  'calculatePlan',
  'saveUserPlan',
  'getSavedPlan',
  'getUnifiedVendorsCatalog',
  'getVendorById',
  'getAvailability',
  'getReviews',
  'getUserBookings',
  'saveUserBooking',
  'cancelUserBooking',
  'cancelBooking',
  'createOrder',
  'confirmPayment',
  'getChatMessages',
  'addChatMessage',
  'addVoiceCallLog',
  'getActiveChatVendorIds',
  'getVendorChatThreads',
  'addVendorChatMessage',
  'getVendorBranches',
  'saveVendorBranch',
  'deleteVendorBranch',
  'getVendorPreviousWorks',
  'saveVendorPreviousWork',
  'deleteVendorPreviousWork',
  'getVendorBookings',
  'cancelVendorBooking',
  'markBookingCompleted',
  'confirmVendorBooking',
  'getRevenueSummary',
  'getRevenueSeries',
  'updateVendorProfile',
  'addVendorWarning',
  'verifyDocument',
  'createReview',
  'detectMode'
]);

console.log(`Auditing calls for ${asyncFunctions.size} async data-service operations...\n`);

let unawaitedErrors = [];

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();

    // Skip comment lines and import/export declarations
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;
    if (trimmed.startsWith('import ') || trimmed.startsWith('export ')) return;

    for (const fn of asyncFunctions) {
      // Check for function invocation: fn(...) or dataService.domain.fn(...)
      const callPattern = new RegExp(`\\b${fn}\\s*\\(`, 'g');
      if (callPattern.test(trimmed)) {
        // Check if awaited, used with .then, inside Promise, or returned from async function
        const hasAwait = new RegExp(`\\bawait\\s+.*${fn}\\s*\\(`).test(trimmed) || trimmed.includes(`await ${fn}`) || trimmed.includes(`await(${fn}`);
        const hasThen = trimmed.includes(`${fn}(`) && (trimmed.includes('.then(') || trimmed.includes('.catch('));
        const hasPromiseWrap = trimmed.includes(`Promise.`) || trimmed.includes(`return ${fn}(`);

        // Check if inside Promise.all / Promise.allSettled in current or nearby lines
        const surroundingLines = lines.slice(Math.max(0, index - 5), Math.min(lines.length, index + 5)).map(l => l.trim()).join(' ');
        const isInsidePromiseAll = (surroundingLines.includes('Promise.all') || surroundingLines.includes('Promise.allSettled')) &&
                                  (surroundingLines.includes('await Promise.all') || surroundingLines.includes('.then('));

        if (!hasAwait && !hasThen && !hasPromiseWrap && !isInsidePromiseAll) {
          // Check if previous or next line has await/then in case of multi-line expression
          const prevLine = index > 0 ? lines[index - 1].trim() : '';
          const nextLine = index < lines.length - 1 ? lines[index + 1].trim() : '';
          if (prevLine.startsWith('await ') || nextLine.startsWith('.then(') || nextLine.startsWith('.catch(')) {
            continue;
          }

          unawaitedErrors.push({
            file: path.relative(rootDir, filePath),
            line: lineNum,
            fn,
            code: trimmed
          });
        }
      }
    }
  });
}

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.test-cache' && entry.name !== 'dist' && entry.name !== 'build') {
        scanDir(full);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.jsx') || entry.name === 'App.jsx')) {
      if (!entry.name.includes('.test.')) {
        checkFile(full);
      }
    }
  }
}

scanDir(frontendSrc);

if (unawaitedErrors.length > 0) {
  console.error(`❌ Found ${unawaitedErrors.length} un-awaited async data-service call(s):\n`);
  unawaitedErrors.forEach(err => {
    console.error(`  - ${err.file}:${err.line} -> "${err.fn}()"`);
    console.error(`    Code: ${err.code}\n`);
  });
  process.exit(1);
} else {
  console.log('✅ All data-service calls in frontend components are properly awaited or chained with .then().\n');
  process.exit(0);
}
