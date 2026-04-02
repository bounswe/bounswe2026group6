const crypto = require('crypto');

const { pool, query } = require('../../db/pool');

function mapStatus(row) {
  if (row.status === 'RESOLVED') {
    return 'RESOLVED';
  }

  if (row.status === 'CANCELLED') {
    return 'CANCELLED';
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
    country: row.country,
    city: row.city,
    district: row.district,
    neighborhood: row.neighborhood,
    extraAddress: row.extra_address || '',
  };
}

function mapContact(row) {
  return {
    fullName: row.contact_full_name,
    phone: Number(row.contact_phone),
    alternativePhone: row.contact_alternative_phone == null
      ? null
      : Number(row.contact_alternative_phone),
  };
}

function mapHelpRequest(row) {
  return {
    id: row.request_id,
    userId: row.user_id,
    helpTypes: row.help_types || [],
    otherHelpText: row.other_help_text || '',
    affectedPeopleCount: row.affected_people_count,
    riskFlags: row.risk_flags || [],
    vulnerableGroups: row.vulnerable_groups || [],
    description: row.description,
    bloodType: row.blood_type || '',
    location: mapLocation(row),
    contact: mapContact(row),
    consentGiven: row.consent_given,
    needType: row.need_type,
    status: mapStatus(row),
    internalStatus: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    isSavedLocally: row.is_saved_locally,
  };
}

function buildSelectQuery() {
  return `
    SELECT
      hr.request_id,
      hr.user_id,
      hr.help_types,
      hr.other_help_text,
      hr.affected_people_count,
      hr.risk_flags,
      hr.vulnerable_groups,
      hr.need_type,
      hr.description,
      hr.blood_type,
      hr.contact_full_name,
      hr.contact_phone,
      hr.contact_alternative_phone,
      hr.consent_given,
      hr.status,
      hr.created_at,
      hr.resolved_at,
      hr.is_saved_locally,
      rl.location_id,
      rl.country,
      rl.city,
      rl.district,
      rl.neighborhood,
      rl.extra_address,
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
          help_types,
          other_help_text,
          affected_people_count,
          risk_flags,
          vulnerable_groups,
          need_type,
          description,
          blood_type,
          contact_full_name,
          contact_phone,
          contact_alternative_phone,
          consent_given,
          is_saved_locally
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING
          request_id,
          user_id,
          help_types,
          other_help_text,
          affected_people_count,
          risk_flags,
          vulnerable_groups,
          need_type,
          description,
          blood_type,
          contact_full_name,
          contact_phone,
          contact_alternative_phone,
          consent_given,
          status,
          created_at,
          resolved_at,
          is_saved_locally
      `,
      [
        requestId,
        input.userId,
        input.helpTypes,
        input.otherHelpText,
        input.affectedPeopleCount,
        input.riskFlags,
        input.vulnerableGroups,
        input.needType,
        input.description,
        input.bloodType || null,
        input.contact.fullName,
        input.contact.phone,
        input.contact.alternativePhone ?? null,
        input.consentGiven,
        input.isSavedLocally,
      ],
    );

    let locationRow = null;

    if (input.location) {
      const locationResult = await client.query(
        `
          INSERT INTO request_locations (
            location_id,
            request_id,
            country,
            city,
            district,
            neighborhood,
            extra_address,
            latitude,
            longitude,
            is_gps_location,
            is_last_known
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING
            location_id,
            country,
            city,
            district,
            neighborhood,
            extra_address,
            latitude,
            longitude,
            is_gps_location,
            is_last_known,
            captured_at
        `,
        [
          crypto.randomUUID(),
          requestId,
          input.location.country,
          input.location.city,
          input.location.district,
          input.location.neighborhood,
          input.location.extraAddress || null,
          null,
          null,
          false,
          false,
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

async function markHelpRequestAsSynced(userId, requestId) {
  await query(
    `
      UPDATE help_requests
      SET is_saved_locally = FALSE
      WHERE user_id = $1 AND request_id = $2
    `,
    [userId, requestId],
  );

  return findHelpRequestByIdForUser(userId, requestId);
}

async function markHelpRequestAsResolved(userId, requestId) {
  await query(
    `
      UPDATE help_requests
      SET status = 'RESOLVED',
          resolved_at = CURRENT_TIMESTAMP,
          is_saved_locally = FALSE
      WHERE user_id = $1 AND request_id = $2
    `,
    [userId, requestId],
  );

  return findHelpRequestByIdForUser(userId, requestId);
}

module.exports = {
  createHelpRequest,
  listHelpRequestsByUserId,
  findHelpRequestByIdForUser,
  markHelpRequestAsSynced,
  markHelpRequestAsResolved,
};
