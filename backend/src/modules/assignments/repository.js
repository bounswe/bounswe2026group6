const { query } = require('../../db/pool');

async function findRouteContextByAssignmentId(assignmentId) {
  const result = await query(
    `
      SELECT
        a.assignment_id,
        a.volunteer_id,
        a.request_id,
        v.user_id AS volunteer_user_id,
        v.last_known_latitude AS responder_latitude,
        v.last_known_longitude AS responder_longitude,
        rl.latitude AS request_latitude,
        rl.longitude AS request_longitude
      FROM assignments a
      JOIN volunteers v ON v.volunteer_id = a.volunteer_id
      JOIN help_requests hr ON hr.request_id = a.request_id
      LEFT JOIN LATERAL (
        SELECT loc.latitude, loc.longitude
        FROM request_locations loc
        WHERE loc.request_id = a.request_id
        ORDER BY loc.captured_at DESC, loc.location_id DESC
        LIMIT 1
      ) rl ON TRUE
      WHERE a.assignment_id = $1
        AND a.is_cancelled = FALSE
        AND hr.status NOT IN ('RESOLVED', 'CANCELLED')
      LIMIT 1;
    `,
    [assignmentId],
  );

  return result.rows[0] || null;
}

async function findAdminByUserId(userId) {
  const result = await query(
    `
      SELECT admin_id, user_id, role
      FROM admins
      WHERE user_id = $1
      LIMIT 1;
    `,
    [userId],
  );

  return result.rows[0] || null;
}

module.exports = {
  findRouteContextByAssignmentId,
  findAdminByUserId,
};
