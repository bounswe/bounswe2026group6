const DEFAULT_OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const DEFAULT_TIMEOUT_MS = 6000;
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CACHE_MAX_ENTRIES = 500;
const DEFAULT_OVERPASS_USER_AGENT = 'NEPH-Backend/1.0 (+https://github.com/bounswe/bounswe2026group6)';
const CACHE_COORDINATE_DECIMALS = 4;

const nearbyCache = new Map();

function readPositiveNumberEnv(value, fallback, { integer = false } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return integer ? Math.floor(parsed) : parsed;
}

function getOverpassUrl() {
  return process.env.GATHERING_AREAS_OVERPASS_URL || DEFAULT_OVERPASS_URL;
}

function getOverpassUserAgent() {
  const configured = (process.env.GATHERING_AREAS_USER_AGENT || '').trim();
  return configured || DEFAULT_OVERPASS_USER_AGENT;
}

function getTimeoutMs() {
  return readPositiveNumberEnv(process.env.GATHERING_AREAS_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
}

function getCacheTtlMs() {
  return readPositiveNumberEnv(process.env.GATHERING_AREAS_CACHE_TTL_MS, DEFAULT_CACHE_TTL_MS);
}

function getCacheMaxEntries() {
  return readPositiveNumberEnv(process.env.GATHERING_AREAS_CACHE_MAX_ENTRIES, DEFAULT_CACHE_MAX_ENTRIES, { integer: true });
}

function buildCacheKey({ lat, lon, radius, limit }) {
  return `${lat.toFixed(CACHE_COORDINATE_DECIMALS)}:${lon.toFixed(CACHE_COORDINATE_DECIMALS)}:${radius}:${limit}`;
}

function readFromCache(cacheKey) {
  const entry = nearbyCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    nearbyCache.delete(cacheKey);
    return null;
  }

  return entry.value;
}

function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of nearbyCache.entries()) {
    if (entry.expiresAt <= now) {
      nearbyCache.delete(key);
    }
  }

  const maxEntries = getCacheMaxEntries();
  while (nearbyCache.size > maxEntries) {
    const oldestKey = nearbyCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    nearbyCache.delete(oldestKey);
  }
}

function writeToCache(cacheKey, value) {
  nearbyCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + getCacheTtlMs(),
  });
  pruneCache();
}

function buildOverpassQuery({ lat, lon, radius }) {
  return [
    '[out:json][timeout:25];',
    '(',
    `  node(around:${radius},${lat},${lon})["emergency"="assembly_point"];`,
    `  way(around:${radius},${lat},${lon})["emergency"="assembly_point"];`,
    `  relation(around:${radius},${lat},${lon})["emergency"="assembly_point"];`,
    `  node(around:${radius},${lat},${lon})["amenity"="shelter"];`,
    `  way(around:${radius},${lat},${lon})["amenity"="shelter"];`,
    `  relation(around:${radius},${lat},${lon})["amenity"="shelter"];`,
    ');',
    'out center tags;',
  ].join('\n');
}

function buildOverpassLightweightQuery({ lat, lon, radius }) {
  return [
    '[out:json][timeout:25];',
    '(',
      `  node(around:${radius},${lat},${lon})["emergency"="assembly_point"];`,
      `  node(around:${radius},${lat},${lon})["amenity"="shelter"];`,
    ');',
    'out tags;',
  ].join('\n');
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function calculateDistanceMeters(fromLat, fromLon, toLat, toLon) {
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(toLat - fromLat);
  const dLon = toRadians(toLon - fromLon);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

function mapElementToFeature(element, center) {
  if (!isObject(element)) {
    return null;
  }

  const tags = isObject(element.tags) ? element.tags : {};
  const lat = safeNumber(element.lat !== undefined ? element.lat : element.center && element.center.lat);
  const lon = safeNumber(element.lon !== undefined ? element.lon : element.center && element.center.lon);

  if (lat === null || lon === null) {
    return null;
  }

  const distanceMeters = Math.round(calculateDistanceMeters(center.lat, center.lon, lat, lon));

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [lon, lat],
    },
    properties: {
      id: String(element.id || ''),
      osmType: element.type || '',
      name: tags.name || tags['name:tr'] || '',
      category: tags.emergency || tags.amenity || 'unknown',
      distanceMeters,
      rawTags: tags,
    },
  };
}

function toFeatureCollection(elements, limit, center) {
  const features = [];
  const seen = new Set();

  for (const [index, element] of (Array.isArray(elements) ? elements : []).entries()) {
    if (!isObject(element)) {
      continue;
    }

    const typeKey = element && element.type ? element.type : 'unknown';
    const idKey = element && element.id ? String(element.id) : `idx-${index}`;
    const uniqueKey = `${typeKey}:${idKey}`;
    if (seen.has(uniqueKey)) {
      continue;
    }

    const feature = mapElementToFeature(element, center);
    if (!feature) {
      continue;
    }

    seen.add(uniqueKey);
    features.push(feature);
  }

  features.sort((left, right) => left.properties.distanceMeters - right.properties.distanceMeters);

  return {
    type: 'FeatureCollection',
    features: features.slice(0, limit),
  };
}

async function fetchNearbyFromOverpassWithQuery(params, queryText) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(getOverpassUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': getOverpassUserAgent(),
      },
      body: new URLSearchParams({ data: queryText }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = new Error(`Overpass request failed with status ${response.status}`);
      error.code = 'OVERPASS_UNAVAILABLE';
      error.status = response.status;
      throw error;
    }

    const payload = await response.json();
    if (!isObject(payload) || !Array.isArray(payload.elements)) {
      const error = new Error('Overpass returned an invalid payload');
      error.code = 'OVERPASS_INVALID_PAYLOAD';
      throw error;
    }

    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Overpass timeout');
      timeoutError.code = 'OVERPASS_TIMEOUT';
      throw timeoutError;
    }

    if (error.code === 'OVERPASS_UNAVAILABLE' || error.code === 'OVERPASS_INVALID_PAYLOAD') {
      throw error;
    }

    const wrappedError = new Error('Overpass unavailable');
    wrappedError.code = 'OVERPASS_UNAVAILABLE';
    wrappedError.cause = error;
    throw wrappedError;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchNearbyFromOverpass(params) {
  try {
    return await fetchNearbyFromOverpassWithQuery(params, buildOverpassQuery(params));
  } catch (error) {
    const shouldRetryWithLightweightQuery =
      error &&
      (error.code === 'OVERPASS_UNAVAILABLE' || error.code === 'OVERPASS_TIMEOUT');

    if (!shouldRetryWithLightweightQuery) {
      throw error;
    }

    return fetchNearbyFromOverpassWithQuery(params, buildOverpassLightweightQuery(params));
  }
}

async function getNearbyGatheringAreas(params) {
  const cacheKey = buildCacheKey(params);
  const cached = readFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  const payload = await fetchNearbyFromOverpass(params);
  const collection = toFeatureCollection(payload.elements, params.limit, {
    lat: params.lat,
    lon: params.lon,
  });

  const result = {
    center: {
      lat: params.lat,
      lon: params.lon,
    },
    radius: params.radius,
    source: 'overpass',
    meta: {
      requestedLimit: params.limit,
      returnedCount: collection.features.length,
    },
    collection,
  };

  writeToCache(cacheKey, result);
  return result;
}

function __resetNearbyCache() {
  nearbyCache.clear();
}

module.exports = {
  getNearbyGatheringAreas,
  __resetNearbyCache,
};
