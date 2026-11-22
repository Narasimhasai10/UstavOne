import { EventEmitter } from 'node:events';
import app from '../backend/src/app.js';
import { prisma } from '../backend/src/utils/prisma.js';
import * as store from '../frontend/src/services/store.js';

function callApi(method, path, body = {}, token = null) {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter();
    req.method = method.toUpperCase();
    req.url = `/api/v1${path}`;
    req.originalUrl = `/api/v1${path}`;
    req.headers = {
      'content-type': 'application/json'
    };
    if (token) req.headers['authorization'] = `Bearer ${token}`;
    req.body = body;
    req.socket = { remoteAddress: '127.0.0.1' };
    req.connection = req.socket;

    let statusCode = 200;
    const resHeaders = {};
    let responseBody = null;

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      setHeader(name, val) {
        resHeaders[name.toLowerCase()] = val;
        return this;
      },
      getHeader(name) {
        return resHeaders[name.toLowerCase()];
      },
      removeHeader(name) {
        delete resHeaders[name.toLowerCase()];
      },
      hasHeader(name) {
        return Object.prototype.hasOwnProperty.call(resHeaders, name.toLowerCase());
      },
      getHeaderNames() {
        return Object.keys(resHeaders);
      },
      json(data) {
        responseBody = data;
        resolve({ status: statusCode, ok: statusCode >= 200 && statusCode < 300, body: data });
      },
      send(data) {
        try {
          responseBody = JSON.parse(data);
        } catch {
          responseBody = data;
        }
        resolve({ status: statusCode, ok: statusCode >= 200 && statusCode < 300, body: responseBody });
      },
      end(data) {
        if (data) this.send(data);
        else resolve({ status: statusCode, ok: statusCode >= 200 && statusCode < 300, body: responseBody });
      }
    };

    app.handle(req, res, (err) => {
      if (err) reject(err);
    });
  });
}

async function verifyAll() {
  console.log('🧪 Running Customer Replacement Verification Suite...\n');

  let passed = true;

  // 1. Verify Database has exactly 3 customer users
  console.log('1. Database Role Verification:');
  const customerUsers = await prisma.user.findMany({
    where: { role: 'user' },
    select: { id: true, name: true, phone: true, email: true, city: true, role: true }
  });
  console.log(`   - Found ${customerUsers.length} user(s) with role "user"`);
  for (const u of customerUsers) {
    console.log(`     * ${u.name} | ${u.phone} | ${u.email} | ${u.city}`);
  }
  if (customerUsers.length === 3) {
    console.log('   ✓ [PASS] Exactly 3 users with role "user" exist in the backend database.');
  } else {
    console.error(`   ✗ [FAIL] Expected exactly 3 customer users, found ${customerUsers.length}`);
    passed = false;
  }

  // 2. Verify Backend Customer Login for all 3 customers
  console.log('\n2. Backend Customer Login Tests:');
  const customers = [
    { name: 'D L Narasimha sai', phone: '9390075877', password: 'sai@1398', email: 'narasimhasai1012@gmail.com' },
    { name: 'K V Chanikya', phone: '6305729847', password: 'chani@850218', email: 'chanikyakv@gmail.com' },
    { name: 'B Sriram', phone: '9963773539', password: 'Kumar@138', email: 'sriramboddu@gmail.com' }
  ];

  for (const c of customers) {
    const res = await callApi('POST', '/auth/user/login', { phone: c.phone, password: c.password });
    const payload = res.body?.data || res.body;
    if (res.status === 200 && payload?.accessToken && payload?.user?.phone === c.phone) {
      console.log(`   ✓ [PASS] Backend login succeeded for ${c.name} (${c.phone}): 200 OK, token issued, email=${payload.user.email}`);
    } else {
      console.error(`   ✗ [FAIL] Backend login failed for ${c.name} (${c.phone}): status=${res.status}, body=${JSON.stringify(res.body)}`);
      passed = false;
    }

    // Wrong password test
    const wrongRes = await callApi('POST', '/auth/user/login', { phone: c.phone, password: 'WrongPassword999!' });
    if (wrongRes.status === 401) {
      console.log(`   ✓ [PASS] Backend wrong password rejected for ${c.phone}: 401 Unauthorized`);
    } else {
      console.error(`   ✗ [FAIL] Expected 401 for wrong password, got status=${wrongRes.status}`);
      passed = false;
    }
  }

  // 3. Verify Frontend Offline Store for all 3 customers
  console.log('\n3. Frontend Offline Store (authenticateUser) Tests:');
  store.seedTestAccount();

  for (const c of customers) {
    const authRes = await store.authenticateUser(c.phone, c.password);
    if (authRes.success && authRes.user?.phone === c.phone && authRes.user?.email === c.email) {
      console.log(`   ✓ [PASS] Frontend authenticateUser succeeded for ${c.name} (${c.phone})`);
    } else {
      console.error(`   ✗ [FAIL] Frontend authenticateUser failed for ${c.name}: ${JSON.stringify(authRes)}`);
      passed = false;
    }

    const failRes = await store.authenticateUser(c.phone, 'WrongPassword999');
    if (!failRes.success) {
      console.log(`   ✓ [PASS] Frontend wrong password rejected for ${c.phone}: success=false (${failRes.error})`);
    } else {
      console.error(`   ✗ [FAIL] Frontend wrong password unexpectedly succeeded for ${c.phone}`);
      passed = false;
    }
  }

  // 4. Vendor Login Tests (sai_halls / Vedika@123)
  console.log('\n4. Vendor Login Tests (sai_halls / Vedika@123):');
  // Backend vendor login
  const vendorBackendRes = await callApi('POST', '/auth/vendor/login', { identifier: 'sai_halls', password: 'Vedika@123' });
  const vendorPayload = vendorBackendRes.body?.data || vendorBackendRes.body;
  if (vendorBackendRes.status === 200 && vendorPayload?.accessToken) {
    console.log(`   ✓ [PASS] Backend vendor login succeeded (sai_halls): 200 OK, token issued`);
  } else {
    console.error(`   ✗ [FAIL] Backend vendor login failed: status=${vendorBackendRes.status}, body=${JSON.stringify(vendorBackendRes.body)}`);
    passed = false;
  }

  // Frontend vendor login
  const vendorFrontendRes = await store.authenticateVendor('sai_halls', 'Vedika@123');
  if (vendorFrontendRes.success && vendorFrontendRes.vendor?.username === 'sai_halls') {
    console.log(`   ✓ [PASS] Frontend vendor login succeeded (sai_halls): success=true`);
  } else {
    console.error(`   ✗ [FAIL] Frontend vendor login failed: ${JSON.stringify(vendorFrontendRes)}`);
    passed = false;
  }

  if (!passed) {
    console.error('\n❌ Verification checks FAILED.');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL Customer Replacement Verification Checks PASSED SUCCESFULLY!\n');
    process.exit(0);
  }
}

verifyAll()
  .catch(err => {
    console.error('Fatal error during verification:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
