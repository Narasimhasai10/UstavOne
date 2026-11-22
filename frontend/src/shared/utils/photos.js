/**
 * Photo Storage, In-Browser Canvas Compression & Legacy Migration
 * Stores compressed image data in IndexedDB with in-memory fallback.
 * Automatically recovers existing photos from legacy 'vedika_photos_db'.
 */

const DB_NAME = 'utsavora_photos_db';
const OLD_DB_NAME = 'vedika_photos_db';
const STORE_NAME = 'photos';
const DB_VERSION = 1;
const MIGRATION_FLAG = 'utsavora_photos_migrated';

// In-memory fallback map if IndexedDB is disabled (e.g. some restricted file:// contexts)
const inMemoryPhotos = new Map();

export function openDatabase(name = DB_NAME) {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        return resolve(null);
      }
      const req = indexedDB.open(name, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null); // Fall back gracefully on error
    } catch {
      resolve(null);
    }
  });
}

/**
 * One-time, idempotent migration that copies every record from
 * IndexedDB 'vedika_photos_db' into 'utsavora_photos_db'.
 * Skips IDs that already exist, wraps in try/catch, sets a flag
 * in localStorage when done, and never deletes the old DB.
 */
export async function migrateLegacyPhotosDb() {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return false;
  }
  try {
    if (localStorage.getItem(MIGRATION_FLAG) === 'true') {
      return true; // Already migrated
    }

    const oldDb = await openDatabase(OLD_DB_NAME);
    if (!oldDb) {
      localStorage.setItem(MIGRATION_FLAG, 'true');
      return true;
    }

    if (!oldDb.objectStoreNames.contains(STORE_NAME)) {
      try { oldDb.close(); } catch {}
      localStorage.setItem(MIGRATION_FLAG, 'true');
      return true;
    }

    const records = await new Promise((resolve) => {
      try {
        const tx = oldDb.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        if (typeof store.getAll === 'function') {
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } else {
          const items = [];
          const req = store.openCursor();
          req.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
              items.push(cursor.value);
              cursor.continue();
            } else {
              resolve(items);
            }
          };
          req.onerror = () => resolve(items);
        }
      } catch {
        resolve([]);
      }
    });

    try { oldDb.close(); } catch {}

    if (records.length > 0) {
      const newDb = await openDatabase(DB_NAME);
      if (newDb) {
        await new Promise((resolve) => {
          try {
            const tx = newDb.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            for (const rec of records) {
              if (rec && rec.id) {
                if (!inMemoryPhotos.has(rec.id) && rec.dataUrl) {
                  inMemoryPhotos.set(rec.id, rec.dataUrl);
                }
                store.put(rec);
              }
            }
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
          } catch {
            resolve(false);
          }
        });
        try { newDb.close(); } catch {}
      }
    }

    localStorage.setItem(MIGRATION_FLAG, 'true');
    return true;
  } catch (err) {
    console.warn('[photos] Migration from legacy DB encountered error:', err);
    return false;
  }
}

// Auto-run migration once on browser load
if (typeof window !== 'undefined') {
  try {
    migrateLegacyPhotosDb();
  } catch {}
}

/**
 * Returns API base origin for resolving relative /uploads paths
 */
export function getApiOrigin() {
  const defaultApi = 'http://localhost:4000';
  if (typeof window === 'undefined') return defaultApi;
  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL);
  if (envUrl) {
    try {
      const u = new URL(envUrl);
      return u.origin;
    } catch {}
  }
  return defaultApi;
}

/**
 * Ensures photo URLs starting with /uploads are reachable from file:// or other origins
 */
export function formatPhotoUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:') || rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }
  if (rawUrl.startsWith('/uploads')) {
    if (typeof window !== 'undefined' && window.location?.origin && (window.location.origin.startsWith('file:') || window.location.origin === 'null')) {
      return `${getApiOrigin()}${rawUrl}`;
    }
    return rawUrl;
  }
  return rawUrl;
}

/**
 * Compresses an image File or Blob using HTML Canvas
 * Max 1280px on the longest side, JPEG quality 0.8
 */
export async function compressImage(fileOrBlob, maxDimension = 1280, quality = 0.8) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof window === 'undefined') {
        return resolve(fileOrBlob);
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(e.target.result); // Fallback to original
          }
          ctx.drawImage(img, 0, 0, width, height);

          // Export compressed JPEG
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBlob);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Saves a photo and returns its unique ID
 */
export async function savePhoto(dataUrlOrFile) {
  const id = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let dataUrl = dataUrlOrFile;

  if (typeof dataUrlOrFile !== 'string') {
    dataUrl = await compressImage(dataUrlOrFile);
  } else if (dataUrlOrFile.startsWith('data:image/') && dataUrlOrFile.length > 200000) {
    // If it's a huge base64 string, compress it
    try {
      const res = await fetch(dataUrlOrFile);
      const blob = await res.blob();
      dataUrl = await compressImage(blob);
    } catch {}
  }

  // Save to in-memory store
  inMemoryPhotos.set(id, dataUrl);

  // Attempt to save to IndexedDB
  try {
    const db = await openDatabase(DB_NAME);
    if (db) {
      await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({ id, dataUrl, createdAt: Date.now() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    }
  } catch (err) {
    console.warn('[photos] IndexedDB write failed, falling back to memory:', err);
  }

  return id;
}

/**
 * Retrieves a photo dataUrl by ID (checking memory, utsavora_photos_db,
 * and falling back gracefully to legacy vedika_photos_db).
 */
export async function getPhoto(id) {
  if (!id) return null;
  if (inMemoryPhotos.has(id)) {
    return inMemoryPhotos.get(id);
  }

  try {
    // 1. Try new DB
    const newDb = await openDatabase(DB_NAME);
    if (newDb) {
      const result = await new Promise((resolve) => {
        try {
          const tx = newDb.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(id);
          req.onsuccess = () => resolve(req.result?.dataUrl || null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
      if (result) {
        inMemoryPhotos.set(id, result);
        return result;
      }
    }

    // 2. Fall back to old DB if not found in new DB
    const oldDb = await openDatabase(OLD_DB_NAME);
    if (oldDb && oldDb.objectStoreNames.contains(STORE_NAME)) {
      const oldResult = await new Promise((resolve) => {
        try {
          const tx = oldDb.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(id);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
      if (oldResult?.dataUrl) {
        inMemoryPhotos.set(id, oldResult.dataUrl);
        // Copy into new DB for future speed
        const targetDb = await openDatabase(DB_NAME);
        if (targetDb) {
          try {
            const tx = targetDb.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(oldResult);
          } catch {}
        }
        return oldResult.dataUrl;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Deletes a photo by ID
 */
export async function deletePhoto(id) {
  if (!id) return;
  inMemoryPhotos.delete(id);
  try {
    const db = await openDatabase(DB_NAME);
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
    }
  } catch {}
}

/**
 * Resolves an array of photo objects or IDs by fetching dataUrls from IndexedDB
 * or formatting server /uploads paths, ensuring the 'url' property is populated.
 */
export async function resolvePhotoUrls(photos) {
  if (!Array.isArray(photos)) return [];
  const resolved = await Promise.all(
    photos.map(async (p, idx) => {
      if (!p) return null;
      if (typeof p === 'string') {
        if (p.startsWith('data:') || p.startsWith('http') || p.startsWith('blob:')) {
          return { id: `photo_${idx}`, url: p, caption: '', isCover: idx === 0, order: idx };
        }
        if (p.startsWith('/uploads')) {
          return { id: `photo_${idx}`, url: formatPhotoUrl(p), caption: '', isCover: idx === 0, order: idx };
        }
        const dbUrl = await getPhoto(p);
        return { id: p, url: dbUrl || '', caption: '', isCover: idx === 0, order: idx };
      }

      let url = p.url;
      if (!url && p.id && !p.id.startsWith('http') && !p.id.startsWith('/')) {
        url = await getPhoto(p.id);
      } else if (url && !url.startsWith('data:') && !url.startsWith('http') && !url.startsWith('/') && !url.startsWith('blob:')) {
        const dbUrl = await getPhoto(url);
        url = dbUrl || '';
      }

      if (url && url.startsWith('/uploads')) {
        url = formatPhotoUrl(url);
      }

      return {
        id: p.id || `photo_${Date.now()}_${idx}`,
        caption: p.caption || '',
        isCover: Boolean(p.isCover),
        order: p.order !== undefined ? p.order : idx,
        url: url || ''
      };
    })
  );
  return resolved.filter(Boolean);
}

/**
 * Strips base64/data URLs from photo objects before saving to localStorage,
 * ensuring image binary data is stored safely in IndexedDB and returning
 * lightweight photo metadata objects: { id, caption, isCover, order }.
 * Server paths (/uploads/...) and http URLs are preserved as url.
 */
export async function stripPhotoUrlsForStorage(photos) {
  if (!Array.isArray(photos)) return [];
  const lightweight = [];
  for (let idx = 0; idx < photos.length; idx++) {
    const p = photos[idx];
    if (!p) continue;

    let photoId = p.id;
    const url = typeof p === 'string' ? p : p.url;

    if (url && (url.startsWith('data:image/') || url.startsWith('blob:'))) {
      if (!photoId || !photoId.startsWith('photo_')) {
        photoId = await savePhoto(url);
      } else {
        const existing = await getPhoto(photoId);
        if (!existing) {
          await savePhoto(url);
        }
      }
    }

    const isServerUrl = url && (url.startsWith('/uploads') || url.startsWith('http'));

    lightweight.push({
      id: photoId || (typeof p === 'string' ? p : (p.id || `photo_${Date.now()}_${idx}`)),
      url: isServerUrl ? url : undefined,
      caption: p.caption || '',
      isCover: Boolean(p.isCover || idx === 0),
      order: p.order !== undefined ? p.order : idx
    });
  }
  return lightweight;
}

/**
 * One-time migration: inspects stored branches and works, moves any inline base64
 * data URLs into IndexedDB, and strips them from the returned objects.
 */
export async function migrateInlinePhotosToIndexedDB(branches = [], works = []) {
  let changedBranches = false;
  let changedWorks = false;

  for (const b of branches) {
    if (Array.isArray(b.photos)) {
      const hasInline = b.photos.some(p => p && p.url && (p.url.startsWith('data:image/') || p.url.startsWith('blob:')));
      if (hasInline) {
        b.photos = await stripPhotoUrlsForStorage(b.photos);
        if (b.coverPhoto && (b.coverPhoto.startsWith('data:image/') || b.coverPhoto.startsWith('blob:'))) {
          b.coverPhoto = b.photos.find(p => p.isCover)?.url || b.photos.find(p => p.isCover)?.id || b.photos[0]?.id || '';
        }
        changedBranches = true;
      }
    }
  }

  for (const w of works) {
    if (Array.isArray(w.photos)) {
      const hasInline = w.photos.some(p => p && p.url && (p.url.startsWith('data:image/') || p.url.startsWith('blob:')));
      if (hasInline) {
        w.photos = await stripPhotoUrlsForStorage(w.photos);
        changedWorks = true;
      }
    }
    if (w.coverPhoto && (w.coverPhoto.startsWith('data:image/') || w.coverPhoto.startsWith('blob:'))) {
      const pid = await savePhoto(w.coverPhoto);
      w.coverPhoto = pid;
      changedWorks = true;
    }
  }

  return { branches, works, changedBranches, changedWorks };
}

/**
 * Converts a data URL to a File object
 */
export function dataUrlToFile(dataUrl, filename = 'photo.jpg') {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/**
 * Displays a non-intrusive toast notification
 */
export function showUtsavoraToast(message) {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById('utsavora-toast-banner');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'utsavora-toast-banner';
  toast.innerText = message;
  toast.style.position = 'fixed';
  toast.style.bottom = '24px';
  toast.style.right = '24px';
  toast.style.background = 'var(--gold, #E8B84A)';
  toast.style.color = '#3A0A1E';
  toast.style.padding = '12px 22px';
  toast.style.borderRadius = '99px';
  toast.style.fontWeight = '700';
  toast.style.fontSize = '0.9rem';
  toast.style.boxShadow = '0 6px 20px rgba(0,0,0,0.25)';
  toast.style.zIndex = '99999';
  toast.style.transition = 'all 0.3s ease';
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(10px)';

  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
