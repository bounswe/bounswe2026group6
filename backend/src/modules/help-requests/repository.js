const crypto = require('crypto');

const { pool, query } = require('../../db/pool');
const { deriveOperationalLevels } = require('./operational');

function runQuery(executor, text, params = []) {
  if (executor && typeof executor.query === 'function') {
    return executor.query(text, params);
  }
  return query(text, params);
}

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

  const location = {
    country: row.country,
    city: row.city,
    district: row.district,
    neighborhood: row.neighborhood,
    extraAddress: row.extra_address || '',
  };

  if (row.latitude != null && row.longitude != null) {
    location.latitude = row.latitude;
    location.longitude = row.longitude;
    location.coordinate = {
      latitude: row.latitude,
      longitude: row.longitude,
      accuracyMeters: null,
      source: row.is_gps_location ? 'GPS' : null,
      capturedAt: row.captured_at,
    };
  }

  return location;
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

function parseHelpers(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeHelperText(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function mapHelperValue(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return {
    firstName: normalizeHelperText(value.firstName),
    lastName: normalizeHelperText(value.lastName),
    phone: value.phone ? Number(value.phone) : null,
    profession: normalizeHelperText(value.profession),
    expertise: normalizeHelperText(value.expertise),
  };
}

function hasVisibleHelperField(helper) {
  return Boolean(
    helper
    && (
      helper.firstName
      || helper.lastName
      || helper.phone != null
      || helper.profession
      || helper.expertise
    )
  );
}

function mapHelpRequest(row) {
  const helpers = parseHelpers(row.helpers)
    .map(mapHelperValue)
    .filter(Boolean);
  const helper = helpers.find(hasVisibleHelperField) || null;
  const derivedOperational = deriveOperationalLevels({
    affectedPeopleCount: row.affected_people_count,
    riskFlags: row.risk_flags,
  });
  const urgencyLevel = row.urgency_level || derivedOperational.urgencyLevel;
  const priorityLevel = row.priority_level || derivedOperational.priorityLevel;
  const closedAt = row.closed_at || row.cancelled_at || row.resolved_at || null;

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
    urgencyLevel,
    priorityLevel,
    openedAt: row.created_at,
    closedAt,
    openDurationMinutes: row.open_duration_minutes,
    closedState:
      row.status === 'RESOLVED'
        ? 'RESOLVED'
        : row.status === 'CANCELLED'
          ? 'CANCELLED'
          : null,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    cancelledAt: row.cancelled_at,
    isSavedLocally: row.is_saved_locally,
    helper,
    helpers,
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
      hr.urgency_level,
      hr.priority_level,
      hr.created_at,
      hr.resolved_at,
      hr.cancelled_at,
      COALESCE(hr.cancelled_at, hr.resolved_at) AS closed_at,
      FLOOR(
        EXTRACT(
          EPOCH FROM (COALESCE(hr.cancelled_at, hr.resolved_at, CURRENT_TIMESTAMP) - hr.created_at)
        ) / 60
      )::int AS open_duration_minutes,
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
      rl.captured_at,
      helper_assignments.helpers AS helpers
    FROM help_requests hr
    LEFT JOIN request_locations rl ON rl.request_id = hr.request_id
    LEFT JOIN LATERAL (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'firstName', helper_profile.first_name,
            'lastName', helper_profile.last_name,
            'phone', helper_profile.phone_number,
            'profession', helper_expertise.profession,
            'expertise', helper_expertise.expertise_area
          )
          ORDER BY assignment_rows.assigned_at ASC, assignment_rows.assignment_id ASC
        ) FILTER (WHERE assignment_rows.assignment_id IS NOT NULL),
        '[]'::json
      ) AS helpers
      FROM (
        SELECT a.assignment_id, a.assigned_at, vol.user_id
        FROM assignments a
        JOIN volunteers vol ON vol.volunteer_id = a.volunteer_id
        WHERE a.request_id = hr.request_id
          AND a.is_cancelled = FALSE
      ) assignment_rows
      LEFT JOIN user_profiles helper_profile ON helper_profile.user_id = assignment_rows.user_id
      LEFT JOIN LATERAL (
        SELECT e.profession, e.expertise_area
        FROM expertise e
        WHERE e.profile_id = helper_profile.profile_id
        ORDER BY e.is_verified DESC, e.expertise_id ASC
        LIMIT 1
      ) helper_expertise ON TRUE
    ) helper_assignments ON TRUE
  `;
}

async function createHelpRequest(input) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const requestId = crypto.randomUUID();
    const operationalLevels = deriveOperationalLevels({
      affectedPeopleCount: input.affectedPeopleCount,
      riskFlags: input.riskFlags,
    });

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
          urgency_level,
          priority_level,
          is_saved_locally
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
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
          urgency_level,
          priority_level,
          created_at,
          resolved_at,
          cancelled_at,
          COALESCE(cancelled_at, resolved_at) AS closed_at,
          FLOOR(
            EXTRACT(
              EPOCH FROM (COALESCE(cancelled_at, resolved_at, CURRENT_TIMESTAMP) - created_at)
            ) / 60
          )::int AS open_duration_minutes,
          is_saved_locally
      `,
      [
        requestId,
        input.userId || null,
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
        operationalLevels.urgencyLevel,
        operationalLevels.priorityLevel,
        input.isSavedLocally,
      ],
    );

    let locationRow = null;

    if (input.location) {
      const coordinate = input.location.coordinate || null;
      const latitude = input.location.latitude ?? coordinate?.latitude ?? null;
      const longitude = input.location.longitude ?? coordinate?.longitude ?? null;
      const isGpsLocation = Boolean(
        coordinate
        && typeof coordinate.source === 'string'
        && coordinate.source.toUpperCase().includes('GPS'),
      );

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
          input.location.displayAddress || input.location.extraAddress || null,
          latitude,
          longitude,
          isGpsLocation,
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

async function updateHelpRequestByRequestId(requestId, input, executor = null) {
  const client = executor || await pool.connect();
  const shouldManageTransaction = !executor;

  try {
    if (shouldManageTransaction) {
      await client.query('BEGIN');
    }

    const operationalLevels = deriveOperationalLevels({
      affectedPeopleCount: input.affectedPeopleCount,
      riskFlags: input.riskFlags,
    });

    const requestResult = await client.query(
      `
        UPDATE help_requests
        SET help_types = $2,
            other_help_text = $3,
            affected_people_count = $4,
            risk_flags = $5,
            vulnerable_groups = $6,
            need_type = $7,
            description = $8,
            blood_type = $9,
            contact_full_name = $10,
            contact_phone = $11,
            contact_alternative_phone = $12,
            consent_given = $13,
            urgency_level = $14,
            priority_level = $15,
            is_saved_locally = FALSE
        WHERE request_id = $1
          AND status NOT IN ('RESOLVED', 'CANCELLED')
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
          urgency_level,
          priority_level,
          created_at,
          resolved_at,
          cancelled_at,
          COALESCE(cancelled_at, resolved_at) AS closed_at,
          FLOOR(
            EXTRACT(
              EPOCH FROM (COALESCE(cancelled_at, resolved_at, CURRENT_TIMESTAMP) - created_at)
            ) / 60
          )::int AS open_duration_minutes,
          is_saved_locally
      `,
      [
        requestId,
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
        operationalLevels.urgencyLevel,
        operationalLevels.priorityLevel,
      ],
    );

    if (requestResult.rows.length === 0) {
      if (shouldManageTransaction) {
        await client.query('ROLLBACK');
      }
      return null;
    }

    const coordinate = input.location.coordinate || null;
    const latitude = input.location.latitude ?? coordinate?.latitude ?? null;
    const longitude = input.location.longitude ?? coordinate?.longitude ?? null;
    const isGpsLocation = Boolean(
      coordinate
      && typeof coordinate.source === 'string'
      && coordinate.source.toUpperCase().includes('GPS'),
    );

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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE)
        ON CONFLICT (request_id) DO UPDATE
        SET country = EXCLUDED.country,
            city = EXCLUDED.city,
            district = EXCLUDED.district,
            neighborhood = EXCLUDED.neighborhood,
            extra_address = EXCLUDED.extra_address,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            is_gps_location = EXCLUDED.is_gps_location,
            is_last_known = FALSE,
            captured_at = CURRENT_TIMESTAMP
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
        input.location.displayAddress || input.location.extraAddress || null,
        latitude,
        longitude,
        isGpsLocation,
      ],
    );

    if (shouldManageTransaction) {
      await client.query('COMMIT');
    }

    return mapHelpRequest({
      ...requestResult.rows[0],
      ...locationResult.rows[0],
    });
  } catch (error) {
    if (shouldManageTransaction) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    if (shouldManageTransaction) {
      client.release();
    }
  }
}

async function updateHelpRequestForUser(userId, requestId, input) {
  const existing = await findHelpRequestByIdForUser(userId, requestId);
  if (!existing) {
    return null;
  }

  return updateHelpRequestByRequestId(requestId, input);
}

async function listHelpRequestsByUserId(userId, executor = null) {
  const result = await runQuery(
    executor,
    `
      ${buildSelectQuery()}
      WHERE hr.user_id = $1
      ORDER BY hr.created_at DESC
    `,
    [userId],
  );

  return result.rows.map(mapHelpRequest);
}

async function findHelpRequestById(requestId) {
  const result = await query(
    `
      ${buildSelectQuery()}
      WHERE hr.request_id = $1
    `,
    [requestId],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapHelpRequest(result.rows[0]);
}

async function findHelpRequestByIdForUser(userId, requestId, executor = null) {
  const result = await runQuery(
    executor,
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

async function markHelpRequestAsSyncedByRequestId(requestId) {
  await query(
    `
      UPDATE help_requests
      SET is_saved_locally = FALSE
      WHERE request_id = $1
    `,
    [requestId],
  );

  return findHelpRequestById(requestId);
}

async function markHelpRequestAsResolved(userId, requestId) {
  await query(
    `
      UPDATE help_requests
      SET status = 'RESOLVED',
          resolved_at = CURRENT_TIMESTAMP,
          cancelled_at = NULL,
          is_saved_locally = FALSE
      WHERE user_id = $1 AND request_id = $2
    `,
    [userId, requestId],
  );

  return findHelpRequestByIdForUser(userId, requestId);
}

async function markHelpRequestAsResolvedByRequestId(requestId) {
  await query(
    `
      UPDATE help_requests
      SET status = 'RESOLVED',
          resolved_at = CURRENT_TIMESTAMP,
          cancelled_at = NULL,
          is_saved_locally = FALSE
      WHERE request_id = $1
    `,
    [requestId],
  );

  return findHelpRequestById(requestId);
}

async function markHelpRequestAsCancelled(userId, requestId, executor = null) {
  await runQuery(
    executor,
    `
      UPDATE help_requests
      SET status = 'CANCELLED',
          cancelled_at = CURRENT_TIMESTAMP,
          is_saved_locally = FALSE
      WHERE user_id = $1 AND request_id = $2
    `,
    [userId, requestId],
  );

  return findHelpRequestByIdForUser(userId, requestId, executor);
}

async function markHelpRequestAsCancelledByRequestId(requestId) {
  await query(
    `
      UPDATE help_requests
      SET status = 'CANCELLED',
          cancelled_at = CURRENT_TIMESTAMP,
          is_saved_locally = FALSE
      WHERE request_id = $1
    `,
    [requestId],
  );

  return findHelpRequestById(requestId);
}

function roundToPrecision(value, digits) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mapActiveVisibilityItem(row, { isAdmin = false } = {}) {
  const derivedOperational = deriveOperationalLevels({
    affectedPeopleCount: row.affected_people_count,
    riskFlags: row.risk_flags,
  });
  const urgencyLevel = row.urgency_level || derivedOperational.urgencyLevel;

  const latitude = row.latitude == null
    ? null
    : isAdmin
      ? Number(row.latitude)
      : roundToPrecision(Number(row.latitude), 3);
  const longitude = row.longitude == null
    ? null
    : isAdmin
      ? Number(row.longitude)
      : roundToPrecision(Number(row.longitude), 3);

  const location = {
    latitude,
    longitude,
    city: row.city || 'unknown',
    district: row.district || 'unknown',
  };

  if (isAdmin) {
    location.neighborhood = row.neighborhood || 'unknown';
  }

  return {
    requestId: row.request_id,
    type: row.need_type,
    status: row.status,
    urgencyLevel,
    createdAt: row.created_at,
    assignmentState: row.active_assignment_id ? 'ASSIGNED' : 'UNASSIGNED',
    location,
  };
}

async function listActiveHelpRequestsVisibility({
  typeFilters = [],
  statusFilters = ['PENDING', 'ASSIGNED', 'IN_PROGRESS'],
  bbox = null,
  limit = 100,
  offset = 0,
  isAdmin = false,
} = {}) {
  const params = [
    statusFilters,
    typeFilters.length > 0 ? typeFilters : null,
    bbox ? bbox.minLng : null,
    bbox ? bbox.minLat : null,
    bbox ? bbox.maxLng : null,
    bbox ? bbox.maxLat : null,
    limit,
    offset,
  ];

  const [countResult, rowsResult] = await Promise.all([
    query(
      `
        SELECT COUNT(*)::int AS total_count
        FROM help_requests hr
        LEFT JOIN LATERAL (
          SELECT
            loc.latitude,
            loc.longitude
          FROM request_locations loc
          WHERE loc.request_id = hr.request_id
          ORDER BY loc.captured_at DESC, loc.location_id DESC
          LIMIT 1
        ) rl ON TRUE
        WHERE hr.status = ANY($1::request_status[])
          AND ($2::text[] IS NULL OR LOWER(hr.need_type) = ANY($2))
          AND (
            $3::double precision IS NULL
            OR (
              rl.longitude IS NOT NULL
              AND rl.latitude IS NOT NULL
              AND rl.longitude BETWEEN $3::double precision AND $5::double precision
              AND rl.latitude BETWEEN $4::double precision AND $6::double precision
            )
          )
      `,
      params.slice(0, 6),
    ),
    query(
      `
        SELECT
          hr.request_id,
          LOWER(COALESCE(NULLIF(TRIM(hr.need_type), ''), 'unknown')) AS need_type,
          hr.status,
          hr.urgency_level,
          hr.affected_people_count,
          hr.risk_flags,
          hr.created_at,
          rl.latitude,
          rl.longitude,
          COALESCE(NULLIF(TRIM(rl.city), ''), 'unknown') AS city,
          COALESCE(NULLIF(TRIM(rl.district), ''), 'unknown') AS district,
          COALESCE(NULLIF(TRIM(rl.neighborhood), ''), 'unknown') AS neighborhood,
          aa.assignment_id AS active_assignment_id
        FROM help_requests hr
        LEFT JOIN LATERAL (
          SELECT
            loc.latitude,
            loc.longitude,
            loc.city,
            loc.district,
            loc.neighborhood
          FROM request_locations loc
          WHERE loc.request_id = hr.request_id
          ORDER BY loc.captured_at DESC, loc.location_id DESC
          LIMIT 1
        ) rl ON TRUE
        LEFT JOIN LATERAL (
          SELECT a.assignment_id
          FROM assignments a
          WHERE a.request_id = hr.request_id
            AND a.is_cancelled = FALSE
          ORDER BY a.assigned_at DESC, a.assignment_id DESC
          LIMIT 1
        ) aa ON TRUE
        WHERE hr.status = ANY($1::request_status[])
          AND ($2::text[] IS NULL OR LOWER(hr.need_type) = ANY($2))
          AND (
            $3::double precision IS NULL
            OR (
              rl.longitude IS NOT NULL
              AND rl.latitude IS NOT NULL
              AND rl.longitude BETWEEN $3::double precision AND $5::double precision
              AND rl.latitude BETWEEN $4::double precision AND $6::double precision
            )
          )
        ORDER BY hr.created_at DESC
        LIMIT $7::int
        OFFSET $8::int
      `,
      params,
    ),
  ]);

  return {
    items: rowsResult.rows.map((row) => mapActiveVisibilityItem(row, { isAdmin })),
    total: countResult.rows[0]?.total_count || 0,
  };
}

module.exports = {
  createHelpRequest,
  updateHelpRequestForUser,
  updateHelpRequestByRequestId,
  listHelpRequestsByUserId,
  findHelpRequestById,
  findHelpRequestByIdForUser,
  markHelpRequestAsSynced,
  markHelpRequestAsSyncedByRequestId,
  markHelpRequestAsResolved,
  markHelpRequestAsResolvedByRequestId,
  markHelpRequestAsCancelled,
  markHelpRequestAsCancelledByRequestId,
  listActiveHelpRequestsVisibility,
};
