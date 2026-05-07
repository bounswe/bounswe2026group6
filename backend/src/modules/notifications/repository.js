const { randomUUID } = require('crypto');
const { query } = require('../../db/pool');

function mapNotification(row) {
  return {
    id: row.notification_id,
    recipientUserId: row.recipient_user_id,
    actorUserId: row.actor_user_id || null,
    type: row.type,
    title: row.title,
    body: row.body,
    isRead: row.is_read,
    readAt: row.read_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    entity: row.entity_type && row.entity_id
      ? {
          type: row.entity_type,
          id: row.entity_id,
        }
      : null,
    data: row.payload || {},
  };
}

async function insertNotification({
  recipientUserId,
  actorUserId,
  type,
  title,
  body,
  entity,
  data,
}) {
  const notificationId = randomUUID();
  const result = await query(
    `
      INSERT INTO notifications (
        notification_id,
        recipient_user_id,
        actor_user_id,
        type,
        title,
        body,
        entity_type,
        entity_id,
        payload
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      RETURNING
        notification_id,
        recipient_user_id,
        actor_user_id,
        type,
        title,
        body,
        entity_type,
        entity_id,
        payload,
        is_read,
        read_at,
        created_at,
        updated_at
    `,
    [
      notificationId,
      recipientUserId,
      actorUserId || null,
      type,
      title,
      body,
      entity?.type || null,
      entity?.id || null,
      JSON.stringify(data || {}),
    ],
  );

  return mapNotification(result.rows[0]);
}

async function listNotificationsByRecipient({
  recipientUserId,
  limit,
  unreadOnly,
  cursorCreatedAt,
  cursorNotificationId,
}) {
  const params = [recipientUserId, limit];
  const where = ['recipient_user_id = $1'];

  if (unreadOnly) {
    where.push('is_read = FALSE');
  }

  if (cursorCreatedAt && cursorNotificationId) {
    params.push(cursorCreatedAt, cursorNotificationId);
    where.push(`(created_at, notification_id) < ($${params.length - 1}, $${params.length})`);
  }

  const result = await query(
    `
      SELECT
        notification_id,
        recipient_user_id,
        actor_user_id,
        type,
        title,
        body,
        entity_type,
        entity_id,
        payload,
        is_read,
        read_at,
        created_at,
        updated_at
      FROM notifications
      WHERE ${where.join(' AND ')}
      ORDER BY created_at DESC, notification_id DESC
      LIMIT $2
    `,
    params,
  );

  return result.rows.map(mapNotification);
}

async function countUnreadNotifications(recipientUserId) {
  const result = await query(
    `
      SELECT COUNT(*)::int AS unread_count
      FROM notifications
      WHERE recipient_user_id = $1
        AND is_read = FALSE
    `,
    [recipientUserId],
  );

  return result.rows[0]?.unread_count || 0;
}

async function markNotificationAsRead(recipientUserId, notificationId) {
  const result = await query(
    `
      UPDATE notifications
      SET
        is_read = TRUE,
        read_at = COALESCE(read_at, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
      WHERE recipient_user_id = $1
        AND notification_id = $2
      RETURNING
        notification_id,
        recipient_user_id,
        actor_user_id,
        type,
        title,
        body,
        entity_type,
        entity_id,
        payload,
        is_read,
        read_at,
        created_at,
        updated_at
    `,
    [recipientUserId, notificationId],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapNotification(result.rows[0]);
}

async function markAllNotificationsAsRead(recipientUserId) {
  const result = await query(
    `
      UPDATE notifications
      SET
        is_read = TRUE,
        read_at = COALESCE(read_at, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
      WHERE recipient_user_id = $1
        AND is_read = FALSE
    `,
    [recipientUserId],
  );

  return result.rowCount;
}

function mapDevice(row) {
  return {
    id: row.device_id,
    userId: row.user_id,
    platform: row.platform,
    provider: row.provider,
    deviceToken: row.device_token,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at,
  };
}

async function upsertNotificationDevice({
  userId,
  platform,
  provider,
  deviceToken,
}) {
  const deviceId = randomUUID();
  const result = await query(
    `
      INSERT INTO notification_devices (
        device_id,
        user_id,
        platform,
        provider,
        device_token,
        is_active,
        updated_at,
        last_seen_at
      )
      VALUES ($1, $2, $3, $4, $5, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (provider, device_token)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform,
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP,
        last_seen_at = CURRENT_TIMESTAMP
      RETURNING
        device_id,
        user_id,
        platform,
        provider,
        device_token,
        is_active,
        created_at,
        updated_at,
        last_seen_at
    `,
    [deviceId, userId, platform, provider, deviceToken],
  );

  return mapDevice(result.rows[0]);
}

async function deactivateNotificationDevice({ userId, provider, deviceToken }) {
  const result = await query(
    `
      UPDATE notification_devices
      SET
        is_active = FALSE,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
        AND provider = $2
        AND device_token = $3
      RETURNING
        device_id,
        user_id,
        platform,
        provider,
        device_token,
        is_active,
        created_at,
        updated_at,
        last_seen_at
    `,
    [userId, provider, deviceToken],
  );

  return result.rows[0] ? mapDevice(result.rows[0]) : null;
}

async function listActiveNotificationDevicesByUserId(userId) {
  const result = await query(
    `
      SELECT
        device_id,
        user_id,
        platform,
        provider,
        device_token,
        is_active,
        created_at,
        updated_at,
        last_seen_at
      FROM notification_devices
      WHERE user_id = $1
        AND is_active = TRUE
      ORDER BY updated_at DESC
    `,
    [userId],
  );

  return result.rows.map(mapDevice);
}

async function insertNotificationDelivery({
  notificationId,
  userId,
  channel,
  provider,
  platform,
  deviceToken,
  status,
  errorMessage,
  deliveredAt,
}) {
  const deliveryId = randomUUID();
  await query(
    `
      INSERT INTO notification_deliveries (
        delivery_id,
        notification_id,
        user_id,
        channel,
        provider,
        platform,
        device_token,
        status,
        error_message,
        delivered_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
    [
      deliveryId,
      notificationId,
      userId,
      channel,
      provider || null,
      platform || null,
      deviceToken || null,
      status,
      errorMessage || null,
      deliveredAt || null,
    ],
  );
}

async function getNotificationPreferencesByUserId(userId) {
  const result = await query(
    `
      SELECT user_id, push_enabled, updated_at
      FROM notification_preferences
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId],
  );

  if (result.rows.length === 0) {
    return {
      userId,
      pushEnabled: true,
      updatedAt: null,
    };
  }

  return {
    userId: result.rows[0].user_id,
    pushEnabled: result.rows[0].push_enabled,
    updatedAt: result.rows[0].updated_at,
  };
}

async function upsertNotificationPreferences({ userId, pushEnabled }) {
  const result = await query(
    `
      INSERT INTO notification_preferences (
        user_id,
        push_enabled,
        updated_at
      )
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id)
      DO UPDATE SET
        push_enabled = EXCLUDED.push_enabled,
        updated_at = CURRENT_TIMESTAMP
      RETURNING user_id, push_enabled, updated_at
    `,
    [userId, pushEnabled],
  );

  return {
    userId: result.rows[0].user_id,
    pushEnabled: result.rows[0].push_enabled,
    updatedAt: result.rows[0].updated_at,
  };
}

async function getNotificationDeliveryStats() {
  const totalsResult = await query(
    `
      SELECT
        channel,
        status,
        COUNT(*)::int AS count
      FROM notification_deliveries
      GROUP BY channel, status
      ORDER BY channel, status
    `
  );

  const totals = totalsResult.rows.map((row) => ({
    channel: row.channel,
    status: row.status,
    count: row.count,
  }));

  const unreadResult = await query(
    `
      SELECT COUNT(*)::int AS unread_count
      FROM notifications
      WHERE is_read = FALSE
    `
  );

  return {
    totals,
    unreadCount: unreadResult.rows[0]?.unread_count || 0,
  };
}

async function listNotificationTypePreferencesByUserId(userId) {
  const result = await query(
    `
      SELECT user_id, notification_type, push_enabled, updated_at
      FROM notification_type_preferences
      WHERE user_id = $1
      ORDER BY notification_type ASC
    `,
    [userId],
  );

  return result.rows.map((row) => ({
    userId: row.user_id,
    notificationType: row.notification_type,
    pushEnabled: row.push_enabled,
    updatedAt: row.updated_at,
  }));
}

async function upsertNotificationTypePreference({ userId, notificationType, pushEnabled }) {
  const result = await query(
    `
      INSERT INTO notification_type_preferences (
        user_id,
        notification_type,
        push_enabled,
        updated_at
      )
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, notification_type)
      DO UPDATE SET
        push_enabled = EXCLUDED.push_enabled,
        updated_at = CURRENT_TIMESTAMP
      RETURNING user_id, notification_type, push_enabled, updated_at
    `,
    [userId, notificationType, pushEnabled],
  );

  return {
    userId: result.rows[0].user_id,
    notificationType: result.rows[0].notification_type,
    pushEnabled: result.rows[0].push_enabled,
    updatedAt: result.rows[0].updated_at,
  };
}

async function listUserIdsWithinRadius({
  latitude,
  longitude,
  radiusKm,
  limit = 5000,
}) {
  const result = await query(
    `
      SELECT DISTINCT up.user_id
      FROM location_profiles lp
      JOIN user_profiles up ON up.profile_id = lp.profile_id
      WHERE lp.latitude IS NOT NULL
        AND lp.longitude IS NOT NULL
        AND (
          6371 * acos(
            least(
              1,
              greatest(
                -1,
                cos(radians($1)) * cos(radians(lp.latitude))
                * cos(radians(lp.longitude) - radians($2))
                + sin(radians($1)) * sin(radians(lp.latitude))
              )
            )
          )
        ) <= $3
      LIMIT $4
    `,
    [latitude, longitude, radiusKm, limit],
  );

  return result.rows.map((row) => row.user_id);
}

async function listAvailabilityReminderCandidates({
  minMinutesSinceLocationUpdate,
  reminderCooldownMinutes,
  limit = 100,
}) {
  const result = await query(
    `
      SELECT DISTINCT v.user_id
      FROM volunteers v
      WHERE v.is_available = TRUE
        AND v.location_updated_at IS NOT NULL
        AND v.location_updated_at <= CURRENT_TIMESTAMP - ($1::int * INTERVAL '1 minute')
        AND NOT EXISTS (
          SELECT 1
          FROM assignments a
          JOIN help_requests hr ON hr.request_id = a.request_id
          WHERE a.volunteer_id = v.volunteer_id
            AND a.is_cancelled = FALSE
            AND hr.status IN ('ASSIGNED', 'IN_PROGRESS')
        )
        AND NOT EXISTS (
          SELECT 1
          FROM notifications n
          WHERE n.recipient_user_id = v.user_id
            AND n.type = 'TASK_UPDATED'
            AND COALESCE(n.payload->>'kind', '') = 'availability_reminder'
            AND n.created_at >= CURRENT_TIMESTAMP - ($2::int * INTERVAL '1 minute')
        )
      LIMIT $3
    `,
    [minMinutesSinceLocationUpdate, reminderCooldownMinutes, limit],
  );

  return result.rows.map((row) => row.user_id);
}

async function listAvailabilityPausedNotificationCandidates({
  locationMaxAgeMinutes,
  limit = 100,
}) {
  const result = await query(
    `
      WITH paused AS (
        SELECT
          v.user_id,
          CASE
            WHEN v.last_known_latitude IS NULL
              OR v.last_known_longitude IS NULL
              OR v.location_updated_at IS NULL
              THEN 'LOCATION_MISSING'
            WHEN v.available_until IS NOT NULL
              AND v.available_until <= CURRENT_TIMESTAMP
              THEN 'AVAILABILITY_EXPIRED'
            WHEN v.location_updated_at < CURRENT_TIMESTAMP - ($1::int * INTERVAL '1 minute')
              THEN 'LOCATION_STALE'
            ELSE 'NONE'
          END AS pause_reason,
          CASE
            WHEN v.last_known_latitude IS NULL
              OR v.last_known_longitude IS NULL
              OR v.location_updated_at IS NULL
              THEN CONCAT(
                'LOCATION_MISSING:',
                COALESCE(v.availability_confirmed_at::text, v.available_until::text, v.volunteer_id)
              )
            WHEN v.available_until IS NOT NULL
              AND v.available_until <= CURRENT_TIMESTAMP
              THEN CONCAT('AVAILABILITY_EXPIRED:', COALESCE(v.available_until::text, v.volunteer_id))
            WHEN v.location_updated_at < CURRENT_TIMESTAMP - ($1::int * INTERVAL '1 minute')
              THEN CONCAT('LOCATION_STALE:', COALESCE(v.location_updated_at::text, v.volunteer_id))
            ELSE 'NONE'
          END AS pause_event_key
        FROM volunteers v
        WHERE v.is_available = TRUE
      )
      SELECT user_id, pause_reason, pause_event_key
      FROM paused p
      WHERE p.pause_reason <> 'NONE'
        AND NOT EXISTS (
          SELECT 1
          FROM notifications n
          WHERE n.recipient_user_id = p.user_id
            AND n.type = 'VOLUNTEER_AVAILABILITY_PAUSED'
            AND COALESCE(n.payload->>'kind', '') = 'availability_paused'
            AND COALESCE(n.payload->>'pauseEventKey', '') = p.pause_event_key
        )
      LIMIT $2
    `,
    [locationMaxAgeMinutes, limit],
  );

  return result.rows.map((row) => ({
    userId: row.user_id,
    pauseReason: row.pause_reason,
    pauseEventKey: row.pause_event_key,
  }));
}

async function expireStalePendingHelpRequests({ ttlHours, limit = 100 }) {
  const result = await query(
    `
      WITH stale AS (
        SELECT request_id
        FROM help_requests
        WHERE status = 'PENDING'
          AND created_at <= CURRENT_TIMESTAMP - ($1::int * INTERVAL '1 hour')
        ORDER BY created_at ASC
        LIMIT $2
      )
      UPDATE help_requests hr
      SET
        status = 'CANCELLED',
        cancelled_at = CURRENT_TIMESTAMP
      FROM stale
      WHERE hr.request_id = stale.request_id
      RETURNING hr.request_id, hr.user_id
    `,
    [ttlHours, limit],
  );

  return result.rows;
}

module.exports = {
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
  listAvailabilityReminderCandidates,
  listAvailabilityPausedNotificationCandidates,
  expireStalePendingHelpRequests,
};
