/**
 * Photo Storage & In-Browser Canvas Compression
 * Stores compressed image data in IndexedDB with in-memory fallback.
 */

const DB_NAME = 'vedika_photos_db';
const STORE_NAME = 'photos';
const DB_VERSION = 1;

// In-memory fallback map if IndexedDB is disabled (e.g. some restricted file:// contexts)
const inMemoryPhotos = new Map();

function openDatabase() {
  return new Promise((resolve, reject) => {
    try {
      if (typeof indexedDB === 'undefined') {
        return resolve(null);
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
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
    const db = await openDatabase();
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
 * Retrieves a photo dataUrl by ID
 */
export async function getPhoto(id) {
  if (!id) return null;
  if (inMemoryPhotos.has(id)) {
    return inMemoryPhotos.get(id);
  }

  try {
    const db = await openDatabase();
    if (db) {
      return await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => {
          if (req.result?.dataUrl) {
            inMemoryPhotos.set(id, req.result.dataUrl);
            resolve(req.result.dataUrl);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
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
    const db = await openDatabase();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
    }
  } catch {}
}
