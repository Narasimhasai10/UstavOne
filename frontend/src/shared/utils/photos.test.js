import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * In-memory Mock IndexedDB Implementation
 */
class MockObjectStore {
  constructor(name, dataMap) {
    this.name = name;
    this.dataMap = dataMap;
  }

  put(val) {
    const key = val.id;
    this.dataMap.set(key, { ...val });
    const req = { onsuccess: null, onerror: null, result: key };
    queueMicrotask(() => {
      if (req.onsuccess) req.onsuccess({ target: req });
    });
    return req;
  }

  get(key) {
    const val = this.dataMap.get(key) || null;
    const req = { onsuccess: null, onerror: null, result: val };
    queueMicrotask(() => {
      if (req.onsuccess) req.onsuccess({ target: req });
    });
    return req;
  }

  getAll() {
    const all = Array.from(this.dataMap.values());
    const req = { onsuccess: null, onerror: null, result: all };
    queueMicrotask(() => {
      if (req.onsuccess) req.onsuccess({ target: req });
    });
    return req;
  }

  delete(key) {
    this.dataMap.delete(key);
    const req = { onsuccess: null, onerror: null };
    queueMicrotask(() => {
      if (req.onsuccess) req.onsuccess({ target: req });
    });
    return req;
  }
}

class MockIDBDatabase {
  constructor(name, databases) {
    this.name = name;
    this.databases = databases;
    if (!this.databases.has(name)) {
      this.databases.set(name, new Map());
    }
    this.objectStoreNames = {
      contains: (s) => s === 'photos'
    };
  }

  transaction(storeNames, mode) {
    const dataMap = this.databases.get(this.name);
    const store = new MockObjectStore('photos', dataMap);
    const tx = {
      objectStore: () => store,
      oncomplete: null,
      onerror: null
    };
    queueMicrotask(() => {
      if (tx.oncomplete) tx.oncomplete();
    });
    return tx;
  }

  close() {}
}

class MockIDBFactory {
  constructor() {
    this.databases = new Map();
  }

  open(name, version) {
    const db = new MockIDBDatabase(name, this.databases);
    const req = {
      result: db,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null
    };
    queueMicrotask(() => {
      if (req.onsuccess) req.onsuccess({ target: req });
    });
    return req;
  }
}

describe('Photo Database Legacy Migration & Storage Fallback', () => {
  let mockStorage = {};
  let mockFactory = null;
  let photosModule = null;

  beforeEach(async () => {
    mockStorage = {};
    mockFactory = new MockIDBFactory();

    // Set up global environment mocks
    globalThis.localStorage = {
      getItem: (k) => mockStorage[k] || null,
      setItem: (k, v) => { mockStorage[k] = String(v); },
      removeItem: (k) => { delete mockStorage[k]; },
      clear: () => { mockStorage = {}; }
    };
    globalThis.indexedDB = mockFactory;
    globalThis.window = {
      location: { origin: 'http://localhost:5173' }
    };

    // Dynamically import fresh module
    photosModule = await import(`./photos.js?t=${Date.now()}`);
  });

  test('1. Migration copies records from legacy vedika_photos_db to utsavora_photos_db', async () => {
    // Clear flag so migration runs for this test
    mockStorage['utsavora_photos_migrated'] = null;

    // Seed legacy database with 2 photos
    const legacyMap = new Map();
    legacyMap.set('legacy_photo_1', { id: 'legacy_photo_1', dataUrl: 'data:image/jpeg;base64,sample1' });
    legacyMap.set('legacy_photo_2', { id: 'legacy_photo_2', dataUrl: 'data:image/png;base64,sample2' });
    mockFactory.databases.set('vedika_photos_db', legacyMap);

    // Run migration
    const result = await photosModule.migrateLegacyPhotosDb();
    assert.equal(result, true, 'Migration should complete successfully');

    // Verify records exist in utsavora_photos_db
    const newDbMap = mockFactory.databases.get('utsavora_photos_db');
    assert.ok(newDbMap, 'New database should exist');
    assert.equal(newDbMap.get('legacy_photo_1')?.dataUrl, 'data:image/jpeg;base64,sample1');
    assert.equal(newDbMap.get('legacy_photo_2')?.dataUrl, 'data:image/png;base64,sample2');

    // Verify localStorage migration flag was set
    assert.equal(mockStorage['utsavora_photos_migrated'], 'true');

    // Verify old DB was NOT deleted
    assert.ok(mockFactory.databases.has('vedika_photos_db'), 'Old DB must never be deleted');
  });

  test('2. Migration is idempotent (subsequent runs do not fail or duplicate)', async () => {
    mockStorage['utsavora_photos_migrated'] = 'true';
    const result = await photosModule.migrateLegacyPhotosDb();
    assert.equal(result, true, 'Second run should safely return true immediately');
  });

  test('3. getPhoto falls back to legacy vedika_photos_db if photo is not in new DB', async () => {
    // Seed photo ONLY in legacy database
    const legacyMap = new Map();
    legacyMap.set('old_legacy_photo_99', { id: 'old_legacy_photo_99', dataUrl: 'data:image/webp;base64,recovered99' });
    mockFactory.databases.set('vedika_photos_db', legacyMap);

    const recovered = await photosModule.getPhoto('old_legacy_photo_99');
    assert.equal(recovered, 'data:image/webp;base64,recovered99', 'Must resolve photo from legacy DB');

    // Verify it was copied to new DB for faster subsequent reads
    const newDbMap = mockFactory.databases.get('utsavora_photos_db');
    assert.equal(newDbMap?.get('old_legacy_photo_99')?.dataUrl, 'data:image/webp;base64,recovered99');
  });

  test('4. resolvePhotoUrls handles data URLs, server /uploads paths, and IndexedDB IDs', async () => {
    const legacyMap = new Map();
    legacyMap.set('p_id_abc', { id: 'p_id_abc', dataUrl: 'data:image/jpeg;base64,abc1234' });
    mockFactory.databases.set('utsavora_photos_db', legacyMap);

    const input = [
      { id: 'p_id_abc', isCover: true, caption: 'Main Entrance' },
      { id: 'server_p_2', url: '/uploads/public/venue-photo.jpg', caption: 'Stage' },
      { id: 'http_p_3', url: 'https://example.com/photo.jpg', caption: 'Lawn' }
    ];

    const resolved = await photosModule.resolvePhotoUrls(input);
    assert.equal(resolved.length, 3);
    assert.equal(resolved[0].url, 'data:image/jpeg;base64,abc1234');
    assert.equal(resolved[1].url, '/uploads/public/venue-photo.jpg');
    assert.equal(resolved[2].url, 'https://example.com/photo.jpg');
  });
});
