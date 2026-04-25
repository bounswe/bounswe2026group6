const { NOTIFICATION_TYPES } = require('./constants');
const ALLOWED_PUSH_PLATFORMS = ['ANDROID', 'IOS', 'WEB'];
const ALLOWED_PUSH_PROVIDERS = ['FCM', 'APNS', 'WEB_PUSH'];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateOptionalString(name, value, errors, { maxLength = 255 } = {}) {
  if (value == null) {
    return null;
  }

  if (typeof value !== 'string') {
    errors.push(`\`${name}\` must be a string.`);
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    errors.push(`\`${name}\` must not be empty.`);
    return null;
  }

  if (trimmed.length > maxLength) {
    errors.push(`\`${name}\` must be ${maxLength} characters or fewer.`);
  }

  return trimmed;
}

function validateRequiredString(name, value, errors, options) {
  const normalized = validateOptionalString(name, value, errors, options);
  if (normalized === null) {
    errors.push(`\`${name}\` is required.`);
    return '';
  }

  return normalized;
}

function validateCreateNotificationPayload(payload) {
  const errors = [];

  if (!isPlainObject(payload)) {
    return {
      errors: ['Payload must be an object.'],
      value: null,
    };
  }

  const type = validateRequiredString('type', payload.type, errors, { maxLength: 100 });
  if (type && !NOTIFICATION_TYPES.includes(type)) {
    errors.push(`\`type\` must be one of: ${NOTIFICATION_TYPES.join(', ')}.`);
  }

  const title = validateRequiredString('title', payload.title, errors, { maxLength: 255 });
  const body = validateRequiredString('body', payload.body, errors, { maxLength: 2000 });
  const recipientUserId = validateOptionalString('recipientUserId', payload.recipientUserId, errors, { maxLength: 64 });
  const actorUserId = validateOptionalString('actorUserId', payload.actorUserId, errors, { maxLength: 64 });

  let data = {};
  if (payload.data !== undefined) {
    if (!isPlainObject(payload.data)) {
      errors.push('`data` must be an object.');
    } else {
      data = payload.data;
    }
  }

  let entity = null;
  if (payload.entity !== undefined) {
    if (!isPlainObject(payload.entity)) {
      errors.push('`entity` must be an object.');
    } else {
      const entityType = validateOptionalString('entity.type', payload.entity.type, errors, { maxLength: 100 });
      const entityId = validateOptionalString('entity.id', payload.entity.id, errors, { maxLength: 128 });

      if (entityType || entityId) {
        if (!entityType || !entityId) {
          errors.push('`entity.type` and `entity.id` must be provided together.');
        } else {
          entity = {
            type: entityType,
            id: entityId,
          };
        }
      }
    }
  }

  return {
    errors,
    value: {
      type,
      title,
      body,
      recipientUserId,
      actorUserId,
      entity,
      data,
    },
  };
}

function parseLimit(value) {
  if (value == null || value === '') {
    return 20;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed)) {
    return null;
  }

  if (parsed < 1 || parsed > 100) {
    return null;
  }

  return parsed;
}

function parseUnreadOnly(value) {
  if (value == null || value === '') {
    return false;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }

    if (normalized === 'false' || normalized === '0') {
      return false;
    }
  }

  return null;
}

function validateListNotificationsQuery(query) {
  const errors = [];
  const limit = parseLimit(query.limit);
  if (limit === null) {
    errors.push('`limit` must be an integer between 1 and 100.');
  }

  let cursor = null;
  if (query.cursor != null && query.cursor !== '') {
    if (typeof query.cursor !== 'string') {
      errors.push('`cursor` must be a string.');
    } else if (query.cursor.length > 512) {
      errors.push('`cursor` must be 512 characters or fewer.');
    } else {
      cursor = query.cursor;
    }
  }

  const unreadOnly = parseUnreadOnly(query.unreadOnly);
  if (unreadOnly === null) {
    errors.push('`unreadOnly` must be a boolean.');
  }

  return {
    errors,
    value: {
      limit: limit || 20,
      cursor,
      unreadOnly: unreadOnly === true,
    },
  };
}

function validateNotificationIdParam(notificationId) {
  if (typeof notificationId !== 'string') {
    return false;
  }

  const trimmed = notificationId.trim();
  return trimmed.length > 0 && trimmed.length <= 64;
}

function normalizeEnumValue(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toUpperCase();
}

function validateRegisterDevicePayload(payload) {
  const errors = [];

  if (!isPlainObject(payload)) {
    return {
      errors: ['Payload must be an object.'],
      value: null,
    };
  }

  const deviceToken = validateRequiredString('deviceToken', payload.deviceToken, errors, { maxLength: 512 });
  const platform = normalizeEnumValue(payload.platform);
  const providerRaw = payload.provider == null ? 'FCM' : payload.provider;
  const provider = normalizeEnumValue(providerRaw);

  if (!ALLOWED_PUSH_PLATFORMS.includes(platform)) {
    errors.push(`\`platform\` must be one of: ${ALLOWED_PUSH_PLATFORMS.join(', ')}.`);
  }

  if (!ALLOWED_PUSH_PROVIDERS.includes(provider)) {
    errors.push(`\`provider\` must be one of: ${ALLOWED_PUSH_PROVIDERS.join(', ')}.`);
  }

  return {
    errors,
    value: {
      deviceToken,
      platform,
      provider,
    },
  };
}

function validateUnregisterDevicePayload(payload) {
  const errors = [];

  if (!isPlainObject(payload)) {
    return {
      errors: ['Payload must be an object.'],
      value: null,
    };
  }

  const deviceToken = validateRequiredString('deviceToken', payload.deviceToken, errors, { maxLength: 512 });
  const providerRaw = payload.provider == null ? 'FCM' : payload.provider;
  const provider = normalizeEnumValue(providerRaw);

  if (!ALLOWED_PUSH_PROVIDERS.includes(provider)) {
    errors.push(`\`provider\` must be one of: ${ALLOWED_PUSH_PROVIDERS.join(', ')}.`);
  }

  return {
    errors,
    value: {
      deviceToken,
      provider,
    },
  };
}

function validateUpdatePreferencesPayload(payload) {
  const errors = [];

  if (!isPlainObject(payload)) {
    return {
      errors: ['Payload must be an object.'],
      value: null,
    };
  }

  if (typeof payload.pushEnabled !== 'boolean') {
    errors.push('`pushEnabled` must be a boolean.');
  }

  return {
    errors,
    value: {
      pushEnabled: payload.pushEnabled === true,
    },
  };
}

function validateUpdateTypePreferencePayload(payload) {
  const errors = [];

  if (!isPlainObject(payload)) {
    return {
      errors: ['Payload must be an object.'],
      value: null,
    };
  }

  const notificationType = validateRequiredString('notificationType', payload.notificationType, errors, { maxLength: 100 });
  if (notificationType && !NOTIFICATION_TYPES.includes(notificationType)) {
    errors.push(`\`notificationType\` must be one of: ${NOTIFICATION_TYPES.join(', ')}.`);
  }

  if (typeof payload.pushEnabled !== 'boolean') {
    errors.push('`pushEnabled` must be a boolean.');
  }

  return {
    errors,
    value: {
      notificationType,
      pushEnabled: payload.pushEnabled === true,
    },
  };
}

module.exports = {
  validateCreateNotificationPayload,
  validateListNotificationsQuery,
  validateNotificationIdParam,
  validateRegisterDevicePayload,
  validateUnregisterDevicePayload,
  validateUpdatePreferencesPayload,
  validateUpdateTypePreferencePayload,
};
