const { query } = require('../../db/pool');

function getDerivedUrgencySql() {
  return `
    CASE
      WHEN COALESCE(array_length(hr.risk_flags, 1), 0) >= 2 OR hr.affected_people_count >= 5 THEN 'HIGH'
      WHEN COALESCE(array_length(hr.risk_flags, 1), 0) = 1 OR hr.affected_people_count BETWEEN 3 AND 4 THEN 'MEDIUM'
      ELSE 'LOW'
    END
  `;
}

function getUrgencySql() {
  const derivedUrgencySql = getDerivedUrgencySql();
  return `COALESCE(hr.urgency_level, (${derivedUrgencySql}))`;
}

function getPrioritySql() {
  const urgencySql = getUrgencySql();
  return `COALESCE(hr.priority_level, (${urgencySql}))`;
}

async function listUsers() {
  const result = await query(
    `
      SELECT
        u.user_id,
        u.email,
        u.is_email_verified,
        u.created_at,
        u.is_deleted,
        u.accepted_terms,
        a.admin_id,
        a.role AS admin_role
      FROM users u
      LEFT JOIN admins a ON a.user_id = u.user_id
      ORDER BY u.created_at DESC
      LIMIT 100
    `,
  );

  return result.rows;
}

async function listHelpRequests() {
  const result = await query(
    `
      SELECT
        request_id,
        user_id,
        need_type,
        description,
        status,
        created_at,
        resolved_at,
        is_saved_locally
      FROM help_requests
      ORDER BY created_at DESC
      LIMIT 100
    `,
  );

  return result.rows;
}

async function listAnnouncements() {
  const result = await query(
    `
      SELECT
        announcement_id,
        admin_id,
        title,
        content,
        created_at
      FROM news_announcements
      ORDER BY created_at DESC
      LIMIT 100
    `,
  );

  return result.rows;
}

async function getBasicStats() {
  const [usersResult, helpRequestsResult, announcementsResult, adminsResult] =
    await Promise.all([
      query(`SELECT COUNT(*)::int AS count FROM users WHERE is_deleted = FALSE`),
      query(`SELECT COUNT(*)::int AS count FROM help_requests`),
      query(`SELECT COUNT(*)::int AS count FROM news_announcements`),
      query(`SELECT COUNT(*)::int AS count FROM admins`),
    ]);

  return {
    totalUsers: usersResult.rows[0].count,
    totalHelpRequests: helpRequestsResult.rows[0].count,
    totalAnnouncements: announcementsResult.rows[0].count,
    totalAdmins: adminsResult.rows[0].count,
  };
}

async function getEmergencyOverview({ includeRegionSummary = false } = {}) {
  const urgencySql = getUrgencySql();
  const prioritySql = getPrioritySql();
  const overviewQueries = [
    query(
      `
        SELECT
          COUNT(*)::int AS total_count,
          COUNT(*) FILTER (WHERE status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS'))::int AS active_count,
          COUNT(*) FILTER (WHERE status = 'RESOLVED')::int AS resolved_count,
          COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled_count,
          COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending_count,
          COUNT(*) FILTER (WHERE status IN ('ASSIGNED', 'IN_PROGRESS'))::int AS in_progress_count
        FROM help_requests
      `,
    ),
    query(
      `
        SELECT
          COUNT(*) FILTER (WHERE urgency_level = 'LOW')::int AS low_count,
          COUNT(*) FILTER (WHERE urgency_level = 'MEDIUM')::int AS medium_count,
          COUNT(*) FILTER (WHERE urgency_level = 'HIGH')::int AS high_count
        FROM (
          SELECT
            ${urgencySql} AS urgency_level
          FROM help_requests hr
        ) urgency_map
      `,
    ),
    query(
      `
        SELECT
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS created_last_24h,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS created_last_7d,
          COUNT(*) FILTER (
            WHERE resolved_at IS NOT NULL
            AND resolved_at >= NOW() - INTERVAL '24 hours'
          )::int AS resolved_last_24h,
          COUNT(*) FILTER (
            WHERE resolved_at IS NOT NULL
            AND resolved_at >= NOW() - INTERVAL '7 days'
          )::int AS resolved_last_7d,
          COUNT(*) FILTER (
            WHERE cancelled_at IS NOT NULL
            AND cancelled_at >= NOW() - INTERVAL '24 hours'
          )::int AS cancelled_last_24h,
          COUNT(*) FILTER (
            WHERE cancelled_at IS NOT NULL
            AND cancelled_at >= NOW() - INTERVAL '7 days'
          )::int AS cancelled_last_7d
        FROM help_requests
      `,
    ),
    query(
      `
        SELECT
          hr.request_id,
          hr.need_type,
          hr.status,
          ${urgencySql} AS urgency_level,
          ${prioritySql} AS priority_level,
          hr.created_at AS opened_at,
          FLOOR(
            EXTRACT(
              EPOCH FROM (COALESCE(hr.cancelled_at, hr.resolved_at, CURRENT_TIMESTAMP) - hr.created_at)
            ) / 60
          )::int AS open_duration_minutes,
          COALESCE(NULLIF(TRIM(rl.city), ''), 'unknown') AS city,
          COALESCE(NULLIF(TRIM(rl.district), ''), 'unknown') AS district,
          COALESCE(hr.cancelled_at, hr.resolved_at) AS closed_at,
          CASE
            WHEN hr.status = 'RESOLVED' THEN 'RESOLVED'
            WHEN hr.status = 'CANCELLED' THEN 'CANCELLED'
            ELSE NULL
          END AS closed_state
        FROM help_requests hr
        LEFT JOIN LATERAL (
          SELECT city, district
          FROM request_locations loc
          WHERE loc.request_id = hr.request_id
          ORDER BY loc.captured_at DESC, loc.location_id DESC
          LIMIT 1
        ) rl ON TRUE
        WHERE hr.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS')
        ORDER BY
          CASE ${prioritySql}
            WHEN 'HIGH' THEN 3
            WHEN 'MEDIUM' THEN 2
            ELSE 1
          END DESC,
          CASE ${urgencySql}
            WHEN 'HIGH' THEN 3
            WHEN 'MEDIUM' THEN 2
            ELSE 1
          END DESC,
          open_duration_minutes DESC,
          hr.created_at ASC
        LIMIT 15
      `,
    ),
  ];

  if (includeRegionSummary) {
    overviewQueries.push(
      query(
        `
          SELECT
            COALESCE(NULLIF(TRIM(rl.city), ''), 'unknown') AS city,
            COUNT(*)::int AS total_count,
            COUNT(*) FILTER (WHERE hr.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS'))::int AS active_count,
            COUNT(*) FILTER (WHERE hr.status = 'PENDING')::int AS pending_count,
            COUNT(*) FILTER (WHERE hr.status IN ('ASSIGNED', 'IN_PROGRESS'))::int AS in_progress_count,
            COUNT(*) FILTER (WHERE hr.status = 'RESOLVED')::int AS resolved_count,
            COUNT(*) FILTER (WHERE hr.status = 'CANCELLED')::int AS cancelled_count
          FROM help_requests hr
          LEFT JOIN LATERAL (
            SELECT city
            FROM request_locations loc
            WHERE loc.request_id = hr.request_id
            ORDER BY loc.captured_at DESC, loc.location_id DESC
            LIMIT 1
          ) rl ON TRUE
          GROUP BY city
          ORDER BY total_count DESC, city ASC
          LIMIT 10
        `,
      ),
    );
  }

  const [statusResult, urgencyResult, recentActivityResult, activeOperationalResult, regionResult] = await Promise.all(overviewQueries);

  const status = statusResult.rows[0];
  const urgency = urgencyResult.rows[0];
  const recent = recentActivityResult.rows[0];

  const overview = {
    totals: {
      totalEmergencies: status.total_count,
      activeEmergencies: status.active_count,
      resolvedEmergencies: status.resolved_count,
      closedEmergencies: status.resolved_count + status.cancelled_count,
    },
    statusBreakdown: {
      pending: status.pending_count,
      inProgress: status.in_progress_count,
      resolved: status.resolved_count,
      cancelled: status.cancelled_count,
    },
    urgencyBreakdown: {
      low: urgency.low_count,
      medium: urgency.medium_count,
      high: urgency.high_count,
    },
    recentActivity: {
      createdLast24Hours: recent.created_last_24h,
      createdLast7Days: recent.created_last_7d,
      resolvedLast24Hours: recent.resolved_last_24h,
      resolvedLast7Days: recent.resolved_last_7d,
      cancelledLast24Hours: recent.cancelled_last_24h,
      cancelledLast7Days: recent.cancelled_last_7d,
    },
    activeOperational: activeOperationalResult.rows.map((row) => ({
      requestId: row.request_id,
      needType: row.need_type,
      status: row.status,
      urgencyLevel: row.urgency_level,
      priorityLevel: row.priority_level,
      openedAt: row.opened_at,
      openDurationMinutes: row.open_duration_minutes,
      closedAt: row.closed_at,
      closedState: row.closed_state,
      location: {
        city: row.city,
        district: row.district,
      },
    })),
  };

  if (includeRegionSummary) {
    overview.regionSummary = regionResult.rows.map((row) => ({
      city: row.city,
      total: row.total_count,
      active: row.active_count,
      pending: row.pending_count,
      inProgress: row.in_progress_count,
      resolved: row.resolved_count,
      cancelled: row.cancelled_count,
    }));
  }

  return overview;
}

async function getEmergencyHistory({
  statuses = null,
  cities = null,
  needTypes = null,
  urgencies = null,
  limit = 50,
  offset = 0,
} = {}) {
  const urgencySql = getUrgencySql();
  const prioritySql = getPrioritySql();

  const [countResult, rowsResult] = await Promise.all([
    query(
      `
        SELECT COUNT(*)::int AS total_count
        FROM help_requests hr
        LEFT JOIN LATERAL (
          SELECT city
          FROM request_locations loc
          WHERE loc.request_id = hr.request_id
          ORDER BY loc.captured_at DESC, loc.location_id DESC
          LIMIT 1
        ) rl ON TRUE
        WHERE hr.status IN ('RESOLVED', 'CANCELLED')
          AND ($1::request_status[] IS NULL OR hr.status = ANY($1))
          AND ($2::text[] IS NULL OR LOWER(COALESCE(NULLIF(TRIM(rl.city), ''), 'unknown')) = ANY($2))
          AND ($3::text[] IS NULL OR LOWER(hr.need_type) = ANY($3))
          AND ($4::text[] IS NULL OR (${urgencySql}) = ANY($4))
      `,
      [statuses, cities, needTypes, urgencies],
    ),
    query(
    `
      SELECT
        hr.request_id,
        hr.need_type,
        hr.description,
        hr.status,
        hr.created_at,
        hr.resolved_at,
        hr.cancelled_at,
        COALESCE(hr.cancelled_at, hr.resolved_at, hr.created_at) AS closed_at,
        hr.created_at AS opened_at,
        FLOOR(
          EXTRACT(
            EPOCH FROM (COALESCE(hr.cancelled_at, hr.resolved_at, hr.created_at) - hr.created_at)
          ) / 60
        )::int AS open_duration_minutes,
        CASE
          WHEN hr.status = 'RESOLVED' THEN 'RESOLVED'
          WHEN hr.status = 'CANCELLED' THEN 'CANCELLED'
          ELSE NULL
        END AS closed_state,
        hr.affected_people_count,
        hr.risk_flags,
        COALESCE(NULLIF(TRIM(rl.country), ''), 'unknown') AS country,
        COALESCE(NULLIF(TRIM(rl.city), ''), 'unknown') AS city,
        COALESCE(NULLIF(TRIM(rl.district), ''), 'unknown') AS district,
        ${urgencySql} AS urgency_level,
        ${prioritySql} AS priority_level
      FROM help_requests hr
      LEFT JOIN LATERAL (
        SELECT country, city, district
        FROM request_locations loc
        WHERE loc.request_id = hr.request_id
        ORDER BY loc.captured_at DESC, loc.location_id DESC
        LIMIT 1
      ) rl ON TRUE
      WHERE hr.status IN ('RESOLVED', 'CANCELLED')
        AND ($1::request_status[] IS NULL OR hr.status = ANY($1))
        AND ($2::text[] IS NULL OR LOWER(COALESCE(NULLIF(TRIM(rl.city), ''), 'unknown')) = ANY($2))
        AND ($3::text[] IS NULL OR LOWER(hr.need_type) = ANY($3))
        AND ($4::text[] IS NULL OR (${urgencySql}) = ANY($4))
      ORDER BY closed_at DESC, hr.created_at DESC
      LIMIT $5::int
      OFFSET $6::int
    `,
    [statuses, cities, needTypes, urgencies, limit, offset],
  )]);

  const history = rowsResult.rows.map((row) => ({
    requestId: row.request_id,
    needType: row.need_type,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    cancelledAt: row.cancelled_at,
    closedAt: row.closed_at,
    openedAt: row.opened_at,
    openDurationMinutes: row.open_duration_minutes,
    closedState: row.closed_state,
    location: {
      country: row.country,
      city: row.city,
      district: row.district,
    },
    affectedPeopleCount: row.affected_people_count,
    urgencyLevel: row.urgency_level,
    priorityLevel: row.priority_level,
    riskFlags: row.risk_flags || [],
  }));

  return {
    history,
    total: countResult.rows[0]?.total_count || 0,
  };
}

async function getEmergencyAnalytics({
  regionLimit = 10,
  trendDays = 14,
  comparisonWindowDays = 7,
} = {}) {
  const [regionResult, typeResult, trendResult, comparisonResult] = await Promise.all([
    query(
      `
        SELECT
          COALESCE(NULLIF(TRIM(rl.city), ''), 'unknown') AS city,
          COUNT(*)::int AS total_count,
          COUNT(*) FILTER (WHERE hr.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS'))::int AS active_count,
          COUNT(*) FILTER (WHERE hr.status = 'PENDING')::int AS pending_count,
          COUNT(*) FILTER (WHERE hr.status IN ('ASSIGNED', 'IN_PROGRESS'))::int AS in_progress_count,
          COUNT(*) FILTER (WHERE hr.status = 'RESOLVED')::int AS resolved_count,
          COUNT(*) FILTER (WHERE hr.status = 'CANCELLED')::int AS cancelled_count
        FROM help_requests hr
        LEFT JOIN LATERAL (
          SELECT city
          FROM request_locations loc
          WHERE loc.request_id = hr.request_id
          ORDER BY loc.captured_at DESC, loc.location_id DESC
          LIMIT 1
        ) rl ON TRUE
        GROUP BY city
        ORDER BY total_count DESC, city ASC
        LIMIT $1::int
      `,
      [regionLimit],
    ),
    query(
      `
        SELECT
          COALESCE(NULLIF(TRIM(hr.need_type), ''), 'unknown') AS need_type,
          COUNT(*)::int AS total_count,
          COUNT(*) FILTER (WHERE hr.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS'))::int AS active_count,
          COUNT(*) FILTER (WHERE hr.status = 'RESOLVED')::int AS resolved_count,
          COUNT(*) FILTER (WHERE hr.status = 'CANCELLED')::int AS cancelled_count
        FROM help_requests hr
        GROUP BY need_type
        ORDER BY total_count DESC, need_type ASC
      `,
    ),
    query(
      `
        WITH day_series AS (
          SELECT generate_series(
            (CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day')::date,
            CURRENT_DATE,
            INTERVAL '1 day'
          )::date AS day
        )
        SELECT
          ds.day AS day,
          COALESCE(SUM(CASE WHEN hr.created_at::date = ds.day THEN 1 ELSE 0 END), 0)::int AS created_count,
          COALESCE(SUM(CASE WHEN hr.resolved_at IS NOT NULL AND hr.resolved_at::date = ds.day THEN 1 ELSE 0 END), 0)::int AS resolved_count,
          COALESCE(SUM(CASE WHEN hr.cancelled_at IS NOT NULL AND hr.cancelled_at::date = ds.day THEN 1 ELSE 0 END), 0)::int AS cancelled_count
        FROM day_series ds
        LEFT JOIN help_requests hr
          ON hr.created_at::date = ds.day
          OR hr.resolved_at::date = ds.day
          OR hr.cancelled_at::date = ds.day
        GROUP BY ds.day
        ORDER BY ds.day ASC
      `,
      [trendDays],
    ),
    query(
      `
        WITH windows AS (
          SELECT
            (NOW() - ($1::int * INTERVAL '1 day')) AS current_start,
            (NOW() - (2 * $1::int * INTERVAL '1 day')) AS previous_start,
            (NOW() - ($1::int * INTERVAL '1 day')) AS previous_end
        )
        SELECT
          COUNT(*) FILTER (WHERE hr.created_at >= w.current_start)::int AS current_created,
          COUNT(*) FILTER (
            WHERE hr.created_at >= w.previous_start AND hr.created_at < w.previous_end
          )::int AS previous_created,
          COUNT(*) FILTER (
            WHERE hr.resolved_at IS NOT NULL AND hr.resolved_at >= w.current_start
          )::int AS current_resolved,
          COUNT(*) FILTER (
            WHERE hr.resolved_at IS NOT NULL
              AND hr.resolved_at >= w.previous_start
              AND hr.resolved_at < w.previous_end
          )::int AS previous_resolved,
          COUNT(*) FILTER (
            WHERE hr.cancelled_at IS NOT NULL AND hr.cancelled_at >= w.current_start
          )::int AS current_cancelled,
          COUNT(*) FILTER (
            WHERE hr.cancelled_at IS NOT NULL
              AND hr.cancelled_at >= w.previous_start
              AND hr.cancelled_at < w.previous_end
          )::int AS previous_cancelled
        FROM help_requests hr
        CROSS JOIN windows w
      `,
      [comparisonWindowDays],
    ),
  ]);

  const typeRows = typeResult.rows;
  const typeTotal = typeRows.reduce((sum, row) => sum + row.total_count, 0);

  const buildComparison = (current, previous) => {
    const delta = current - previous;
    let percentChange = null;
    if (previous > 0) {
      percentChange = Math.round((delta / previous) * 1000) / 10;
    } else if (current > 0) {
      percentChange = null;
    } else {
      percentChange = 0;
    }
    return { current, previous, delta, percentChange };
  };

  const cmp = comparisonResult.rows[0] || {};

  return {
    regionBreakdown: regionResult.rows.map((row) => ({
      city: row.city,
      total: row.total_count,
      active: row.active_count,
      pending: row.pending_count,
      inProgress: row.in_progress_count,
      resolved: row.resolved_count,
      cancelled: row.cancelled_count,
    })),
    typeBreakdown: typeRows.map((row) => ({
      needType: row.need_type,
      total: row.total_count,
      active: row.active_count,
      resolved: row.resolved_count,
      cancelled: row.cancelled_count,
      percentage:
        typeTotal > 0 ? Math.round((row.total_count / typeTotal) * 1000) / 10 : 0,
    })),
    dailyTrend: trendResult.rows.map((row) => ({
      date: row.day instanceof Date ? row.day.toISOString().slice(0, 10) : row.day,
      created: row.created_count,
      resolved: row.resolved_count,
      cancelled: row.cancelled_count,
    })),
    periodComparison: {
      windowDays: comparisonWindowDays,
      created: buildComparison(cmp.current_created || 0, cmp.previous_created || 0),
      resolved: buildComparison(cmp.current_resolved || 0, cmp.previous_resolved || 0),
      cancelled: buildComparison(cmp.current_cancelled || 0, cmp.previous_cancelled || 0),
    },
  };
}

async function getDeploymentMonitoring({
  waitThresholdHours = 6,
  neglectThresholdHours = 12,
  listLimit = 10,
} = {}) {
  const urgencySql = getUrgencySql();
  const prioritySql = getPrioritySql();

  // Item projection shared across signal lists. `a` is an active (non-cancelled)
  // assignment LEFT JOIN, so unassigned rows still resolve cleanly.
  const itemSelect = `
    SELECT
      hr.request_id,
      hr.need_type,
      hr.status,
      ${urgencySql} AS urgency_level,
      ${prioritySql} AS priority_level,
      hr.created_at AS created_at,
      FLOOR(EXTRACT(EPOCH FROM (NOW() - hr.created_at)) / 3600)::int AS age_hours,
      a.assigned_at AS assigned_at,
      CASE
        WHEN a.assigned_at IS NULL THEN NULL
        ELSE FLOOR(EXTRACT(EPOCH FROM (NOW() - a.assigned_at)) / 3600)::int
      END AS assigned_hours_ago,
      a.volunteer_id AS volunteer_id,
      COALESCE(NULLIF(TRIM(rl.city), ''), 'unknown') AS city,
      COALESCE(NULLIF(TRIM(rl.district), ''), 'unknown') AS district,
      hr.contact_phone AS contact_phone
    FROM help_requests hr
    LEFT JOIN LATERAL (
      SELECT city, district
      FROM request_locations loc
      WHERE loc.request_id = hr.request_id
      ORDER BY loc.captured_at DESC, loc.location_id DESC
      LIMIT 1
    ) rl ON TRUE
    LEFT JOIN assignments a
      ON a.request_id = hr.request_id
      AND a.is_cancelled = FALSE
  `;

  const [
    unassignedResult,
    longWaitingResult,
    inProgressResult,
    neglectedResult,
    conflictsResult,
    summaryResult,
  ] = await Promise.all([
    query(
      `
        ${itemSelect}
        WHERE hr.status = 'PENDING'
          AND a.assignment_id IS NULL
        ORDER BY hr.created_at ASC
        LIMIT $1::int
      `,
      [listLimit],
    ),
    query(
      `
        ${itemSelect}
        WHERE hr.status = 'PENDING'
          AND hr.created_at < NOW() - ($1::int * INTERVAL '1 hour')
        ORDER BY hr.created_at ASC
        LIMIT $2::int
      `,
      [waitThresholdHours, listLimit],
    ),
    query(
      `
        ${itemSelect}
        WHERE hr.status IN ('ASSIGNED', 'IN_PROGRESS')
        ORDER BY a.assigned_at ASC NULLS FIRST, hr.created_at ASC
        LIMIT $1::int
      `,
      [listLimit],
    ),
    query(
      `
        ${itemSelect}
        WHERE hr.status IN ('ASSIGNED', 'IN_PROGRESS')
          AND a.assignment_id IS NOT NULL
          AND a.assigned_at < NOW() - ($1::int * INTERVAL '1 hour')
        ORDER BY a.assigned_at ASC
        LIMIT $2::int
      `,
      [neglectThresholdHours, listLimit],
    ),
    query(
      `
        WITH duplicate_groups AS (
          SELECT
            LOWER(hr.need_type) AS need_type_key,
            LOWER(COALESCE(NULLIF(TRIM(rl.city), ''), 'unknown')) AS city_key,
            hr.contact_phone AS contact_phone,
            COUNT(*)::int AS dup_count
          FROM help_requests hr
          LEFT JOIN LATERAL (
            SELECT city
            FROM request_locations loc
            WHERE loc.request_id = hr.request_id
            ORDER BY loc.captured_at DESC, loc.location_id DESC
            LIMIT 1
          ) rl ON TRUE
          WHERE hr.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS')
            AND hr.created_at > NOW() - INTERVAL '24 hours'
          GROUP BY
            LOWER(hr.need_type),
            LOWER(COALESCE(NULLIF(TRIM(rl.city), ''), 'unknown')),
            hr.contact_phone
          HAVING COUNT(*) > 1
          ORDER BY dup_count DESC, city_key ASC, need_type_key ASC, contact_phone ASC
          LIMIT $1::int
        )
        SELECT
          dg.need_type_key,
          dg.city_key,
          dg.contact_phone,
          dg.dup_count,
          hr.request_id,
          hr.need_type,
          hr.status,
          ${urgencySql} AS urgency_level,
          ${prioritySql} AS priority_level,
          hr.created_at AS created_at,
          FLOOR(EXTRACT(EPOCH FROM (NOW() - hr.created_at)) / 3600)::int AS age_hours,
          a.assigned_at AS assigned_at,
          CASE
            WHEN a.assigned_at IS NULL THEN NULL
            ELSE FLOOR(EXTRACT(EPOCH FROM (NOW() - a.assigned_at)) / 3600)::int
          END AS assigned_hours_ago,
          a.volunteer_id AS volunteer_id,
          COALESCE(NULLIF(TRIM(rl.city), ''), 'unknown') AS city,
          COALESCE(NULLIF(TRIM(rl.district), ''), 'unknown') AS district
        FROM duplicate_groups dg
        JOIN help_requests hr
          ON LOWER(hr.need_type) = dg.need_type_key
          AND hr.contact_phone = dg.contact_phone
          AND hr.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS')
          AND hr.created_at > NOW() - INTERVAL '24 hours'
        LEFT JOIN LATERAL (
          SELECT city, district
          FROM request_locations loc
          WHERE loc.request_id = hr.request_id
          ORDER BY loc.captured_at DESC, loc.location_id DESC
          LIMIT 1
        ) rl ON TRUE
        LEFT JOIN assignments a
          ON a.request_id = hr.request_id AND a.is_cancelled = FALSE
        WHERE LOWER(COALESCE(NULLIF(TRIM(rl.city), ''), 'unknown')) = dg.city_key
        ORDER BY
          dg.dup_count DESC,
          dg.city_key ASC,
          dg.need_type_key ASC,
          dg.contact_phone ASC,
          hr.created_at ASC
      `,
      [listLimit],
    ),
    query(
      `
        SELECT
          (
            SELECT COUNT(*)::int
            FROM help_requests hr
            LEFT JOIN assignments a
              ON a.request_id = hr.request_id AND a.is_cancelled = FALSE
            WHERE hr.status = 'PENDING' AND a.assignment_id IS NULL
          ) AS unassigned_count,
          (
            SELECT COUNT(*)::int
            FROM help_requests hr
            WHERE hr.status = 'PENDING'
              AND hr.created_at < NOW() - ($1::int * INTERVAL '1 hour')
          ) AS long_waiting_count,
          (
            SELECT COUNT(*)::int
            FROM help_requests hr
            WHERE hr.status IN ('ASSIGNED', 'IN_PROGRESS')
          ) AS in_progress_count,
          (
            SELECT COUNT(*)::int
            FROM help_requests hr
            JOIN assignments a
              ON a.request_id = hr.request_id AND a.is_cancelled = FALSE
            WHERE hr.status IN ('ASSIGNED', 'IN_PROGRESS')
              AND a.assigned_at < NOW() - ($2::int * INTERVAL '1 hour')
          ) AS neglected_count,
          (
            SELECT COUNT(*)::int
            FROM (
              SELECT 1
              FROM help_requests hr
              LEFT JOIN LATERAL (
                SELECT city
                FROM request_locations loc
                WHERE loc.request_id = hr.request_id
                ORDER BY loc.captured_at DESC, loc.location_id DESC
                LIMIT 1
              ) rl ON TRUE
              WHERE hr.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS')
                AND hr.created_at > NOW() - INTERVAL '24 hours'
              GROUP BY
                LOWER(hr.need_type),
                LOWER(COALESCE(NULLIF(TRIM(rl.city), ''), 'unknown')),
                hr.contact_phone
              HAVING COUNT(*) > 1
            ) duplicate_groups
          ) AS conflicts_count
      `,
      [waitThresholdHours, neglectThresholdHours],
    ),
  ]);

  const mapItem = (row) => ({
    requestId: row.request_id,
    needType: row.need_type,
    status: row.status,
    urgencyLevel: row.urgency_level,
    priorityLevel: row.priority_level,
    createdAt: row.created_at,
    ageHours: row.age_hours,
    assignedAt: row.assigned_at,
    assignedHoursAgo: row.assigned_hours_ago,
    volunteerId: row.volunteer_id || null,
    location: {
      city: row.city,
      district: row.district,
    },
  });

  const maskContactKey = (contactPhone) => {
    const digits = String(contactPhone ?? '').replace(/\D/g, '');
    if (digits.length >= 4) {
      return `***${digits.slice(-4)}`;
    }
    if (digits.length > 0) {
      return `***${digits}`;
    }
    return 'unknown';
  };

  // Group conflicts by (city, needType, contact) to avoid merging unrelated
  // duplicate groups that share only city/type.
  const conflictsByKey = new Map();
  for (const row of conflictsResult.rows) {
    const key = `${row.city_key}::${row.need_type_key}::${String(row.contact_phone ?? '')}`;
    if (!conflictsByKey.has(key)) {
      conflictsByKey.set(key, {
        groupKey: {
          city: row.city_key,
          needType: row.need_type_key,
          contactKey: maskContactKey(row.contact_phone),
        },
        duplicateCount: row.dup_count,
        items: [],
      });
    }
    conflictsByKey.get(key).items.push(mapItem(row));
  }

  const summary = summaryResult.rows[0] || {};

  return {
    thresholds: {
      waitThresholdHours,
      neglectThresholdHours,
      listLimit,
    },
    summary: {
      unassigned: summary.unassigned_count || 0,
      longWaiting: summary.long_waiting_count || 0,
      inProgress: summary.in_progress_count || 0,
      neglected: summary.neglected_count || 0,
      conflicts: summary.conflicts_count || 0,
    },
    unassigned: unassignedResult.rows.map(mapItem),
    longWaiting: longWaitingResult.rows.map(mapItem),
    inProgress: inProgressResult.rows.map(mapItem),
    neglected: neglectedResult.rows.map(mapItem),
    conflicts: Array.from(conflictsByKey.values()),
  };
}

module.exports = {
  listUsers,
  listHelpRequests,
  listAnnouncements,
  getBasicStats,
  getEmergencyOverview,
  getEmergencyHistory,
  getEmergencyAnalytics,
  getDeploymentMonitoring,
};
