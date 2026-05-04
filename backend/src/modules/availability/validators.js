const setAvailabilitySchema = {
  isAvailable: {
    type: 'boolean',
    required: true,
  },
  latitude: {
    type: 'number',
    required: false,
  },
  longitude: {
    type: 'number',
    required: false,
  },
};

const syncAvailabilitySchema = {
  records: {
    type: 'array',
    required: true,
    items: {
      type: 'object',
      properties: {
        isAvailable: { type: 'boolean', required: true },
        timestamp: { type: 'string', required: true },
        latitude: { type: 'number', required: false },
        longitude: { type: 'number', required: false },
      },
    },
  },
};

const resolveRequestSchema = {
  requestId: {
    type: 'string',
    required: true,
  },
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function validateCoordinatePair(data, errors, prefix = '') {
  const latitudeKey = prefix ? `${prefix}.latitude` : 'latitude';
  const longitudeKey = prefix ? `${prefix}.longitude` : 'longitude';
  const latitudeProvided = hasOwn(data, 'latitude');
  const longitudeProvided = hasOwn(data, 'longitude');

  if (latitudeProvided !== longitudeProvided) {
    errors.push(`${latitudeKey} and ${longitudeKey} must be provided together`);
    return;
  }

  if (!latitudeProvided) {
    return;
  }

  if (typeof data.latitude !== 'number' || !Number.isFinite(data.latitude) || data.latitude < -90 || data.latitude > 90) {
    errors.push(`${latitudeKey} must be a finite number between -90 and 90`);
  }

  if (typeof data.longitude !== 'number' || !Number.isFinite(data.longitude) || data.longitude < -180 || data.longitude > 180) {
    errors.push(`${longitudeKey} must be a finite number between -180 and 180`);
  }
}

function validateSetAvailabilityPayload(data) {
  const errors = validate(data, setAvailabilitySchema);
  validateCoordinatePair(data || {}, errors);
  return errors;
}

function validateSyncAvailabilityPayload(data) {
  const errors = [];

  if (!isPlainObject(data)) {
    return ['payload must be an object'];
  }

  if (!Array.isArray(data.records)) {
    return ['records must be an array'];
  }

  data.records.forEach((record, index) => {
    const prefix = `records[${index}]`;

    if (!isPlainObject(record)) {
      errors.push(`${prefix} must be an object`);
      return;
    }

    if (!hasOwn(record, 'isAvailable') || record.isAvailable === null) {
      errors.push(`${prefix}.isAvailable is required`);
    } else if (typeof record.isAvailable !== 'boolean') {
      errors.push(`${prefix}.isAvailable must be a boolean`);
    }

    if (!hasOwn(record, 'timestamp') || record.timestamp === null) {
      errors.push(`${prefix}.timestamp is required`);
    } else if (typeof record.timestamp !== 'string') {
      errors.push(`${prefix}.timestamp must be a string`);
    }

    validateCoordinatePair(record, errors, prefix);
  });

  return errors;
}

// Simple validator function to match the project's style
function validate(data, schema) {
  const errors = [];
  for (const [key, rules] of Object.entries(schema)) {
    const value = data[key];
    if (rules.required && (value === undefined || value === null)) {
      errors.push(`${key} is required`);
      continue;
    }
    if (value !== undefined && value !== null) {
      if (rules.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`${key} must be a boolean`);
      }
      if (rules.type === 'number' && typeof value !== 'number') {
        errors.push(`${key} must be a number`);
      }
      if (rules.type === 'string' && typeof value !== 'string') {
        errors.push(`${key} must be a string`);
      }
      if (rules.type === 'array' && !Array.isArray(value)) {
        errors.push(`${key} must be an array`);
      }
    }
  }
  return errors;
}

module.exports = {
  setAvailabilitySchema,
  syncAvailabilitySchema,
  resolveRequestSchema,
  validate,
  validateSetAvailabilityPayload,
  validateSyncAvailabilityPayload,
};
