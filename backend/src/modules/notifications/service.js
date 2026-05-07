const {
  insertNotification,
  listNotificationsByRecipient,
  countUnreadNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  upsertNotificationDevice,
  deactivateNotificationDevice,
  listActiveNotificationDevicesByUserId,
  insertNotificationDelivery,
  getNotificationPreferencesByUserId,
  upsertNotificationPreferences,
  getNotificationDeliveryStats,
  listNotificationTypePreferencesByUserId,
  upsertNotificationTypePreference,
  listUserIdsWithinRadius,
} = require('./repository');
const { NOTIFICATION_TYPES } = require('./constants');
const { sendPushNotification } = require('./push');

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function ensureKnownNotificationType(type) {
  if (!NOTIFICATION_TYPES.includes(type)) {
    const error = new Error('Unsupported notification type.');
    error.code = 'INVALID_NOTIFICATION_TYPE';
    throw error;
  }
}

function encodeCursor(notification) {
  const payload = JSON.stringify({
    createdAt: notification.createdAt instanceof Date
      ? notification.createdAt.toISOString()
      : String(notification.createdAt),
    id: notification.id,
  });

  return Buffer.from(payload, 'utf8').toString('base64');
}

function decodeCursor(cursor) {
  if (!cursor) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
    if (
      !decoded
      || typeof decoded.createdAt !== 'string'
      || typeof decoded.id !== 'string'
      || decoded.createdAt.trim() === ''
      || decoded.id.trim() === ''
    ) {
      throw new Error('Invalid cursor payload');
    }

    const createdAt = new Date(decoded.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      throw new Error('Invalid cursor date');
    }

    return {
      createdAt,
      id: decoded.id,
    };
  } catch (_error) {
    const error = new Error('Invalid cursor');
    error.code = 'INVALID_CURSOR';
    throw error;
  }
}

function mapNotificationForClient(notification) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    isRead: notification.isRead,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
    actorUserId: notification.actorUserId,
    entity: notification.entity,
    data: notification.data,
  };
}

function validateCrossUserCreate(requestingUserId, recipientUserId, isAdmin) {
  if (recipientUserId === requestingUserId || isAdmin) {
    return;
  }

  const error = new Error('Cannot create notifications for another user.');
  error.code = 'FORBIDDEN';
  throw error;
}

async function createNotification({
  recipientUserId,
  actorUserId,
  type,
  title,
  body,
  entity,
  data,
}) {
  ensureKnownNotificationType(type);

  const payload = isPlainObject(data) ? data : {};

  const stored = await insertNotification({
    recipientUserId,
    actorUserId,
    type,
    title,
    body,
    entity: entity || null,
    data: payload,
  });

  await insertNotificationDelivery({
    notificationId: stored.id,
    userId: stored.recipientUserId,
    channel: 'IN_APP',
    provider: null,
    platform: null,
    deviceToken: null,
    status: 'DELIVERED',
    errorMessage: null,
    deliveredAt: new Date(),
  });

  const preferences = await getNotificationPreferencesByUserId(stored.recipientUserId);
  if (preferences.pushEnabled) {
    const typePreferences = await listNotificationTypePreferencesByUserId(stored.recipientUserId);
    const matchingTypePreference = typePreferences.find((item) => item.notificationType === stored.type);
    const pushAllowedForType = matchingTypePreference ? matchingTypePreference.pushEnabled : true;

    if (!pushAllowedForType) {
      await insertNotificationDelivery({
        notificationId: stored.id,
        userId: stored.recipientUserId,
        channel: 'PUSH',
        provider: null,
        platform: null,
        deviceToken: null,
        status: 'SKIPPED',
        errorMessage: 'Push disabled by type preference.',
        deliveredAt: null,
      });
      return mapNotificationForClient(stored);
    }

    const activeDevices = await listActiveNotificationDevicesByUserId(stored.recipientUserId);
    for (const device of activeDevices) {
      try {
        const pushResult = await sendPushNotification({
          device,
          notification: mapNotificationForClient(stored),
        });

        await insertNotificationDelivery({
          notificationId: stored.id,
          userId: stored.recipientUserId,
          channel: 'PUSH',
          provider: device.provider,
          platform: device.platform,
          deviceToken: device.deviceToken,
          status: pushResult.status || (pushResult.success ? 'DELIVERED' : 'FAILED'),
          errorMessage: pushResult.errorMessage || null,
          deliveredAt: pushResult.success ? new Date() : null,
        });
      } catch (error) {
        await insertNotificationDelivery({
          notificationId: stored.id,
          userId: stored.recipientUserId,
          channel: 'PUSH',
          provider: device.provider,
          platform: device.platform,
          deviceToken: device.deviceToken,
          status: 'FAILED',
          errorMessage: error.message || 'Push send failed',
          deliveredAt: null,
        });
      }
    }
  } else {
    await insertNotificationDelivery({
      notificationId: stored.id,
      userId: stored.recipientUserId,
      channel: 'PUSH',
      provider: null,
      platform: null,
      deviceToken: null,
      status: 'SKIPPED',
      errorMessage: 'Push disabled by user preference.',
      deliveredAt: null,
    });
  }

  return mapNotificationForClient(stored);
}

async function createNotificationForRequester(requestingUser, payload) {
  const recipientUserId = payload.recipientUserId || requestingUser.userId;
  validateCrossUserCreate(requestingUser.userId, recipientUserId, Boolean(requestingUser.isAdmin));

  return createNotification({
    recipientUserId,
    actorUserId: payload.actorUserId || requestingUser.userId,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    entity: payload.entity,
    data: payload.data,
  });
}

async function listMyNotifications(userId, options) {
  const cursor = decodeCursor(options.cursor);
  const rows = await listNotificationsByRecipient({
    recipientUserId: userId,
    limit: options.limit,
    unreadOnly: options.unreadOnly,
    cursorCreatedAt: cursor ? cursor.createdAt : null,
    cursorNotificationId: cursor ? cursor.id : null,
  });

  const unreadCount = await countUnreadNotifications(userId);
  const items = rows.map(mapNotificationForClient);
  const nextCursor = rows.length === options.limit ? encodeCursor(rows[rows.length - 1]) : null;

  return {
    items,
    unreadCount,
    nextCursor,
  };
}

async function markMyNotificationAsRead(userId, notificationId) {
  const updated = await markNotificationAsRead(userId, notificationId);
  if (!updated) {
    return null;
  }

  return mapNotificationForClient(updated);
}

async function markAllMyNotificationsAsRead(userId) {
  const updatedCount = await markAllNotificationsAsRead(userId);
  const unreadCount = await countUnreadNotifications(userId);

  return {
    updatedCount,
    unreadCount,
  };
}

async function registerMyNotificationDevice(userId, payload) {
  return upsertNotificationDevice({
    userId,
    platform: payload.platform,
    provider: payload.provider,
    deviceToken: payload.deviceToken,
  });
}

async function unregisterMyNotificationDevice(userId, payload) {
  return deactivateNotificationDevice({
    userId,
    provider: payload.provider,
    deviceToken: payload.deviceToken,
  });
}

async function getMyNotificationPreferences(userId) {
  return getNotificationPreferencesByUserId(userId);
}

async function updateMyNotificationPreferences(userId, payload) {
  return upsertNotificationPreferences({
    userId,
    pushEnabled: payload.pushEnabled,
  });
}

async function listMyNotificationTypePreferences(userId) {
  const stored = await listNotificationTypePreferencesByUserId(userId);
  const byType = new Map(stored.map((item) => [item.notificationType, item]));

  return NOTIFICATION_TYPES.map((type) => {
    const found = byType.get(type);
    return {
      notificationType: type,
      pushEnabled: found ? found.pushEnabled : true,
      updatedAt: found ? found.updatedAt : null,
    };
  });
}

async function updateMyNotificationTypePreference(userId, payload) {
  ensureKnownNotificationType(payload.notificationType);
  return upsertNotificationTypePreference({
    userId,
    notificationType: payload.notificationType,
    pushEnabled: payload.pushEnabled,
  });
}

async function getMyUnreadNotificationCount(userId) {
  const unreadCount = await countUnreadNotifications(userId);
  return { unreadCount };
}

async function getAdminNotificationStats(requestingUser) {
  if (!requestingUser || !requestingUser.isAdmin) {
    const error = new Error('Admin access required.');
    error.code = 'FORBIDDEN';
    throw error;
  }

  return getNotificationDeliveryStats();
}

async function createEmergencyBroadcast(requestingUser, payload) {
  if (!requestingUser || !requestingUser.isAdmin) {
    const error = new Error('Admin access required.');
    error.code = 'FORBIDDEN';
    throw error;
  }

  const recipientUserIds = await listUserIdsWithinRadius({
    latitude: payload.location.latitude,
    longitude: payload.location.longitude,
    radiusKm: payload.location.radiusKm,
    limit: payload.maxRecipients || 5000,
  });

  let deliveredCount = 0;
  for (const recipientUserId of recipientUserIds) {
    await createNotification({
      recipientUserId,
      actorUserId: requestingUser.userId,
      type: 'SYSTEM',
      title: payload.title,
      body: payload.body,
      entity: {
        type: 'EMERGENCY_BROADCAST',
        id: payload.broadcastId,
      },
      data: {
        screen: 'notifications',
        kind: 'emergency_broadcast',
        radiusKm: payload.location.radiusKm,
        latitude: payload.location.latitude,
        longitude: payload.location.longitude,
      },
    });
    deliveredCount += 1;
  }

  return {
    broadcastId: payload.broadcastId,
    recipientCount: recipientUserIds.length,
    deliveredCount,
  };
}

module.exports = {
  createNotification,
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
};
