import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256 } from '../utils/cryptoUtils.js';
import { TEST_ACCOUNT, authenticateUser, seedTestAccount } from './authService.js';

test('Dev Test Account: SHA-256 password hash matches sai@1398', async () => {
  const hash = await sha256('sai@1398');
  assert.equal(hash, TEST_ACCOUNT.passwordHash, 'Hash of sai@1398 must match seed passwordHash');
  assert.equal(TEST_ACCOUNT.phone, '9390075877');
  assert.equal(TEST_ACCOUNT.city, 'Kadapa');
  assert.equal(TEST_ACCOUNT.email, 'narasimhasai@gmail.com');
});
