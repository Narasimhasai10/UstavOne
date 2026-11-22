import fs from 'fs';
import path from 'path';

console.log('🚀 Converting legacy duplicate modules to thin re-exports...');

// 1. frontend/src/api/
fs.writeFileSync('frontend/src/api/client.js', `export * from '../shared/api/client.js';\nexport { default } from '../shared/api/client.js';\n`);
fs.writeFileSync('frontend/src/api/mock.js', `export * from '../shared/api/mock.js';\nexport { default } from '../shared/api/mock.js';\n`);
console.log('✓ frontend/src/api re-exports updated');

// 2. frontend/src/utils/
const utils = [
  'contactGuard.js',
  'contrastUtils.js',
  'cryptoUtils.js',
  'locationService.js',
  'photos.js',
  'qrCode.js',
  'verify.js'
];
for (const u of utils) {
  fs.writeFileSync(`frontend/src/utils/${u}`, `export * from '../shared/utils/${u}';\nexport { default } from '../shared/utils/${u}';\n`);
}
console.log('✓ frontend/src/utils re-exports updated');

// 3. frontend/src/data/events.js
fs.writeFileSync('frontend/src/data/events.js', `export * from '../shared/data/events.js';\nexport { default } from '../shared/data/events.js';\n`);
console.log('✓ frontend/src/data/events.js re-export updated');

// 4. frontend/src/offline/
fs.writeFileSync('frontend/src/offline/budgetEngine.js', `export * from '../features/dashboard-plan/offline/budgetEngine.js';\nexport { default } from '../features/dashboard-plan/offline/budgetEngine.js';\n`);
fs.writeFileSync('frontend/src/offline/planner.js', `export * from '../features/dashboard-plan/offline/planner.js';\nexport { default } from '../features/dashboard-plan/offline/planner.js';\n`);
console.log('✓ frontend/src/offline re-exports updated');

// 5. frontend/src/engine/
fs.writeFileSync('frontend/src/engine/config.js', `export * from '../features/dashboard-plan/engine/config.js';\nexport { default } from '../features/dashboard-plan/engine/config.js';\n`);
console.log('✓ frontend/src/engine re-exports updated');

// 6. frontend/src/services/
fs.writeFileSync('frontend/src/services/kadapaOfflineData.js', `export * from '../features/vendor/kadapaOfflineData.js';\nexport { default } from '../features/vendor/kadapaOfflineData.js';\n`);
fs.writeFileSync('frontend/src/services/rajahmundryOfflineData.js', `export * from '../features/vendor/rajahmundryOfflineData.js';\nexport { default } from '../features/vendor/rajahmundryOfflineData.js';\n`);
console.log('✓ frontend/src/services re-exports updated');

console.log('✅ All legacy module copies are now clean thin re-exports.');
