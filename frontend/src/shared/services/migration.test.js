import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { migrateStorageKeys } from './migration.js';

describe('Storage Key Migration Service (vedika_* -> utsavora_*)', () => {
  class MockStorage {
    constructor() {
      this.store = {};
    }
    get length() {
      return Object.keys(this.store).length;
    }
    key(i) {
      return Object.keys(this.store)[i] || null;
    }
    getItem(k) {
      return this.store.hasOwnProperty(k) ? this.store[k] : null;
    }
    setItem(k, v) {
      this.store[k] = String(v);
    }
    removeItem(k) {
      delete this.store[k];
    }
    clear() {
      this.store = {};
    }
  }

  let mockStore;

  beforeEach(() => {
    mockStore = new MockStorage();
  });

  test('1. Migrates core storage keys from vedika_ to utsavora_', () => {
    mockStore.setItem('vedika_current_user', JSON.stringify({ name: 'D L Narasimha sai', phone: '9390075877' }));
    mockStore.setItem('vedika_users', JSON.stringify([{ phone: '9390075877' }]));
    mockStore.setItem('vedika.event', 'wedding');
    mockStore.setItem('vedika_place_filter', JSON.stringify({ district: 'Kadapa' }));
    mockStore.setItem('vedika_access_token', 'mock.jwt.token');
    mockStore.setItem('vedika_refresh_token', 'mock.refresh.token');
    mockStore.setItem('vedika_bookings_9390075877', JSON.stringify([{ id: 'BK-1' }]));
    mockStore.setItem('vedika_vendor_bookings_sai_halls', JSON.stringify([{ id: 'VBK-1' }]));
    mockStore.setItem('vedika_branches_sai_halls', JSON.stringify([{ name: 'Central Branch' }]));
    mockStore.setItem('vedika_works_sai_halls', JSON.stringify([{ title: 'Reception' }]));

    const count = migrateStorageKeys(mockStore);
    assert.equal(count, 10, 'Must migrate all 10 keys');

    // Verify all old keys removed
    assert.equal(mockStore.getItem('vedika_current_user'), null);
    assert.equal(mockStore.getItem('vedika_users'), null);
    assert.equal(mockStore.getItem('vedika.event'), null);
    assert.equal(mockStore.getItem('vedika_place_filter'), null);
    assert.equal(mockStore.getItem('vedika_access_token'), null);
    assert.equal(mockStore.getItem('vedika_refresh_token'), null);
    assert.equal(mockStore.getItem('vedika_bookings_9390075877'), null);
    assert.equal(mockStore.getItem('vedika_vendor_bookings_sai_halls'), null);
    assert.equal(mockStore.getItem('vedika_branches_sai_halls'), null);
    assert.equal(mockStore.getItem('vedika_works_sai_halls'), null);

    // Verify new keys populated with exact data
    assert.deepEqual(JSON.parse(mockStore.getItem('utsavora_current_user')), { name: 'D L Narasimha sai', phone: '9390075877' });
    assert.deepEqual(JSON.parse(mockStore.getItem('utsavora_users')), [{ phone: '9390075877' }]);
    assert.equal(mockStore.getItem('utsavora.event'), 'wedding');
    assert.deepEqual(JSON.parse(mockStore.getItem('utsavora_place_filter')), { district: 'Kadapa' });
    assert.equal(mockStore.getItem('utsavora_access_token'), 'mock.jwt.token');
    assert.equal(mockStore.getItem('utsavora_refresh_token'), 'mock.refresh.token');
    assert.deepEqual(JSON.parse(mockStore.getItem('utsavora_bookings_9390075877')), [{ id: 'BK-1' }]);
    assert.deepEqual(JSON.parse(mockStore.getItem('utsavora_vendor_bookings_sai_halls')), [{ id: 'VBK-1' }]);
    assert.deepEqual(JSON.parse(mockStore.getItem('utsavora_branches_sai_halls')), [{ name: 'Central Branch' }]);
    assert.deepEqual(JSON.parse(mockStore.getItem('utsavora_works_sai_halls')), [{ title: 'Reception' }]);
  });

  test('2. Does not overwrite existing new key if already present', () => {
    mockStore.setItem('vedika_current_user', JSON.stringify({ name: 'Old User' }));
    mockStore.setItem('utsavora_current_user', JSON.stringify({ name: 'New User' }));

    const count = migrateStorageKeys(mockStore);
    assert.equal(count, 1);
    assert.equal(mockStore.getItem('vedika_current_user'), null);
    assert.deepEqual(JSON.parse(mockStore.getItem('utsavora_current_user')), { name: 'New User' });
  });

  test('3. Migration is idempotent (safe to run multiple times)', () => {
    mockStore.setItem('vedika_users', JSON.stringify([{ id: 1 }]));

    const firstRun = migrateStorageKeys(mockStore);
    assert.equal(firstRun, 1);

    const secondRun = migrateStorageKeys(mockStore);
    assert.equal(secondRun, 0);

    assert.deepEqual(JSON.parse(mockStore.getItem('utsavora_users')), [{ id: 1 }]);
  });

  test('4. Ignores unrelated keys', () => {
    mockStore.setItem('theme', 'dark');
    mockStore.setItem('other_app_key', 'value');

    const count = migrateStorageKeys(mockStore);
    assert.equal(count, 0);
    assert.equal(mockStore.getItem('theme'), 'dark');
    assert.equal(mockStore.getItem('other_app_key'), 'value');
  });
});
