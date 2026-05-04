function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function normalizeOptionalString(fieldName, value) {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }

  if (typeof value !== 'string') {
    return { ok: false, message: `${fieldName} must be a string or null` };
  }

  const normalized = value.trim();
  return { ok: true, value: normalized || null };
}

function normalizeOptionalTimestamp(fieldName, value) {
  const stringResult = normalizeOptionalString(fieldName, value);
  if (!stringResult.ok || stringResult.value === null) {
    return stringResult;
  }

  const parsedMs = Date.parse(stringResult.value);
  if (Number.isNaN(parsedMs)) {
    return { ok: false, message: `${fieldName} must be a valid timestamp or null` };
  }

  return { ok: true, value: new Date(parsedMs).toISOString() };
}

function validateOperationalLocationPatch(body) {
  if (!isPlainObject(body)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Payload must be an object' };
  }

  if (Object.keys(body).length === 0) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'latitude and longitude are required' };
  }

  if (!hasOwn(body, 'latitude') || !hasOwn(body, 'longitude')) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'latitude and longitude are required' };
  }

  if (typeof body.latitude !== 'number' || !Number.isFinite(body.latitude) || body.latitude < -90 || body.latitude > 90) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'latitude must be a number between -90 and 90' };
  }

  if (typeof body.longitude !== 'number' || !Number.isFinite(body.longitude) || body.longitude < -180 || body.longitude > 180) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'longitude must be a number between -180 and 180' };
  }

  if (
    hasOwn(body, 'accuracyMeters')
    && body.accuracyMeters !== null
    && (typeof body.accuracyMeters !== 'number' || !Number.isFinite(body.accuracyMeters) || body.accuracyMeters < 0)
  ) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'accuracyMeters must be a number >= 0 or null' };
  }

  const source = hasOwn(body, 'source')
    ? normalizeOptionalString('source', body.source)
    : { ok: true, value: null };
  if (!source.ok) {
    return { ok: false, code: 'VALIDATION_ERROR', message: source.message };
  }

  if (source.value !== null && source.value.length > 100) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'source must be at most 100 characters' };
  }

  const capturedAt = hasOwn(body, 'capturedAt')
    ? normalizeOptionalTimestamp('capturedAt', body.capturedAt)
    : { ok: true, value: null };
  if (!capturedAt.ok) {
    return { ok: false, code: 'VALIDATION_ERROR', message: capturedAt.message };
  }

  return {
    ok: true,
    data: {
      latitude: body.latitude,
      longitude: body.longitude,
      accuracyMeters: hasOwn(body, 'accuracyMeters') ? body.accuracyMeters : null,
      source: source.value,
      capturedAt: capturedAt.value,
    },
  };
}

module.exports = {
  validateOperationalLocationPatch,
};
