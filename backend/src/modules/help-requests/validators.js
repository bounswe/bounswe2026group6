function readUserId(request) {
  if (request.user && request.user.userId) {
    return request.user.userId;
  }

  const isDevelopment = process.env.NODE_ENV === 'development';

  if (
    isDevelopment
    && typeof request.headers['x-user-id'] === 'string'
    && request.headers['x-user-id'].trim() !== ''
  ) {
    return request.headers['x-user-id'].trim();
  }

  return null;
}

function isBoolean(value) {
  return typeof value === 'boolean';
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeOptionalString(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function validateStringArray(fieldName, value, errors, { required = false } = {}) {
  if (value == null) {
    if (required) {
      errors.push(`\`${fieldName}\` is required.`);
    }

    return [];
  }

  if (!Array.isArray(value)) {
    errors.push(`\`${fieldName}\` must be an array of strings.`);
    return [];
  }

  const normalized = [];

  value.forEach((entry, index) => {
    if (typeof entry !== 'string') {
      errors.push(`\`${fieldName}[${index}]\` must be a string.`);
      return;
    }

    const trimmed = entry.trim();

    if (!trimmed) {
      errors.push(`\`${fieldName}[${index}]\` must not be empty.`);
      return;
    }

    if (trimmed.length > 100) {
      errors.push(`\`${fieldName}[${index}]\` must be 100 characters or fewer.`);
      return;
    }

    normalized.push(trimmed);
  });

  if (required && normalized.length === 0) {
    errors.push(`\`${fieldName}\` must contain at least one item.`);
  }

  return normalized;
}

function validateRequiredString(fieldName, value, errors, { maxLength = 255 } = {}) {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    errors.push(`\`${fieldName}\` is required.`);
    return '';
  }

  if (normalized.length > maxLength) {
    errors.push(`\`${fieldName}\` must be ${maxLength} characters or fewer.`);
  }

  return normalized;
}

function validateOptionalString(fieldName, value, errors, { maxLength = 255 } = {}) {
  if (value == null) {
    return '';
  }

  if (typeof value !== 'string') {
    errors.push(`\`${fieldName}\` must be a string.`);
    return '';
  }

  const normalized = value.trim();

  if (normalized.length > maxLength) {
    errors.push(`\`${fieldName}\` must be ${maxLength} characters or fewer.`);
  }

  return normalized;
}

function isValidTurkishMobileNumber(value) {
  return Number.isInteger(value) && value >= 5000000000 && value <= 5999999999;
}

function validateRequiredPhoneNumber(fieldName, value, errors) {
  if (!isValidTurkishMobileNumber(value)) {
    errors.push(`\`${fieldName}\` must be a 10-digit integer starting with 5.`);
    return null;
  }

  return value;
}

function validateOptionalPhoneNumber(fieldName, value, errors) {
  if (value == null) {
    return null;
  }

  if (!isValidTurkishMobileNumber(value)) {
    errors.push(`\`${fieldName}\` must be a 10-digit integer starting with 5.`);
    return null;
  }

  return value;
}

function validateCreateHelpRequest(payload) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(payload)) {
    return {
      errors: ['Payload must be an object.'],
      warnings,
      value: null,
    };
  }

  const helpTypes = validateStringArray('helpTypes', payload.helpTypes, errors, { required: true });
  const otherHelpText = validateOptionalString('otherHelpText', payload.otherHelpText, errors, {
    maxLength: 500,
  });

  let affectedPeopleCount = null;
  if (!Number.isInteger(payload.affectedPeopleCount) || payload.affectedPeopleCount < 1) {
    errors.push('`affectedPeopleCount` must be an integer greater than or equal to 1.');
  } else {
    affectedPeopleCount = payload.affectedPeopleCount;
  }

  const riskFlags = validateStringArray('riskFlags', payload.riskFlags, errors);
  const vulnerableGroups = validateStringArray('vulnerableGroups', payload.vulnerableGroups, errors);
  const description = validateRequiredString('description', payload.description, errors, {
    maxLength: 2000,
  });
  const bloodType = validateOptionalString('bloodType', payload.bloodType, errors, {
    maxLength: 10,
  });

  let consentGiven = false;
  if (!isBoolean(payload.consentGiven)) {
    errors.push('`consentGiven` must be a boolean.');
  } else if (!payload.consentGiven) {
    errors.push('`consentGiven` must be true.');
  } else {
    consentGiven = true;
  }

  let location = null;
  if (!isPlainObject(payload.location)) {
    errors.push('`location` is required and must be an object.');
  } else {
    location = {
      country: validateRequiredString('location.country', payload.location.country, errors, {
        maxLength: 100,
      }),
      city: validateRequiredString('location.city', payload.location.city, errors, {
        maxLength: 100,
      }),
      district: validateRequiredString('location.district', payload.location.district, errors, {
        maxLength: 100,
      }),
      neighborhood: validateRequiredString('location.neighborhood', payload.location.neighborhood, errors, {
        maxLength: 100,
      }),
      extraAddress: validateOptionalString('location.extraAddress', payload.location.extraAddress, errors, {
        maxLength: 500,
      }),
    };
  }

  let contact = null;
  if (!isPlainObject(payload.contact)) {
    errors.push('`contact` is required and must be an object.');
  } else {
    contact = {
      fullName: validateRequiredString('contact.fullName', payload.contact.fullName, errors, {
        maxLength: 200,
      }),
      phone: validateRequiredPhoneNumber('contact.phone', payload.contact.phone, errors),
      alternativePhone: validateOptionalPhoneNumber(
        'contact.alternativePhone',
        payload.contact.alternativePhone,
        errors,
      ),
    };
  }

  return {
    errors,
    warnings,
    value: {
      helpTypes,
      otherHelpText,
      affectedPeopleCount,
      riskFlags,
      vulnerableGroups,
      description,
      bloodType,
      location,
      contact,
      consentGiven,
      needType: helpTypes[0] || 'general',
      isSavedLocally: false,
    },
  };
}

function validateHelpRequestStatusUpdate(payload) {
  const errors = [];
  const status = typeof payload.status === 'string' ? payload.status.trim().toUpperCase() : '';
  const allowedStatuses = ['SYNCED', 'RESOLVED', 'CANCELLED'];

  if (!allowedStatuses.includes(status)) {
    errors.push('`status` must be one of: SYNCED, RESOLVED, CANCELLED.');
  }

  return {
    errors,
    value: {
      status,
    },
  };
}

module.exports = {
  readUserId,
  validateCreateHelpRequest,
  validateHelpRequestStatusUpdate,
};
