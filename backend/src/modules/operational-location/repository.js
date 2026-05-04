const { query } = require('../../db/pool');

function mapOperationalLocation(row) {
  if (!row) {
    return null;
  }

  return {
    userId: row.user_id,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    accuracyMeters: row.accuracy_meters === null ? null : Number(row.accuracy_meters),
    source: row.source || null,
    capturedAt: row.captured_at || null,
    updatedAt: row.updated_at || null,
  };
}

async function findOperationalLocationByUserId(userId) {
  const result = await query(
    `
      SELECT
        user_id,
        latitude,
        longitude,
        accuracy_meters,
        source,
        captured_at,
        updated_at
      FROM user_operational_locations
      WHERE user_id = $1;
    `,
    [userId],
  );

  return mapOperationalLocation(result.rows[0]);
}

async function upsertOperationalLocation(userId, input) {
  const result = await query(
    `
      INSERT INTO user_operational_locations (
        user_id,
        latitude,
        longitude,
        accuracy_meters,
        source,
        captured_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE
      SET latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          accuracy_meters = EXCLUDED.accuracy_meters,
          source = EXCLUDED.source,
          captured_at = EXCLUDED.captured_at,
          updated_at = CURRENT_TIMESTAMP
      RETURNING
        user_id,
        latitude,
        longitude,
        accuracy_meters,
        source,
        captured_at,
        updated_at;
    `,
    [
      userId,
      input.latitude,
      input.longitude,
      input.accuracyMeters,
      input.source,
      input.capturedAt,
    ],
  );

  return mapOperationalLocation(result.rows[0]);
}

module.exports = {
  findOperationalLocationByUserId,
  upsertOperationalLocation,
};
