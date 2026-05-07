const { randomUUID } = require('crypto');

const {
  createNotificationForRequester,
  listMyNotifications,
  markMyNotificationAsRead,
  markAllMyNotificationsAsRead,
  registerMyNotificationDevice,
  unregisterMyNotificationDevice,
  getMyNotificationPreferences,
  updateMyNotificationPreferences,
  listMyNotificationTypePreferences,
  updateMyNotificationTypePreference,
  getMyUnreadNotificationCount,
  getAdminNotificationStats,
  createEmergencyBroadcast,
} = require('./service');
const {
  validateCreateNotificationPayload,
  validateListNotificationsQuery,
  validateNotificationIdParam,
  validateRegisterDevicePayload,
  validateUnregisterDevicePayload,
  validateUpdatePreferencesPayload,
  validateUpdateTypePreferencePayload,
  validateEmergencyBroadcastPayload,
} = require('./validators');

function sendError(response, status, code, message, details) {
  const payload = { code, message };

  if (details) {
    payload.details = details;
  }

  return response.status(status).json(payload);
}

async function createNotification(request, response) {
  const validation = validateCreateNotificationPayload(request.body || {});
  if (validation.errors.length > 0) {
    return sendError(response, 400, 'VALIDATION_FAILED', 'Validation failed', validation.errors);
  }

  try {
    const notification = await createNotificationForRequester(request.user, validation.value);
    return response.status(201).json({ notification });
  } catch (error) {
    if (error.code === 'FORBIDDEN') {
      return sendError(response, 403, 'FORBIDDEN', error.message);
    }

    if (error.code === 'INVALID_NOTIFICATION_TYPE') {
      return sendError(response, 400, 'INVALID_NOTIFICATION_TYPE', error.message);
    }

    console.error('notifications.createNotification failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

async function getMyNotifications(request, response) {
  const validation = validateListNotificationsQuery(request.query || {});
  if (validation.errors.length > 0) {
    return sendError(response, 400, 'VALIDATION_FAILED', 'Validation failed', validation.errors);
  }

  try {
    const result = await listMyNotifications(request.user.userId, validation.value);
    return response.status(200).json(result);
  } catch (error) {
    if (error.code === 'INVALID_CURSOR') {
      return sendError(response, 400, 'INVALID_CURSOR', error.message);
    }

    console.error('notifications.getMyNotifications failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

async function markAsRead(request, response) {
  const notificationId = request.params.notificationId;
  if (!validateNotificationIdParam(notificationId)) {
    return sendError(response, 400, 'VALIDATION_FAILED', 'Validation failed', ['`notificationId` is invalid.']);
  }

  try {
    const notification = await markMyNotificationAsRead(request.user.userId, notificationId);
    if (!notification) {
      return sendError(response, 404, 'NOT_FOUND', 'Notification not found');
    }

    return response.status(200).json({ notification });
  } catch (error) {
    console.error('notifications.markAsRead failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

async function markAllAsRead(request, response) {
  try {
    const result = await markAllMyNotificationsAsRead(request.user.userId);
    return response.status(200).json(result);
  } catch (error) {
    console.error('notifications.markAllAsRead failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

async function registerDevice(request, response) {
  const validation = validateRegisterDevicePayload(request.body || {});
  if (validation.errors.length > 0) {
    return sendError(response, 400, 'VALIDATION_FAILED', 'Validation failed', validation.errors);
  }

  try {
    const device = await registerMyNotificationDevice(request.user.userId, validation.value);
    return response.status(200).json({ device });
  } catch (error) {
    console.error('notifications.registerDevice failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

async function unregisterDevice(request, response) {
  const validation = validateUnregisterDevicePayload(request.body || {});
  if (validation.errors.length > 0) {
    return sendError(response, 400, 'VALIDATION_FAILED', 'Validation failed', validation.errors);
  }

  try {
    const device = await unregisterMyNotificationDevice(request.user.userId, validation.value);
    if (!device) {
      return sendError(response, 404, 'NOT_FOUND', 'Device token not found');
    }

    return response.status(200).json({ device });
  } catch (error) {
    console.error('notifications.unregisterDevice failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

async function getPreferences(request, response) {
  try {
    const preferences = await getMyNotificationPreferences(request.user.userId);
    return response.status(200).json({ preferences });
  } catch (error) {
    console.error('notifications.getPreferences failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

async function patchPreferences(request, response) {
  const validation = validateUpdatePreferencesPayload(request.body || {});
  if (validation.errors.length > 0) {
    return sendError(response, 400, 'VALIDATION_FAILED', 'Validation failed', validation.errors);
  }

  try {
    const preferences = await updateMyNotificationPreferences(request.user.userId, validation.value);
    return response.status(200).json({ preferences });
  } catch (error) {
    console.error('notifications.patchPreferences failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

async function getAdminStats(request, response) {
  try {
    const stats = await getAdminNotificationStats(request.user);
    return response.status(200).json(stats);
  } catch (error) {
    if (error.code === 'FORBIDDEN') {
      return sendError(response, 403, 'FORBIDDEN', error.message);
    }

    console.error('notifications.getAdminStats failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

async function getTypePreferences(request, response) {
  try {
    const preferences = await listMyNotificationTypePreferences(request.user.userId);
    return response.status(200).json({ preferences });
  } catch (error) {
    console.error('notifications.getTypePreferences failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

async function patchTypePreference(request, response) {
  const validation = validateUpdateTypePreferencePayload(request.body || {});
  if (validation.errors.length > 0) {
    return sendError(response, 400, 'VALIDATION_FAILED', 'Validation failed', validation.errors);
  }

  try {
    const preference = await updateMyNotificationTypePreference(request.user.userId, validation.value);
    return response.status(200).json({ preference });
  } catch (error) {
    if (error.code === 'INVALID_NOTIFICATION_TYPE') {
      return sendError(response, 400, 'INVALID_NOTIFICATION_TYPE', error.message);
    }

    console.error('notifications.patchTypePreference failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

async function getUnreadCount(request, response) {
  try {
    const result = await getMyUnreadNotificationCount(request.user.userId);
    return response.status(200).json(result);
  } catch (error) {
    console.error('notifications.getUnreadCount failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

async function postEmergencyBroadcast(request, response) {
  const validation = validateEmergencyBroadcastPayload(request.body || {});
  if (validation.errors.length > 0) {
    return sendError(response, 400, 'VALIDATION_FAILED', 'Validation failed', validation.errors);
  }

  try {
    const result = await createEmergencyBroadcast(request.user, {
      ...validation.value,
      broadcastId: `broadcast_${randomUUID()}`.slice(0, 64),
    });
    return response.status(201).json(result);
  } catch (error) {
    if (error.code === 'FORBIDDEN') {
      return sendError(response, 403, 'FORBIDDEN', error.message);
    }

    console.error('notifications.postEmergencyBroadcast failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

module.exports = {
  createNotification,
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  registerDevice,
  unregisterDevice,
  getPreferences,
  patchPreferences,
  getTypePreferences,
  patchTypePreference,
  getUnreadCount,
  getAdminStats,
  postEmergencyBroadcast,
};
