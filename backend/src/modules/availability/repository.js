const { query } = require('../../db/pool');
const { randomUUID } = require('crypto');

function makeId(prefix) {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}

async function findVolunteerByUserId(userId) {
  const sql = `
    SELECT * FROM volunteers
    WHERE user_id = $1;
  `;
  const result = await query(sql, [userId]);
  return result.rows[0] || null;
}

async function createVolunteer(userId) {
  const volunteerId = makeId('vol');
  const sql = `
    INSERT INTO volunteers (volunteer_id, user_id, is_available)
    VALUES ($1, $2, FALSE)
    RETURNING *;
  `;
  const result = await query(sql, [volunteerId, userId]);
  return result.rows[0];
}

async function updateVolunteerAvailability(volunteerId, isAvailable, latitude, longitude) {
  const sql = `
    UPDATE volunteers
    SET is_available = $2,
        last_known_latitude = $3,
        last_known_longitude = $4,
        location_updated_at = CURRENT_TIMESTAMP
    WHERE volunteer_id = $1
    RETURNING *;
  `;
  const result = await query(sql, [volunteerId, isAvailable, latitude, longitude]);
  return result.rows[0];
}

async function createAvailabilityRecord(volunteerId, isAvailable, storedLocally) {
  const availabilityId = makeId('avr');
  const sql = `
    INSERT INTO availability_records (availability_id, volunteer_id, is_available, stored_locally, synced_at)
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    RETURNING *;
  `;
  const result = await query(sql, [availabilityId, volunteerId, isAvailable, storedLocally]);
  return result.rows[0];
}

async function findPendingRequests() {
  const sql = `
    SELECT hr.*, rl.latitude, rl.longitude
    FROM help_requests hr
    LEFT JOIN request_locations rl ON hr.request_id = rl.request_id
    WHERE hr.status = 'PENDING'
    ORDER BY hr.created_at ASC;
  `;
  const result = await query(sql);
  return result.rows;
}

async function findMatchingRequestForVolunteer(volunteerId) {
  // Simple matching: find the first pending request that matches volunteer's skills/need_types
  // For MVP, we can just find the oldest pending request
  // Or if we want to be a bit better, match by need_type if volunteer has any
  const volunteerSql = `SELECT skills, need_types FROM volunteers WHERE volunteer_id = $1;`;
  const vResult = await query(volunteerSql, [volunteerId]);
  const volunteer = vResult.rows[0];

  if (!volunteer) return null;

  // If volunteer has no specific need_types, they can match any
  let sql;
  let params = [];

  if (volunteer.need_types && volunteer.need_types.length > 0) {
    sql = `
      SELECT hr.*, rl.latitude, rl.longitude
      FROM help_requests hr
      LEFT JOIN request_locations rl ON hr.request_id = rl.request_id
      WHERE hr.status = 'PENDING'
        AND hr.need_type = ANY($1)
      ORDER BY hr.created_at ASC
      LIMIT 1;
    `;
    params = [volunteer.need_types];
  } else {
    sql = `
      SELECT hr.*, rl.latitude, rl.longitude
      FROM help_requests hr
      LEFT JOIN request_locations rl ON hr.request_id = rl.request_id
      WHERE hr.status = 'PENDING'
      ORDER BY hr.created_at ASC
      LIMIT 1;
    `;
  }

  const result = await query(sql, params);
  return result.rows[0] || null;
}

async function findMatchingVolunteerForRequest(requestId) {
  const requestSql = `SELECT need_type FROM help_requests WHERE request_id = $1;`;
  const rResult = await query(requestSql, [requestId]);
  const request = rResult.rows[0];

  if (!request) return null;

  const sql = `
    SELECT v.*
    FROM volunteers v
    WHERE v.is_available = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM assignments a
        JOIN help_requests hr ON a.request_id = hr.request_id
        WHERE a.volunteer_id = v.volunteer_id
          AND a.is_cancelled = FALSE
          AND hr.status NOT IN ('RESOLVED', 'CANCELLED')
      )
      AND (v.need_types IS NULL OR v.need_types = '{}' OR $1 = ANY(v.need_types))
    ORDER BY v.location_updated_at DESC NULLS LAST
    LIMIT 1;
  `;
  const result = await query(sql, [request.need_type]);
  return result.rows[0] || null;
}

async function createAssignment(volunteerId, requestId) {
  const assignmentId = makeId('asg');
  const sql = `
    INSERT INTO assignments (assignment_id, volunteer_id, request_id, assigned_at, is_cancelled)
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP, FALSE)
    RETURNING *;
  `;
  const result = await query(sql, [assignmentId, volunteerId, requestId]);
  return result.rows[0];
}

async function updateRequestStatus(requestId, status) {
  const sql = `
    UPDATE help_requests
    SET status = $2::request_status,
        resolved_at = CASE WHEN $2::request_status = 'RESOLVED' THEN CURRENT_TIMESTAMP ELSE resolved_at END
    WHERE request_id = $1
    RETURNING *;
  `;
  const result = await query(sql, [requestId, status]);
  return result.rows[0];
}

async function getAssignmentByVolunteerId(volunteerId) {
  const sql = `
    SELECT a.*, hr.need_type, hr.description, hr.status as request_status,
           hr.help_types, hr.other_help_text, hr.affected_people_count,
           hr.risk_flags, hr.vulnerable_groups, hr.blood_type,
           hr.contact_full_name, hr.contact_phone, hr.contact_alternative_phone,
           rl.latitude, rl.longitude,
           rl.country AS request_country, rl.city AS request_city,
           rl.district AS request_district, rl.neighborhood AS request_neighborhood,
           rl.extra_address AS request_extra_address,
           u.email as requester_email,
           up.first_name as requester_first_name, up.last_name as requester_last_name
    FROM assignments a
    JOIN help_requests hr ON a.request_id = hr.request_id
    LEFT JOIN request_locations rl ON hr.request_id = rl.request_id
    LEFT JOIN users u ON hr.user_id = u.user_id
    LEFT JOIN user_profiles up ON u.user_id = up.user_id
    WHERE a.volunteer_id = $1 AND a.is_cancelled = FALSE AND hr.status != 'RESOLVED' AND hr.status != 'CANCELLED'
    LIMIT 1;
  `;
  const result = await query(sql, [volunteerId]);
  return result.rows[0] || null;
}

async function getAssignmentById(assignmentId) {
  const sql = `
    SELECT * FROM assignments
    WHERE assignment_id = $1;
  `;
  const result = await query(sql, [assignmentId]);
  return result.rows[0] || null;
}

async function cancelAssignment(assignmentId) {
  const sql = `
    DELETE FROM assignments
    WHERE assignment_id = $1
    RETURNING *;
  `;
  const result = await query(sql, [assignmentId]);
  return result.rows[0];
}

module.exports = {
  findVolunteerByUserId,
  createVolunteer,
  updateVolunteerAvailability,
  createAvailabilityRecord,
  findPendingRequests,
  findMatchingRequestForVolunteer,
  findMatchingVolunteerForRequest,
  createAssignment,
  updateRequestStatus,
  getAssignmentByVolunteerId,
  getAssignmentById,
  cancelAssignment,
};
