/**
 * Storage Key Migration Service
 * One-time migration that copies any existing 'vedika_' or 'vedika.' keys in
 * localStorage and sessionStorage to their 'utsavora' equivalents, and removes
 * the old keys so existing offline demo data and logged-in sessions are preserved.
 */

export function migrateStorageKeys(customStorage = null) {
  const storages = [];

  if (customStorage) {
    storages.push(customStorage);
  } else {
    if (typeof localStorage !== 'undefined') storages.push(localStorage);
    if (typeof sessionStorage !== 'undefined') storages.push(sessionStorage);
  }

  let migratedCount = 0;

  for (const store of storages) {
    if (!store) continue;
    try {
      const keysToMigrate = [];
      const len = typeof store.length === 'number' ? store.length : (Object.keys(store).length || 0);

      // Collect matching keys
      for (let i = 0; i < len; i++) {
        const key = typeof store.key === 'function' ? store.key(i) : Object.keys(store)[i];
        if (key && (key.startsWith('vedika_') || key.startsWith('vedika.'))) {
          keysToMigrate.push(key);
        }
      }

      // Also check Object.keys(store) if standard iteration missed any
      if (typeof Object.keys === 'function') {
        for (const k of Object.keys(store)) {
          if (k && (k.startsWith('vedika_') || k.startsWith('vedika.')) && !keysToMigrate.includes(k)) {
            keysToMigrate.push(k);
          }
        }
      }

      for (const oldKey of keysToMigrate) {
        const newKey = oldKey.replace(/^vedika([_.])/, 'utsavora$1');
        const value = typeof store.getItem === 'function' ? store.getItem(oldKey) : store[oldKey];
        if (value !== null && value !== undefined) {
          const existingNewVal = typeof store.getItem === 'function' ? store.getItem(newKey) : store[newKey];
          // Only copy over if the new key is not already set
          if (existingNewVal === null || existingNewVal === undefined) {
            if (typeof store.setItem === 'function') {
              store.setItem(newKey, value);
            } else {
              store[newKey] = value;
            }
          }
          // Remove the old deprecated key
          if (typeof store.removeItem === 'function') {
            store.removeItem(oldKey);
          } else {
            delete store[oldKey];
          }
          migratedCount++;
        }
      }
    } catch (e) {
      // Storage access gracefully handled
    }
  }

  return migratedCount;
}

// Auto-run migration in browser context on load
if (typeof window !== 'undefined' || typeof localStorage !== 'undefined') {
  try {
    migrateStorageKeys();
  } catch {}
}
