function parseLimit(value, fallback, max) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return Math.min(parsed, max);
}

const MAX_SEARCH_QUERY_LENGTH = 120;

function readString(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function validateTreeQuery(query) {
  const countryCode = readString(query.countryCode || 'TR').toUpperCase();

  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'countryCode must be a 2-letter ISO code',
    };
  }

  return {
    ok: true,
    value: {
      countryCode,
    },
  };
}

function validateSearchQuery(query) {
  const q = readString(query.q);
  if (q.length < 2) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'q must be at least 2 characters long',
    };
  }

  if (q.length > MAX_SEARCH_QUERY_LENGTH) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: `q must be at most ${MAX_SEARCH_QUERY_LENGTH} characters long`,
    };
  }

  const countryCode = readString(query.countryCode || 'TR').toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'countryCode must be a 2-letter ISO code',
    };
  }

  const limit = parseLimit(query.limit, 10, 20);
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
      q,
      countryCode,
      limit,
    },
  };
}

function validateReverseQuery(query) {
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

  return {
    ok: true,
    value: {
      lat,
      lon,
    },
  };
}

module.exports = {
  validateTreeQuery,
  validateSearchQuery,
  validateReverseQuery,
};
