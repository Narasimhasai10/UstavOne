#!/usr/bin/env node
/**
 * Utsavora Smoke Test Suite
 * Validates key user workflows and endpoints against a live or local deployment.
 * Usage: node scripts/smoke.mjs [baseUrl]
 * Example: node scripts/smoke.mjs http://localhost:4000
 */

const baseUrl = (process.argv[2] || process.env.APP_URL || 'http://localhost:4000').replace(/\/+$/, '');

console.log(`\n========================================`);
console.log(`🔥 Utsavora Deployment Smoke Test`);
console.log(`🌐 Target: ${baseUrl}`);
console.log(`========================================\n`);

let passed = 0;
let failed = 0;

async function runCheck(name, fn) {
  process.stdout.write(`• Checking ${name}... `);
  try {
    await fn();
    console.log('✅ PASS');
    passed++;
  } catch (err) {
    console.log(`❌ FAIL: ${err.message}`);
    failed++;
  }
}

async function main() {
  let customerToken = null;
  let vendorToken = null;

  // 1. Health check
  await runCheck('Service Health (/health)', async () => {
    const res = await fetch(`${baseUrl}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'healthy' && data.status !== 'ok') {
      throw new Error(`Unexpected health status: ${JSON.stringify(data)}`);
    }
    if (data.db !== 'ok' && data.database !== 'connected') {
      throw new Error(`Database reporting issue: ${data.db || data.database}`);
    }
  });

  // 2. Public Locations endpoint
  await runCheck('Public Locations (/api/v1/locations)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/locations`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.items || !Array.isArray(data.items)) {
      throw new Error('Locations response missing items array');
    }
    const hasKadapa = data.items.some(c => c.city && c.city.toLowerCase() === 'kadapa');
    if (!hasKadapa) {
      throw new Error('Locations missing Kadapa');
    }
  });

  // 3. Customer Login (9390075877 / sai@1398)
  await runCheck('Customer Login (9390075877)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/user/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9390075877', password: 'sai@1398' })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`HTTP ${res.status}: ${err.error?.message || res.statusText}`);
    }
    const data = await res.json();
    if (!data.accessToken) throw new Error('Missing accessToken in response');
    customerToken = data.accessToken;
  });

  // 4. Smart Planner Calculation (Worked Example: Kadapa 600 guests)
  await runCheck('Smart Planner Engine (/api/v1/planner/calculate)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/planner/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'wedding',
        budget: 800000,
        guests: 600,
        city: 'Kadapa',
        services: 'both'
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`HTTP ${res.status}: ${err.error?.message || res.statusText}`);
    }
    const data = await res.json();
    if (!data.data || !data.data.breakdown) {
      throw new Error('Planner response missing breakdown');
    }
  });

  // 5. Vendor Login (sai_halls / Vedika@123)
  await runCheck('Vendor Login (sai_halls)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/vendor/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'sai_halls', password: 'Vedika@123' })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`HTTP ${res.status}: ${err.error?.message || res.statusText}`);
    }
    const data = await res.json();
    if (!data.accessToken) throw new Error('Missing vendor accessToken');
    vendorToken = data.accessToken;
  });

  // 6. Vendor Branches in Catalog
  await runCheck('Public Vendor Browse (/api/v1/vendors)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/vendors?city=Kadapa`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = data.items || data.data || [];
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('No branches returned for Kadapa');
    }
  });

  // 7. Photo / Asset Availability
  await runCheck('Photo & Asset Serving', async () => {
    const res = await fetch(`${baseUrl}/api/v1/vendors/branch-sai-hall-1`);
    if (res.ok) {
      const data = await res.json();
      const branch = data.data || data;
      if (branch.coverPhotoUrl) {
        if (branch.coverPhotoUrl.startsWith('data:')) {
          // Inline data URI is valid
          return;
        }
        const imgRes = await fetch(branch.coverPhotoUrl.startsWith('http') ? branch.coverPhotoUrl : `${baseUrl}${branch.coverPhotoUrl}`);
        if (!imgRes.ok && imgRes.status !== 304) {
          throw new Error(`Asset returned HTTP ${imgRes.status}`);
        }
      }
    }
  });

  // 8. Socket.IO Handshake
  await runCheck('Socket.IO Gateway Connection', async () => {
    const res = await fetch(`${baseUrl}/socket.io/?EIO=4&transport=polling`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text.includes('sid')) {
      throw new Error('Socket.IO handshake did not return sid session identifier');
    }
  });

  console.log(`\n----------------------------------------`);
  console.log(`Summary: ${passed} passed, ${failed} failed`);
  console.log(`----------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Smoke suite unexpected error:', err);
  process.exit(1);
});
