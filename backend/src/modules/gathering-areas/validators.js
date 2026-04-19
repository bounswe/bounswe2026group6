const DEFAULT_RADIUS_METERS = 2000;
const MAX_RADIUS_METERS = 10000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

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

module.exports = {
  validateNearbyQuery,
};
