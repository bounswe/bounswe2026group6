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
};
