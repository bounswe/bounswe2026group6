const DEFAULT_RADIUS_METERS = 2000;
const MAX_RADIUS_METERS = 10000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_VIEWPORT_DIMENSION_KM = 50;

function parsePositiveInteger(value, fallback, max) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return Math.min(parsed, max);
}

function validateNearbyQuery(query) {
  const lat = Number(query.lat);
  const lon = Number(query.lon);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'lat must be a number between -90 and 90',
    };
  }

  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'lon must be a number between -180 and 180',
    };
  }

  const radius = parsePositiveInteger(query.radius, DEFAULT_RADIUS_METERS, MAX_RADIUS_METERS);
  if (radius === null) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'radius must be a positive integer',
    };
  }

  const limit = parsePositiveInteger(query.limit, DEFAULT_LIMIT, MAX_LIMIT);
  if (limit === null) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'limit must be a positive integer',
    };
  }

  return {
    ok: true,
    value: {
      lat,
      lon,
      radius,
      limit,
    },
  };
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function calculateDistanceKm(fromLat, fromLon, toLat, toLon) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(toLat - fromLat);
  const dLon = toRadians(toLon - fromLon);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseBbox(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  const parts = value.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 4) {
    return null;
  }

  if (parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  const [minLon, minLat, maxLon, maxLat] = parts;
  return { minLon, minLat, maxLon, maxLat };
}

function validateViewportQuery(query) {
  const bbox = parseBbox(query.bbox);
  if (!bbox) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'bbox must have 4 comma-separated values: minLng,minLat,maxLng,maxLat',
    };
  }

  if (bbox.minLon < -180 || bbox.maxLon > 180 || bbox.minLon > bbox.maxLon) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'bbox longitude values are invalid',
    };
  }

  if (bbox.minLat < -90 || bbox.maxLat > 90 || bbox.minLat > bbox.maxLat) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'bbox latitude values are invalid',
    };
  }

  const centerLat = (bbox.minLat + bbox.maxLat) / 2;
  const centerLon = (bbox.minLon + bbox.maxLon) / 2;
  const widthKm = calculateDistanceKm(centerLat, bbox.minLon, centerLat, bbox.maxLon);
  const heightKm = calculateDistanceKm(bbox.minLat, centerLon, bbox.maxLat, centerLon);
  const widestVisibleDimensionKm = Math.max(widthKm, heightKm);

  if (widestVisibleDimensionKm > MAX_VIEWPORT_DIMENSION_KM) {
    return {
      ok: false,
      code: 'VIEWPORT_TOO_LARGE',
      message: 'bbox viewport must be 50 km wide or smaller',
    };
  }

  const limit = parsePositiveInteger(query.limit, DEFAULT_LIMIT, MAX_LIMIT);
  if (limit === null) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'limit must be a positive integer',
    };
  }

  return {
    ok: true,
    value: {
      bbox,
      center: {
        lat: centerLat,
        lon: centerLon,
      },
      radius: Math.ceil(widestVisibleDimensionKm * 1000),
      limit,
      viewport: {
        widthKm,
        heightKm,
        widestVisibleDimensionKm,
      },
    },
  };
}

module.exports = {
  validateNearbyQuery,
  validateViewportQuery,
};
