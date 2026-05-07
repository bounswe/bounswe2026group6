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
  const maxLength = options?.maxLength ?? 255;

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

function validateEmergencyBroadcastPayload(payload) {
  const errors = [];

  if (!isPlainObject(payload)) {
    return {
      errors: ['Payload must be an object.'],
      value: null,
    };
  }

  const title = validateRequiredString('title', payload.title, errors, { maxLength: 255 });
  const body = validateRequiredString('body', payload.body, errors, { maxLength: 2000 });

  if (!isPlainObject(payload.location)) {
    errors.push('`location` must be an object.');
  }

  const latitude = Number(payload?.location?.latitude);
  const longitude = Number(payload?.location?.longitude);
  const radiusKm = Number(payload?.location?.radiusKm);
  const maxRecipients = payload.maxRecipients == null ? 5000 : Number(payload.maxRecipients);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    errors.push('`location.latitude` must be a valid number between -90 and 90.');
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    errors.push('`location.longitude` must be a valid number between -180 and 180.');
  }

  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 1000) {
    errors.push('`location.radiusKm` must be a valid number greater than 0 and at most 1000.');
  }

  if (!Number.isInteger(maxRecipients) || maxRecipients < 1 || maxRecipients > 50000) {
    errors.push('`maxRecipients` must be an integer between 1 and 50000.');
  }

  return {
    errors,
    value: {
      title,
      body,
      location: {
        latitude,
        longitude,
        radiusKm,
      },
      maxRecipients,
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
  validateEmergencyBroadcastPayload,
};
