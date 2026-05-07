const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_TITLE_LENGTH = 500;
const MAX_CONTENT_LENGTH = 10000;
const MAX_ID_LENGTH = 64;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateRequiredString(name, value, errors, { maxLength }) {
  if (value == null) {
    errors.push(`\`${name}\` is required.`);
    return '';
  }

  if (typeof value !== 'string') {
    errors.push(`\`${name}\` must be a string.`);
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    errors.push(`\`${name}\` must not be empty.`);
    return '';
  }

  if (trimmed.length > maxLength) {
    errors.push(`\`${name}\` must be ${maxLength} characters or fewer.`);
  }

  return trimmed;
}

function validateOptionalString(name, value, errors, { maxLength }) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    errors.push(`\`${name}\` must be a string.`);
    return undefined;
  }

  if (typeof value !== 'string') {
    errors.push(`\`${name}\` must be a string.`);
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    errors.push(`\`${name}\` must not be empty.`);
    return undefined;
  }

  if (trimmed.length > maxLength) {
    errors.push(`\`${name}\` must be ${maxLength} characters or fewer.`);
  }

  return trimmed;
}

function validateListAnnouncementsQuery(query) {
  const limitValue = query?.limit;

  if (limitValue == null || limitValue === '') {
    return { errors: [], value: { limit: DEFAULT_LIMIT } };
  }

  const limit = Number.parseInt(String(limitValue), 10);
  if (!Number.isInteger(limit) || String(limitValue).trim() !== String(limit) || limit < 1 || limit > MAX_LIMIT) {
    return {
      errors: [`\`limit\` must be an integer between 1 and ${MAX_LIMIT}.`],
      value: null,
    };
  }

  return { errors: [], value: { limit } };
}

function validateAnnouncementIdParam(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return {
      errors: ['`announcementId` is required.'],
      value: null,
    };
  }

  const trimmed = value.trim();
  if (trimmed.length > MAX_ID_LENGTH) {
    return {
      errors: [`\`announcementId\` must be ${MAX_ID_LENGTH} characters or fewer.`],
      value: null,
    };
  }

  return { errors: [], value: trimmed };
}

function validateCreateAnnouncementPayload(payload) {
  const errors = [];

  if (!isPlainObject(payload)) {
    return {
      errors: ['Payload must be an object.'],
      value: null,
    };
  }

  const title = validateRequiredString('title', payload.title, errors, { maxLength: MAX_TITLE_LENGTH });
  const content = validateRequiredString('content', payload.content, errors, { maxLength: MAX_CONTENT_LENGTH });

  return {
    errors,
    value: errors.length > 0 ? null : { title, content },
  };
}

function validateUpdateAnnouncementPayload(payload) {
  const errors = [];

  if (!isPlainObject(payload)) {
    return {
      errors: ['Payload must be an object.'],
      value: null,
    };
  }

  const title = validateOptionalString('title', payload.title, errors, { maxLength: MAX_TITLE_LENGTH });
  const content = validateOptionalString('content', payload.content, errors, { maxLength: MAX_CONTENT_LENGTH });

  if (title === undefined && content === undefined) {
    errors.push('At least one of `title` or `content` is required.');
  }

  const value = {};
  if (title !== undefined) {
    value.title = title;
  }
  if (content !== undefined) {
    value.content = content;
  }

  return {
    errors,
    value: errors.length > 0 ? null : value,
  };
}

module.exports = {
  validateAnnouncementIdParam,
  validateCreateAnnouncementPayload,
  validateListAnnouncementsQuery,
  validateUpdateAnnouncementPayload,
};
