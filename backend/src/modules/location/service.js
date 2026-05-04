const DEFAULT_NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const DEFAULT_TIMEOUT_MS = 4500;
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CACHE_MAX_ENTRIES = 500;

const citiesDataset = require('./data/sehirler.json');
const districtsDataset = require('./data/ilceler.json');
const neighborhoodsPart1 = require('./data/mahalleler-1.json');
const neighborhoodsPart2 = require('./data/mahalleler-2.json');
const neighborhoodsPart3 = require('./data/mahalleler-3.json');
const neighborhoodsPart4 = require('./data/mahalleler-4.json');

// Process-local cache for geocoder reads.
// Purpose: cut repeated provider calls for identical short-term queries.
// Scope: current Node.js process only (reset on restart, not shared across replicas).
const locationCache = new Map();

function toSlug(value) {
	if (typeof value !== 'string') {
		return '';
	}

	return value
		.toLocaleLowerCase('tr-TR')
		.replace(/ı/g, 'i')
		.replace(/ğ/g, 'g')
		.replace(/ü/g, 'u')
		.replace(/ş/g, 's')
		.replace(/ö/g, 'o')
		.replace(/ç/g, 'c')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function asArray(value) {
	return Array.isArray(value) ? value : [];
}

function mergeNeighborhoodDatasets() {
	return [
		...asArray(neighborhoodsPart1),
		...asArray(neighborhoodsPart2),
		...asArray(neighborhoodsPart3),
		...asArray(neighborhoodsPart4),
	];
}

function dedupeNeighborhoods(neighborhoods) {
	const seen = new Set();
	const output = [];

	for (const item of neighborhoods) {
		if (!item || typeof item.label !== 'string' || typeof item.value !== 'string') {
			continue;
		}

		const key = `${item.value}|${item.label}`;
		if (seen.has(key)) {
			continue;
		}

		seen.add(key);
		output.push(item);
	}

	return output;
}

function buildUniqueKey(existingMap, preferredKey, fallbackId, fallbackPrefix) {
	const normalizedPreferred = typeof preferredKey === 'string' ? preferredKey : '';
	const normalizedFallbackId = typeof fallbackId === 'string' ? fallbackId : '';
	const baseKey = normalizedPreferred || `${fallbackPrefix}-${normalizedFallbackId || 'unknown'}`;

	if (!Object.prototype.hasOwnProperty.call(existingMap, baseKey)) {
		return baseKey;
	}

	const collisionSuffix = normalizedFallbackId || 'dup';
	let candidate = `${baseKey}-${collisionSuffix}`;
	let sequence = 2;

	while (Object.prototype.hasOwnProperty.call(existingMap, candidate)) {
		candidate = `${baseKey}-${collisionSuffix}-${sequence}`;
		sequence += 1;
	}

	return candidate;
}

function buildLocationTreeFromDatasets() {
	const cities = asArray(citiesDataset);
	const districts = asArray(districtsDataset);
	const neighborhoods = mergeNeighborhoodDatasets();

	if (cities.length === 0 || districts.length === 0) {
		return null;
	}

	const neighborhoodsByDistrictId = new Map();

	for (const neighborhood of neighborhoods) {
		if (!neighborhood || typeof neighborhood.ilce_id !== 'string' || typeof neighborhood.mahalle_adi !== 'string') {
			continue;
		}

		if (!neighborhoodsByDistrictId.has(neighborhood.ilce_id)) {
			neighborhoodsByDistrictId.set(neighborhood.ilce_id, []);
		}

		neighborhoodsByDistrictId.get(neighborhood.ilce_id).push({
			label: neighborhood.mahalle_adi,
			value: toSlug(neighborhood.mahalle_adi),
		});
	}

	const districtsByCityId = new Map();

	for (const district of districts) {
		if (!district || typeof district.sehir_id !== 'string' || typeof district.ilce_id !== 'string' || typeof district.ilce_adi !== 'string') {
			continue;
		}

		if (!districtsByCityId.has(district.sehir_id)) {
			districtsByCityId.set(district.sehir_id, []);
		}

		districtsByCityId.get(district.sehir_id).push(district);
	}

	const treeCities = {};

	for (const city of cities) {
		if (!city || typeof city.sehir_id !== 'string' || typeof city.sehir_adi !== 'string') {
			continue;
		}

		const cityKey = toSlug(city.sehir_adi);
		const cityDistricts = districtsByCityId.get(city.sehir_id) || [];
		const mappedDistricts = {};

		for (const district of cityDistricts) {
			const districtKey = buildUniqueKey(
				mappedDistricts,
				toSlug(district.ilce_adi),
				district.ilce_id,
				'district',
			);
			const districtNeighborhoods = dedupeNeighborhoods(neighborhoodsByDistrictId.get(district.ilce_id) || []);

			mappedDistricts[districtKey] = {
				label: district.ilce_adi,
				neighborhoods: districtNeighborhoods,
			};
		}

		const uniqueCityKey = buildUniqueKey(treeCities, cityKey, city.sehir_id, 'city');

		treeCities[uniqueCityKey] = {
			label: city.sehir_adi,
			districts: mappedDistricts,
		};
	}

	if (Object.keys(treeCities).length === 0) {
		return null;
	}

	return {
		TR: {
			label: 'Turkey',
			cities: treeCities,
		},
	};
}

const staticLocationTree = buildLocationTreeFromDatasets();

function buildTreeMeta(tree) {
	if (!tree || typeof tree !== 'object') {
		return null;
	}

	const cities = tree.cities && typeof tree.cities === 'object' ? tree.cities : {};
	const cityEntries = Object.values(cities);

	let districtCount = 0;
	let neighborhoodCount = 0;

	for (const city of cityEntries) {
		const districts = city && city.districts && typeof city.districts === 'object' ? city.districts : {};
		const districtEntries = Object.values(districts);
		districtCount += districtEntries.length;

		for (const district of districtEntries) {
			const neighborhoods = district && Array.isArray(district.neighborhoods) ? district.neighborhoods : [];
			neighborhoodCount += neighborhoods.length;
		}
	}

	return {
		cityCount: cityEntries.length,
		districtCount,
		neighborhoodCount,
	};
}

const locationTreeMeta = staticLocationTree
	? Object.fromEntries(
		Object.entries(staticLocationTree).map(([countryCode, tree]) => [countryCode, buildTreeMeta(tree)]),
	)
	: null;

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
			extraAddress: [
				address.road || address.pedestrian || address.footway || address.path || '',
				address.house_number || '',
			]
				.filter(Boolean)
				.join(' ')
				.trim(),
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
	if (!staticLocationTree) {
		const error = new Error('LOCATION_TREE_UNAVAILABLE');
		error.code = 'LOCATION_TREE_UNAVAILABLE';
		throw error;
	}

	return staticLocationTree[countryCode] || null;
}

async function getLocationTreeMeta(countryCode) {
	if (!locationTreeMeta) {
		const error = new Error('LOCATION_TREE_UNAVAILABLE');
		error.code = 'LOCATION_TREE_UNAVAILABLE';
		throw error;
	}

	return locationTreeMeta[countryCode] || null;
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
	getLocationTreeMeta,
	searchLocations,
	reverseGeocode,
	__resetLocationCache,
};
