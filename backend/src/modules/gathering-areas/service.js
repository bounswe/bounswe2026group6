const DEFAULT_OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const DEFAULT_TIMEOUT_MS = 6000;
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_STALE_CACHE_TTL_MS = 60 * 60 * 1000;
const DEFAULT_CACHE_MAX_ENTRIES = 500;
const DEFAULT_OVERPASS_USER_AGENT = 'NEPH-Backend/1.0 (+https://github.com/bounswe/bounswe2026group6)';
const CACHE_COORDINATE_DECIMALS = 4;
const FALLBACK_REASON = 'No verified backend fallback gathering-area data is available';
const CATEGORY_METADATA = {
  assembly_point: { key: 'assembly_point', label: 'Assembly Point' },
  shelter: { key: 'shelter', label: 'Shelter' },
  hospital: { key: 'hospital', label: 'Hospital' },
  police: { key: 'police', label: 'Police Station' },
  fire_station: { key: 'fire_station', label: 'Fire Station' },
  pharmacy: { key: 'pharmacy', label: 'Pharmacy' },
  other: { key: 'other', label: 'Other' },
};

const nearbyCache = new Map();

function readPositiveNumberEnv(value, fallback, { integer = false } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return integer ? Math.floor(parsed) : parsed;
}

function getOverpassUrls() {
  const configuredPrimaryUrl = (process.env.GATHERING_AREAS_OVERPASS_URL || '').trim();
  const primaryUrl = configuredPrimaryUrl || DEFAULT_OVERPASS_URL;
  const fallbackUrls = (process.env.GATHERING_AREAS_OVERPASS_FALLBACK_URLS || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  return [...new Set([primaryUrl, ...fallbackUrls])];
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

function getStaleCacheTtlMs() {
  return readPositiveNumberEnv(process.env.GATHERING_AREAS_STALE_CACHE_TTL_MS, DEFAULT_STALE_CACHE_TTL_MS);
}

function getCacheMaxEntries() {
  return readPositiveNumberEnv(process.env.GATHERING_AREAS_CACHE_MAX_ENTRIES, DEFAULT_CACHE_MAX_ENTRIES, { integer: true });
}

function buildCacheKey({ lat, lon, radius, limit }) {
  return `${lat.toFixed(CACHE_COORDINATE_DECIMALS)}:${lon.toFixed(CACHE_COORDINATE_DECIMALS)}:${radius}:${limit}`;
}

function readFreshCache(cacheKey) {
  const entry = nearbyCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    return null;
  }

  return entry.value;
}

function readStaleCache(cacheKey) {
  const entry = nearbyCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (entry.staleExpiresAt <= Date.now()) {
    nearbyCache.delete(cacheKey);
    return null;
  }

  return entry.value;
}

function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of nearbyCache.entries()) {
    if (entry.staleExpiresAt <= now) {
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
  const now = Date.now();
  const cacheTtlMs = getCacheTtlMs();
  const staleCacheTtlMs = Math.max(cacheTtlMs, getStaleCacheTtlMs());

  nearbyCache.set(cacheKey, {
    value,
    expiresAt: now + cacheTtlMs,
    staleExpiresAt: now + staleCacheTtlMs,
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
    `  node(around:${radius},${lat},${lon})["amenity"="hospital"];`,
    `  way(around:${radius},${lat},${lon})["amenity"="hospital"];`,
    `  relation(around:${radius},${lat},${lon})["amenity"="hospital"];`,
    `  node(around:${radius},${lat},${lon})["healthcare"="hospital"];`,
    `  way(around:${radius},${lat},${lon})["healthcare"="hospital"];`,
    `  relation(around:${radius},${lat},${lon})["healthcare"="hospital"];`,
    `  node(around:${radius},${lat},${lon})["amenity"="police"];`,
    `  way(around:${radius},${lat},${lon})["amenity"="police"];`,
    `  relation(around:${radius},${lat},${lon})["amenity"="police"];`,
    `  node(around:${radius},${lat},${lon})["amenity"="fire_station"];`,
    `  way(around:${radius},${lat},${lon})["amenity"="fire_station"];`,
    `  relation(around:${radius},${lat},${lon})["amenity"="fire_station"];`,
    `  node(around:${radius},${lat},${lon})["amenity"="pharmacy"];`,
    `  way(around:${radius},${lat},${lon})["amenity"="pharmacy"];`,
    `  relation(around:${radius},${lat},${lon})["amenity"="pharmacy"];`,
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
      `  node(around:${radius},${lat},${lon})["amenity"="hospital"];`,
      `  node(around:${radius},${lat},${lon})["healthcare"="hospital"];`,
      `  node(around:${radius},${lat},${lon})["amenity"="police"];`,
      `  node(around:${radius},${lat},${lon})["amenity"="fire_station"];`,
      `  node(around:${radius},${lat},${lon})["amenity"="pharmacy"];`,
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

function isProviderFailure(error) {
  return Boolean(error && [
    'OVERPASS_TIMEOUT',
    'OVERPASS_UNAVAILABLE',
    'OVERPASS_INVALID_PAYLOAD',
  ].includes(error.code));
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

function mapTagsToCategory(tags) {
  if (tags.emergency === 'assembly_point') {
    return CATEGORY_METADATA.assembly_point;
  }

  if (tags.amenity === 'shelter') {
    return CATEGORY_METADATA.shelter;
  }

  if (tags.amenity === 'hospital' || tags.healthcare === 'hospital') {
    return CATEGORY_METADATA.hospital;
  }

  if (tags.amenity === 'police') {
    return CATEGORY_METADATA.police;
  }

  if (tags.amenity === 'fire_station') {
    return CATEGORY_METADATA.fire_station;
  }

  if (tags.amenity === 'pharmacy') {
    return CATEGORY_METADATA.pharmacy;
  }

  return CATEGORY_METADATA.other;
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
  const category = mapTagsToCategory(tags);

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
      category: category.key,
      categoryLabel: category.label,
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
    features: selectBalancedFeatures(features, limit),
  };
}

function selectBalancedFeatures(sortedFeatures, limit) {
  const cappedLimit = Math.max(0, limit);
  if (cappedLimit === 0 || sortedFeatures.length <= cappedLimit) {
    return sortedFeatures.slice(0, cappedLimit);
  }

  const groups = new Map();
  for (const feature of sortedFeatures) {
    const category = feature.properties && feature.properties.category
      ? feature.properties.category
      : 'other';
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category).push(feature);
  }

  const categoriesByNearest = [...groups.entries()]
    .sort((left, right) => left[1][0].properties.distanceMeters - right[1][0].properties.distanceMeters);
  const selected = [];
  const selectedIds = new Set();
  const perCategoryTarget = Math.min(
    3,
    Math.max(1, Math.floor(cappedLimit / Math.max(categoriesByNearest.length, 1))),
  );

  for (let round = 0; round < perCategoryTarget && selected.length < cappedLimit; round += 1) {
    for (const [, categoryFeatures] of categoriesByNearest) {
      const feature = categoryFeatures[round];
      if (!feature || selected.length >= cappedLimit) {
        continue;
      }
      const featureKey = getFeatureSelectionKey(feature);
      if (selectedIds.has(featureKey)) {
        continue;
      }
      selectedIds.add(featureKey);
      selected.push(feature);
    }
  }

  for (const feature of sortedFeatures) {
    if (selected.length >= cappedLimit) {
      break;
    }
    const featureKey = getFeatureSelectionKey(feature);
    if (selectedIds.has(featureKey)) {
      continue;
    }
    selectedIds.add(featureKey);
    selected.push(feature);
  }

  return selected.sort((left, right) => left.properties.distanceMeters - right.properties.distanceMeters);
}

function getFeatureSelectionKey(feature) {
  const properties = feature.properties || {};
  if (properties.id) {
    return `${properties.osmType || 'unknown'}:${properties.id}`;
  }

  const coordinates = feature.geometry && Array.isArray(feature.geometry.coordinates)
    ? feature.geometry.coordinates.join(':')
    : 'unknown';
  return `coordinates:${coordinates}`;
}

function toFallbackFeatureCollection() {
  return {
    type: 'FeatureCollection',
    features: [],
  };
}

function withSource(result, source, extraMeta = {}) {
  return {
    ...result,
    source,
    meta: {
      ...result.meta,
      ...extraMeta,
    },
  };
}

function buildCategoryMetadata() {
  return Object.values(CATEGORY_METADATA);
}

async function fetchNearbyFromOverpassUrl(queryText, url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(url, {
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

async function fetchNearbyFromOverpassWithQuery(queryText) {
  let lastError = null;

  for (const url of getOverpassUrls()) {
    try {
      return await fetchNearbyFromOverpassUrl(queryText, url);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function fetchNearbyFromOverpass(params) {
  try {
    return await fetchNearbyFromOverpassWithQuery(buildOverpassQuery(params));
  } catch (error) {
    const shouldRetryWithLightweightQuery =
      error &&
      (error.code === 'OVERPASS_UNAVAILABLE' || error.code === 'OVERPASS_TIMEOUT');

    if (!shouldRetryWithLightweightQuery) {
      throw error;
    }

    return fetchNearbyFromOverpassWithQuery(buildOverpassLightweightQuery(params));
  }
}

async function getNearbyGatheringAreas(params) {
  const cacheKey = buildCacheKey(params);
  const cached = readFreshCache(cacheKey);
  if (cached) {
    return cached;
  }

  try {
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
        categories: buildCategoryMetadata(),
      },
      collection,
    };

    writeToCache(cacheKey, result);
    return result;
  } catch (error) {
    if (!isProviderFailure(error)) {
      throw error;
    }

    const staleCached = readStaleCache(cacheKey);
    if (staleCached) {
      return withSource(staleCached, 'stale_cache', {
        stale: true,
        providerErrorCode: error.code,
      });
    }

    const collection = toFallbackFeatureCollection();
    return {
      center: {
        lat: params.lat,
        lon: params.lon,
      },
      radius: params.radius,
      source: 'fallback',
      meta: {
        requestedLimit: params.limit,
        returnedCount: collection.features.length,
        providerErrorCode: error.code,
        fallbackReason: FALLBACK_REASON,
        categories: buildCategoryMetadata(),
      },
      collection,
    };
  }
}

function __resetNearbyCache() {
  nearbyCache.clear();
}

module.exports = {
  getNearbyGatheringAreas,
  __resetNearbyCache,
};
