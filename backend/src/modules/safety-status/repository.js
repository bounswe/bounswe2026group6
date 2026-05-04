const { query } = require('../../db/pool');

function roundToPrecision(value, digits) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mapLocation(row, { canSeeLocation = true, isAdmin = false } = {}) {
  if (!canSeeLocation || row.latitude == null || row.longitude == null) {
    return null;
  }

  return {
    latitude: isAdmin ? Number(row.latitude) : roundToPrecision(Number(row.latitude), 3),
    longitude: isAdmin ? Number(row.longitude) : roundToPrecision(Number(row.longitude), 3),
    accuracyMeters: row.location_accuracy_meters == null ? null : Number(row.location_accuracy_meters),
    source: row.location_source || null,
    capturedAt: row.location_captured_at || null,
  };
}

function mapSafetyStatus(row, options = {}) {
  if (!row) {
    return null;
  }

  return {
    userId: row.user_id,
    status: row.status || 'unknown',
    note: row.status_note || null,
    shareLocationConsent: Boolean(row.share_location_consent),
    location: mapLocation(row, options),
    updatedAt: row.updated_at || null,
  };
}

function mapVisibleSafetyStatus(row, { isAdmin = false } = {}) {
  const canSeeLocation = Boolean(
    row.share_location_consent
    && row.location_sharing_enabled
    && row.location_visibility !== 'PRIVATE'
  );

  return {
    userId: row.user_id,
    displayName: [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || null,
    status: row.status || 'unknown',
    updatedAt: row.updated_at || null,
    location: mapLocation(row, { canSeeLocation, isAdmin }),
  };
}

async function findSafetyStatusByUserId(userId) {
  const result = await query(
    `
      SELECT
        user_id,
        status,
        status_note,
        share_location_consent,
        latitude,
        longitude,
        location_accuracy_meters,
        location_source,
        location_captured_at,
        updated_at
      FROM user_safety_statuses
      WHERE user_id = $1;
    `,
    [userId],
  );

  if (result.rows.length === 0) {
    return {
      userId,
      status: 'unknown',
      note: null,
      shareLocationConsent: false,
      location: null,
      updatedAt: null,
    };
  }

  return mapSafetyStatus(result.rows[0]);
}

async function upsertSafetyStatus(userId, input) {
  const existing = await query(
    'SELECT * FROM user_safety_statuses WHERE user_id = $1;',
    [userId],
  );
  const current = existing.rows[0] || {};
  const location = input.location || {};
  const nextShareLocationConsent = input.hasShareLocationConsent
    ? input.shareLocationConsent
    : Boolean(current.share_location_consent);

  const nextLatitude = input.hasLocation ? location.latitude ?? null : current.latitude ?? null;
  const nextLongitude = input.hasLocation ? location.longitude ?? null : current.longitude ?? null;
  const nextAccuracy = input.hasLocation ? location.accuracyMeters ?? null : current.location_accuracy_meters ?? null;
  const nextSource = input.hasLocation ? location.source ?? null : current.location_source ?? null;
  const nextCapturedAt = input.hasLocation ? location.capturedAt ?? null : current.location_captured_at ?? null;
  const shouldClearLocation = !nextShareLocationConsent;

  const result = await query(
    `
      INSERT INTO user_safety_statuses (
        user_id,
        status,
        status_note,
        share_location_consent,
        latitude,
        longitude,
        location_accuracy_meters,
        location_source,
        location_captured_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE
      SET status = EXCLUDED.status,
          status_note = EXCLUDED.status_note,
          share_location_consent = EXCLUDED.share_location_consent,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          location_accuracy_meters = EXCLUDED.location_accuracy_meters,
          location_source = EXCLUDED.location_source,
          location_captured_at = EXCLUDED.location_captured_at,
          updated_at = CURRENT_TIMESTAMP
      RETURNING
        user_id,
        status,
        status_note,
        share_location_consent,
        latitude,
        longitude,
        location_accuracy_meters,
        location_source,
        location_captured_at,
        updated_at;
    `,
    [
      userId,
      input.hasStatus ? input.status : current.status || 'unknown',
      input.hasNote ? input.note : current.status_note || null,
      nextShareLocationConsent,
      shouldClearLocation ? null : nextLatitude,
      shouldClearLocation ? null : nextLongitude,
      shouldClearLocation ? null : nextAccuracy,
      shouldClearLocation ? null : nextSource,
      shouldClearLocation ? null : nextCapturedAt,
    ],
  );

  return mapSafetyStatus(result.rows[0]);
}

async function listVisibleSafetyStatuses(viewerUserId, { isAdmin = false } = {}) {
  const result = await query(
    `
      SELECT
        uss.user_id,
        uss.status,
        uss.status_note,
        uss.share_location_consent,
        uss.latitude,
        uss.longitude,
        uss.location_accuracy_meters,
        uss.location_source,
        uss.location_captured_at,
        uss.updated_at,
        up.first_name,
        up.last_name,
        ps.profile_visibility,
        ps.location_visibility,
        ps.location_sharing_enabled
      FROM user_safety_statuses uss
      LEFT JOIN user_profiles up ON up.user_id = uss.user_id
      LEFT JOIN privacy_settings ps ON ps.profile_id = up.profile_id
      WHERE uss.user_id = $1
        OR $2 = TRUE
        OR COALESCE(ps.profile_visibility::text, 'PRIVATE') = 'PUBLIC'
      ORDER BY uss.updated_at DESC, uss.user_id ASC;
    `,
    [viewerUserId, isAdmin],
  );

  return result.rows.map((row) => mapVisibleSafetyStatus(row, { isAdmin }));
}

module.exports = {
  findSafetyStatusByUserId,
  upsertSafetyStatus,
  listVisibleSafetyStatuses,
};
