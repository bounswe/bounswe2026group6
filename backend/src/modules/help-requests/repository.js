const crypto = require('crypto');

const { pool, query } = require('../../db/pool');

function mapStatus(row) {
  if (row.status === 'RESOLVED') {
    return 'RESOLVED';
  }

  if (row.status === 'ASSIGNED' || row.status === 'IN_PROGRESS') {
    return 'MATCHED';
  }

  if (row.is_saved_locally) {
    return 'PENDING_SYNC';
  }

  return 'SYNCED';
}

function mapLocation(row) {
  if (!row.location_id) {
    return null;
  }

  return {
    id: row.location_id,
    latitude: row.latitude,
    longitude: row.longitude,
    isGpsLocation: row.is_gps_location,
    isLastKnown: row.is_last_known,
    capturedAt: row.captured_at,
  };
}

function mapHelpRequest(row) {
  return {
    id: row.request_id,
    userId: row.user_id,
    needType: row.need_type,
    description: row.description,
    status: mapStatus(row),
    internalStatus: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    isSavedLocally: row.is_saved_locally,
    location: mapLocation(row),
  };
}

function buildSelectQuery() {
  return `
    SELECT
      hr.request_id,
      hr.user_id,
      hr.need_type,
      hr.description,
      hr.status,
      hr.created_at,
      hr.resolved_at,
      hr.is_saved_locally,
      rl.location_id,
      rl.latitude,
      rl.longitude,
      rl.is_gps_location,
      rl.is_last_known,
      rl.captured_at
    FROM help_requests hr
    LEFT JOIN request_locations rl ON rl.request_id = hr.request_id
  `;
}

async function createHelpRequest(input) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const requestId = crypto.randomUUID();

    const requestResult = await client.query(
      `
        INSERT INTO help_requests (
          request_id,
          user_id,
          need_type,
          description,
          is_saved_locally
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
          request_id,
          user_id,
          need_type,
          description,
          status,
          created_at,
          resolved_at,
          is_saved_locally
      `,
      [requestId, input.userId, input.needType, input.description, input.isSavedLocally],
    );

    let locationRow = null;

    if (input.location) {
      const locationResult = await client.query(
        `
          INSERT INTO request_locations (
            location_id,
            request_id,
            latitude,
            longitude,
            is_gps_location,
            is_last_known
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING
            location_id,
            latitude,
            longitude,
            is_gps_location,
            is_last_known,
            captured_at
        `,
        [
          crypto.randomUUID(),
          requestId,
          input.location.latitude,
          input.location.longitude,
          input.location.isGpsLocation,
          input.location.isLastKnown,
        ],
      );

      locationRow = locationResult.rows[0];
    }

    await client.query('COMMIT');

    return mapHelpRequest({
      ...requestResult.rows[0],
      ...(locationRow || {}),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listHelpRequestsByUserId(userId) {
  const result = await query(
    `
      ${buildSelectQuery()}
      WHERE hr.user_id = $1
      ORDER BY hr.created_at DESC
    `,
    [userId],
  );

  return result.rows.map(mapHelpRequest);
}

async function findHelpRequestByIdForUser(userId, requestId) {
  const result = await query(
    `
      ${buildSelectQuery()}
      WHERE hr.user_id = $1 AND hr.request_id = $2
    `,
    [userId, requestId],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapHelpRequest(result.rows[0]);
}

module.exports = {
  createHelpRequest,
  listHelpRequestsByUserId,
  findHelpRequestByIdForUser,
};
