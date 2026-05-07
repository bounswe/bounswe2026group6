const ALLOWED_STATUSES = new Set(['safe', 'not_safe', 'unknown']);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeStatus(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toLowerCase();
}

function validateOptionalString(fieldName, value, errors, { maxLength = 255 } = {}) {
  if (value == null) {
    return null;
  }

  if (typeof value !== 'string') {
    errors.push(`\`${fieldName}\` must be a string.`);
    return null;
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    errors.push(`\`${fieldName}\` must be ${maxLength} characters or fewer.`);
  }

  return normalized || null;
}

function validateCoordinate(payload, errors) {
  if (!Object.prototype.hasOwnProperty.call(payload, 'location')) {
    return {
      latitude: undefined,
      longitude: undefined,
      accuracyMeters: undefined,
      source: undefined,
      capturedAt: undefined,
    };
  }

  const { location } = payload;
  if (location == null) {
    return {
      latitude: null,
      longitude: null,
      accuracyMeters: null,
      source: null,
      capturedAt: null,
    };
  }

  if (!isPlainObject(location)) {
    errors.push('`location` must be an object or null.');
    return {};
  }

  const latitude = location.latitude;
  const longitude = location.longitude;
  const latitudeProvided = Object.prototype.hasOwnProperty.call(location, 'latitude');
  const longitudeProvided = Object.prototype.hasOwnProperty.call(location, 'longitude');

  if (latitudeProvided !== longitudeProvided) {
    errors.push('`location.latitude` and `location.longitude` must be provided together.');
  }

  if (latitudeProvided && latitude !== null && (typeof latitude !== 'number' || latitude < -90 || latitude > 90)) {
    errors.push('`location.latitude` must be a number between -90 and 90.');
  }

  if (longitudeProvided && longitude !== null && (typeof longitude !== 'number' || longitude < -180 || longitude > 180)) {
    errors.push('`location.longitude` must be a number between -180 and 180.');
  }

  if ((latitude === null) !== (longitude === null)) {
    errors.push('`location.latitude` and `location.longitude` must both be null or both be numbers.');
  }

  let accuracyMeters;
  if (Object.prototype.hasOwnProperty.call(location, 'accuracyMeters')) {
    if (location.accuracyMeters !== null && (typeof location.accuracyMeters !== 'number' || location.accuracyMeters < 0)) {
      errors.push('`location.accuracyMeters` must be a number greater than or equal to 0.');
    } else {
      accuracyMeters = location.accuracyMeters;
    }
  }

  const source = Object.prototype.hasOwnProperty.call(location, 'source')
    ? validateOptionalString('location.source', location.source, errors, { maxLength: 100 })
    : undefined;
  const capturedAt = Object.prototype.hasOwnProperty.call(location, 'capturedAt')
    ? validateOptionalString('location.capturedAt', location.capturedAt, errors, { maxLength: 80 })
    : undefined;

  return {
    latitude: latitudeProvided ? latitude : undefined,
    longitude: longitudeProvided ? longitude : undefined,
    accuracyMeters,
    source,
    capturedAt,
  };
}

function validateSafetyStatusPatch(payload) {
  const errors = [];

  if (!isPlainObject(payload)) {
    return {
      errors: ['Payload must be an object.'],
      value: null,
    };
  }

  const hasStatus = Object.prototype.hasOwnProperty.call(payload, 'status');
  const status = hasStatus ? normalizeStatus(payload.status) : undefined;
  if (hasStatus && !ALLOWED_STATUSES.has(status)) {
    errors.push('`status` must be one of: safe, not_safe, unknown.');
  }

  let shareLocationConsent;
  if (Object.prototype.hasOwnProperty.call(payload, 'shareLocationConsent')) {
    if (typeof payload.shareLocationConsent !== 'boolean') {
      errors.push('`shareLocationConsent` must be a boolean.');
    } else {
      shareLocationConsent = payload.shareLocationConsent;
    }
  }

  const note = Object.prototype.hasOwnProperty.call(payload, 'note')
    ? validateOptionalString('note', payload.note, errors, { maxLength: 500 })
    : undefined;
  const location = validateCoordinate(payload, errors);

  return {
    errors,
    value: {
      status,
      note,
      shareLocationConsent,
      location,
      hasStatus,
      hasNote: Object.prototype.hasOwnProperty.call(payload, 'note'),
      hasShareLocationConsent: Object.prototype.hasOwnProperty.call(payload, 'shareLocationConsent'),
      hasLocation: Object.prototype.hasOwnProperty.call(payload, 'location'),
    },
  };
}

module.exports = {
  validateSafetyStatusPatch,
};
