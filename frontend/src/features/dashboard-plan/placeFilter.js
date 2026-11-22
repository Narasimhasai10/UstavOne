/**
 * Place Filter Persistence Service
 * Manages customer district filter in sessionStorage under key 'vedika_place_filter'
 */

const STORAGE_KEY = 'vedika_place_filter';

export function getStoredPlaceFilter() {
  try {
    if (typeof sessionStorage === 'undefined') return { state: null, district: null };
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: null, district: null };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        state: parsed.state || null,
        district: parsed.district || null
      };
    }
  } catch {}
  return { state: null, district: null };
}

export function setStoredPlaceFilter(filter) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (!filter || !filter.district) {
      sessionStorage.removeItem(STORAGE_KEY);
    } else {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        state: filter.state || null,
        district: filter.district
      }));
    }
  } catch {}
}

export function clearStoredPlaceFilter() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}
