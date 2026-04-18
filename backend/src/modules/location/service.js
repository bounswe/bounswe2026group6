const DEFAULT_NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const DEFAULT_TIMEOUT_MS = 4500;
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CACHE_MAX_ENTRIES = 500;

// Process-local cache for geocoder reads.
// Purpose: cut repeated provider calls for identical short-term queries.
// Scope: current Node.js process only (reset on restart, not shared across replicas).
const locationCache = new Map();

const staticLocationTree = {
  TR: {
    label: 'Turkey',
    cities: {
      istanbul: {
        label: 'Istanbul',
        districts: {
          kadikoy: {
            label: 'Kadikoy',
            neighborhoods: [
              { label: 'Bostanci', value: 'bostanci' },
              { label: 'Erenkoy', value: 'erenkoy' },
            ],
          },
          besiktas: {
            label: 'Besiktas',
            neighborhoods: [
              { label: 'Balmumcu', value: 'balmumcu' },
              { label: 'Kurucesme', value: 'kurucesme' },
            ],
          },
        },
      },
      ankara: {
        label: 'Ankara',
        districts: {
          cankaya: {
            label: 'Cankaya',
            neighborhoods: [
              { label: 'Anittepe', value: 'anittepe' },
            ],
          },
        },
      },
    },
  },
};

function getNominatimBaseUrl() {
  return process.env.NOMINATIM_BASE_URL || DEFAULT_NOMINATIM_BASE_URL;
}

function readPositiveNumberEnv(value, fallback, { integer = false } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return integer ? Math.floor(parsed) : parsed;
}

function getTimeoutMs() {
  return readPositiveNumberEnv(process.env.LOCATION_HTTP_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
}

function getCacheTtlMs() {
  return readPositiveNumberEnv(process.env.LOCATION_CACHE_TTL_MS, DEFAULT_CACHE_TTL_MS);
}

function getCacheMaxEntries() {
  return readPositiveNumberEnv(process.env.LOCATION_CACHE_MAX_ENTRIES, DEFAULT_CACHE_MAX_ENTRIES, { integer: true });
}

function makeCacheKey(scope, value) {
  return `${scope}:${value}`;
}

function readFromCache(cacheKey) {
  const entry = locationCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    locationCache.delete(cacheKey);
    return null;
  }

  return entry.value;
}

function pruneCache() {
  // 1) remove expired entries first, 2) enforce entry-count cap.
  const now = Date.now();
  for (const [key, entry] of locationCache.entries()) {
    if (entry.expiresAt <= now) {
      locationCache.delete(key);
    }
  }

  const maxEntries = getCacheMaxEntries();
  while (locationCache.size > maxEntries) {
    const oldestKey = locationCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    locationCache.delete(oldestKey);
  }
}

function writeToCache(cacheKey, value) {
  const expiresAt = Date.now() + getCacheTtlMs();
  locationCache.set(cacheKey, { value, expiresAt });
  pruneCache();
}

function mapNominatimItem(item) {
  const address = item.address || {};

  return {
    placeId: String(item.place_id || ''),
    displayName: item.display_name || '',
    latitude: Number(item.lat),
    longitude: Number(item.lon),
    administrative: {
      countryCode: (address.country_code || '').toUpperCase(),
      country: address.country || '',
      city: address.city || address.town || address.village || '',
      district: address.county || address.state_district || address.municipality || '',
      neighborhood: address.neighbourhood || address.suburb || '',
      extraAddress: [address.road, address.house_number].filter(Boolean).join(' ').trim(),
      postalCode: address.postcode || '',
    },
  };
}

async function fetchJsonFromNominatim(path, params) {
  const url = new URL(path, getNominatimBaseUrl());
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  url.searchParams.set('format', 'jsonv2');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'neph-backend/0.1 location-module',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = new Error('GEOCODER_UNAVAILABLE');
      error.code = 'GEOCODER_UNAVAILABLE';
      throw error;
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('GEOCODER_TIMEOUT');
      timeoutError.code = 'GEOCODER_TIMEOUT';
      throw timeoutError;
    }

    if (error.code) {
      throw error;
    }

    const wrapped = new Error('GEOCODER_UNAVAILABLE');
    wrapped.code = 'GEOCODER_UNAVAILABLE';
    throw wrapped;
  } finally {
    clearTimeout(timeout);
  }
}

async function getLocationTree(countryCode) {
  return staticLocationTree[countryCode] || null;
}

async function searchLocations({ q, countryCode, limit }) {
  const cacheKey = makeCacheKey('search', `${countryCode.toUpperCase()}|${q.trim().toLowerCase()}|${limit}`);
  const cached = readFromCache(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const items = await fetchJsonFromNominatim('/search', {
    q,
    countrycodes: countryCode.toLowerCase(),
    limit,
    addressdetails: 1,
  });

  if (!Array.isArray(items)) {
    return [];
  }

  const mapped = items.map(mapNominatimItem);
  writeToCache(cacheKey, mapped);
  return mapped;
}

async function reverseGeocode({ lat, lon }) {
  const cacheKey = makeCacheKey('reverse', `${lat.toFixed(6)}|${lon.toFixed(6)}`);
  const cached = readFromCache(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const item = await fetchJsonFromNominatim('/reverse', {
    lat,
    lon,
    addressdetails: 1,
  });

  if (!item || typeof item !== 'object') {
    return null;
  }

  const mapped = mapNominatimItem(item);
  writeToCache(cacheKey, mapped);
  return mapped;
}

function __resetLocationCache() {
  // Test helper: keep deterministic assertions by clearing process-local cache.
  // Do not call this from runtime request handlers.
  locationCache.clear();
}

module.exports = {
  getLocationTree,
  searchLocations,
  reverseGeocode,
  __resetLocationCache,
};
