/**
 * Location Service for Utsavora
 * 
 * Note on Geolocation API:
 * Modern browsers strictly restrict navigator.geolocation to secure origins (HTTPS or localhost).
 * On non-secure origins or unsupported browsers, it will gracefully report unavailable so the
 * user can seamlessly choose their location manually.
 * 
 * Note on OpenStreetMap Nominatim Policy:
 * Nominatim free usage policy allows approximately 1 request per second and is intended for
 * light demonstration or low-volume lookups. An in-memory cache is used to ensure we only
 * call Nominatim once per coordinate pair per session.
 */

import indianLocationsData from '../data/indianLocations.json' with { type: 'json' };

export const INDIAN_LOCATIONS = indianLocationsData;

// In-memory cache for reverse geocoding results: "lat,lon" -> result
const nominatimCache = new Map();

/**
 * Perform reverse geocoding via OpenStreetMap Nominatim
 * @param {number} lat 
 * @param {number} lon 
 * @returns {Promise<{ city: string, state: string, pincode: string, lat: number, lon: number, source: string }>}
 */
export async function reverseGeocode(lat, lon) {
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (nominatimCache.has(cacheKey)) {
    return nominatimCache.get(cacheKey);
  }

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=10&addressdetails=1&accept-language=en`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const address = data.address || {};

    // Read city from address.city, or address.town, or address.village, or address.county (first one found)
    const city = address.city || address.town || address.village || address.county || '';
    const state = address.state || '';
    const pincode = address.postcode || '';

    if (!city) {
      throw new Error('NO_CITY_FOUND');
    }

    const result = {
      city,
      state,
      pincode,
      lat,
      lon,
      source: 'auto'
    };

    nominatimCache.set(cacheKey, result);
    return result;
  } catch (err) {
    if (err.message === 'NO_CITY_FOUND') {
      throw new Error("We found you, but not your city name. Please choose it manually.");
    }
    throw new Error("We couldn't find your location. Choose your city manually instead.");
  }
}

/**
 * Get current browser geolocation
 * @returns {Promise<{ lat: number, lon: number }>}
 */
export function getCurrentPositionAsync() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("We couldn't find your location. Choose your city manually instead."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude
        });
      },
      (err) => {
        // GeolocationPositionError codes:
        // 1: PERMISSION_DENIED
        // 2: POSITION_UNAVAILABLE
        // 3: TIMEOUT
        if (err.code === 1) {
          reject(new Error("Location permission is off. Choose your city manually instead."));
        } else {
          reject(new Error("We couldn't find your location. Choose your city manually instead."));
        }
      },
      {
        timeout: 10000,
        enableHighAccuracy: false
      }
    );
  });
}
