import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256 } from '../../shared/utils/cryptoUtils.js';
import { TEST_ACCOUNT, TEST_USERS, authenticateUser, seedTestAccount } from './authService.js';

test('Dev Test Account: SHA-256 password hash matches sai@1398', async () => {
  const hash = await sha256('sai@1398');
  assert.equal(hash, TEST_ACCOUNT.passwordHash, 'Hash of sai@1398 must match seed passwordHash');
  assert.equal(TEST_ACCOUNT.phone, '9390075877');
  assert.equal(TEST_ACCOUNT.city, 'Kadapa');
  assert.equal(TEST_ACCOUNT.email, 'narasimhasai1012@gmail.com');
});

test('Customer Authentication: All 3 customer accounts log in successfully with their passwords', async () => {
  seedTestAccount();

  const customerCredentials = [
    {
      phone: '9390075877',
      password: 'sai@1398',
      expectedName: 'D L Narasimha sai',
      expectedEmail: 'narasimhasai1012@gmail.com',
      expectedCity: 'Kadapa'
    },
    {
      phone: '6305729847',
      password: 'chani@850218',
      expectedName: 'K V Chanikya',
      expectedEmail: 'chanikyakv@gmail.com',
      expectedCity: 'Rajahmundry'
    },
    {
      phone: '9963773539',
      password: 'Kumar@138',
      expectedName: 'B Sriram',
      expectedEmail: 'sriramboddu@gmail.com',
      expectedCity: 'Rajahmundry'
    }
  ];

  for (const cred of customerCredentials) {
    // Valid password
    const res = await authenticateUser(cred.phone, cred.password);
    assert.ok(res.success, `Login must succeed for ${cred.expectedName} (${cred.phone})`);
    assert.equal(res.user.phone, cred.phone);
    assert.equal(res.user.name, cred.expectedName);
    assert.equal(res.user.email, cred.expectedEmail);
    assert.equal(res.user.city, cred.expectedCity);

    // Wrong password
    const failRes = await authenticateUser(cred.phone, 'WrongPassword123');
    assert.equal(failRes.success, false, `Login must fail with incorrect password for ${cred.phone}`);
    assert.ok(failRes.error, 'Error message must be present for failed login');
  }

  // Non-existent user
  const notFoundRes = await authenticateUser('9000090000', 'anyPassword');
  assert.equal(notFoundRes.success, false, 'Non-existent mobile must fail');
  assert.ok(notFoundRes.error, 'Error message for not found account');
});
