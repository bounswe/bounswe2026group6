function isBoolean(value) {
  return typeof value === 'boolean';
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateCreateHelpRequest(payload) {
  const errors = [];
  const warnings = [];

  const needType = typeof payload.needType === 'string' ? payload.needType.trim() : '';

  if (!needType) {
    errors.push('`needType` is required.');
  }

  let description = null;

  if (typeof payload.description === 'string') {
    const trimmedDescription = payload.description.trim();

    if (trimmedDescription) {
      description = trimmedDescription;
    }
  }

  const isSavedLocally = isBoolean(payload.isSavedLocally)
    ? payload.isSavedLocally
    : false;

  let location = null;

  if (payload.location == null) {
    warnings.push('Location was not provided; the request was created without request coordinates.');
  } else if (typeof payload.location !== 'object' || Array.isArray(payload.location)) {
    errors.push('`location` must be an object when provided.');
  } else {
    const { latitude, longitude, isGpsLocation, isLastKnown } = payload.location;

    if (!isFiniteNumber(latitude) || latitude < -90 || latitude > 90) {
      errors.push('`location.latitude` must be a number between -90 and 90.');
    }

    if (!isFiniteNumber(longitude) || longitude < -180 || longitude > 180) {
      errors.push('`location.longitude` must be a number between -180 and 180.');
    }

    if (errors.length === 0) {
      location = {
        latitude,
        longitude,
        isGpsLocation: isBoolean(isGpsLocation) ? isGpsLocation : false,
        isLastKnown: isBoolean(isLastKnown) ? isLastKnown : false,
      };
    }
  }

  return {
    errors,
    warnings,
    value: {
      needType,
      description,
      isSavedLocally,
      location,
    },
  };
}

module.exports = {
  validateCreateHelpRequest,
};
