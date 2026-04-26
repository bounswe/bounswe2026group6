const { query } = require('../../db/pool');
const { randomUUID } = require('crypto');
const { deriveOperationalLevels } = require('../help-requests/operational');
const { env } = require('../../config/env');

const DEFAULT_MAX_MATCH_DISTANCE_METERS = 1000;
const FIRST_AID_HELP_TYPES = new Set(['first_aid', 'medical']);
const SEARCH_AND_RESCUE_HELP_TYPES = new Set(['search_and_rescue', 'sar', 'fire_brigade', 'rescue']);
const SUPPLIES_HELP_TYPES = new Set(['food', 'water', 'basic_supplies', 'supplies']);
const SHELTER_HELP_TYPES = new Set(['shelter']);
const FIRST_AID_EXPERTISE_MARKERS = new Set(['first_aid', 'medical']);
const FIRST_AID_ONLY_GENERAL_FALLBACK_CAP = 1;

function makeId(prefix) {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}

function normalizeMatchToken(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function toNonNegativeInteger(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }

  return Math.floor(numericValue);
}

function parseExpertiseAreas(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed;
    }
  } catch (_error) {
    return [String(rawValue)];
  }

  return [String(rawValue)];
}

function getConfiguredMatchRadiusMeters() {
  const configuredValue = Number(process.env.MATCH_MAX_DISTANCE_METERS);

  if (Number.isFinite(configuredValue) && configuredValue > 0) {
    return configuredValue;
  }

  return DEFAULT_MAX_MATCH_DISTANCE_METERS;
}

function toCoordinateValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function hasCoordinates(latitude, longitude) {
  return toCoordinateValue(latitude) !== null && toCoordinateValue(longitude) !== null;
}

function calculateDistanceMeters(firstPoint, secondPoint) {
  if (
    !hasCoordinates(firstPoint.latitude, firstPoint.longitude)
    || !hasCoordinates(secondPoint.latitude, secondPoint.longitude)
  ) {
    return null;
  }

  const toRadians = (value) => value * (Math.PI / 180);
  const earthRadiusMeters = 6378137;
  const firstLatitude = toRadians(toCoordinateValue(firstPoint.latitude));
  const firstLongitude = toRadians(toCoordinateValue(firstPoint.longitude));
  const secondLatitude = toRadians(toCoordinateValue(secondPoint.latitude));
  const secondLongitude = toRadians(toCoordinateValue(secondPoint.longitude));
  const latitudeDelta = secondLatitude - firstLatitude;
  const longitudeDelta = secondLongitude - firstLongitude;
  const haversineTerm = (Math.sin(latitudeDelta / 2) ** 2)
    + (Math.cos(firstLatitude) * Math.cos(secondLatitude) * (Math.sin(longitudeDelta / 2) ** 2));

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversineTerm), Math.sqrt(1 - haversineTerm));
}

function compareNullableDatesDescending(left, right) {
  const leftTime = left ? new Date(left).getTime() : null;
  const rightTime = right ? new Date(right).getTime() : null;

  if (leftTime === null && rightTime === null) {
    return 0;
  }

  if (leftTime === null) {
    return 1;
  }

  if (rightTime === null) {
    return -1;
  }

  return rightTime - leftTime;
}

function compareNullableDistances(left, right) {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left - right;
}

function normalizeRequestHelpTypes(helpTypes, needType) {
  const resolvedHelpTypes = Array.isArray(helpTypes) && helpTypes.length > 0
    ? helpTypes
    : [needType].filter(Boolean);

  return resolvedHelpTypes
    .map(normalizeMatchToken)
    .filter(Boolean);
}

function buildRequestMatchContext(requestRow) {
  const normalizedHelpTypes = normalizeRequestHelpTypes(requestRow.help_types, requestRow.need_type);
  const hasFirstAid = normalizedHelpTypes.some((type) => FIRST_AID_HELP_TYPES.has(type));
  const hasSearchAndRescue = normalizedHelpTypes.some((type) => SEARCH_AND_RESCUE_HELP_TYPES.has(type));
  const hasSupplies = normalizedHelpTypes.some((type) => SUPPLIES_HELP_TYPES.has(type));
  const hasShelter = normalizedHelpTypes.some((type) => SHELTER_HELP_TYPES.has(type));
  const activeAssignmentCount = Math.max(0, Number(requestRow.active_assignment_count) || 0);
  const hasFirstAidCapableAssignment = Boolean(requestRow.has_first_aid_capable_assignment);
  const affectedPeopleCount = toNonNegativeInteger(
    requestRow.affected_people_count ?? requestRow.affectedPeopleCount,
  );
  const sarTargetTotal = hasSearchAndRescue
    ? (affectedPeopleCount === null ? 1 : affectedPeopleCount + 1)
    : 1;
  const needsFirstAidSpecialist = hasFirstAid && !hasFirstAidCapableAssignment;
  const needsSearchAndRescueCoverage = hasSearchAndRescue && activeAssignmentCount < sarTargetTotal;
  const firstAidOnlyGeneralFallbackCapReached = hasFirstAid
    && !hasSearchAndRescue
    && !hasFirstAidCapableAssignment
    && activeAssignmentCount >= FIRST_AID_ONLY_GENERAL_FALLBACK_CAP;

  let priority = 0;

  if (hasFirstAid) {
    priority = 3;
  } else if (hasSearchAndRescue) {
    priority = 2;
  } else if (hasSupplies || hasShelter) {
    priority = 1;
  }

  let isInternallyFulfilled = false;

  if (hasFirstAid && hasSearchAndRescue) {
    isInternallyFulfilled = !needsFirstAidSpecialist && !needsSearchAndRescueCoverage;
  } else if (hasFirstAid) {
    isInternallyFulfilled = !needsFirstAidSpecialist;
  } else if (hasSearchAndRescue) {
    isInternallyFulfilled = !needsSearchAndRescueCoverage;
  } else {
    isInternallyFulfilled = activeAssignmentCount >= 1;
  }

  return {
    ...requestRow,
    normalized_help_types: normalizedHelpTypes,
    has_first_aid: hasFirstAid,
    has_search_and_rescue: hasSearchAndRescue,
    has_supplies: hasSupplies,
    has_shelter: hasShelter,
    active_assignment_count: activeAssignmentCount,
    has_first_aid_capable_assignment: hasFirstAidCapableAssignment,
    sar_target_total: sarTargetTotal,
    needs_first_aid_specialist: needsFirstAidSpecialist,
    needs_search_and_rescue_coverage: needsSearchAndRescueCoverage,
    first_aid_only_general_fallback_cap_reached: firstAidOnlyGeneralFallbackCapReached,
    needs_initial_coverage: activeAssignmentCount === 0,
    is_internally_fulfilled: isInternallyFulfilled,
    assignment_phase_rank: activeAssignmentCount === 0 ? 0 : 1,
    priority,
  };
}

function isRequestEligibleForMatching(requestRow) {
  if (!requestRow) {
    return false;
  }

  if (requestRow.user_id) {
    return true;
  }

  return env.helpRequests.guestMatchingEnabled;
}

function canVolunteerMatchRequest(volunteerContext, requestContext) {
  if (
    requestContext.first_aid_only_general_fallback_cap_reached
    && !volunteerContext.is_first_aid_capable
  ) {
    return false;
  }

  return true;
}

function buildVolunteerMatchContext(volunteerRow) {
  const expertiseAreas = Array.isArray(volunteerRow.expertise_areas)
    ? volunteerRow.expertise_areas.flatMap((rawValue) => parseExpertiseAreas(rawValue))
    : [];
  const isFirstAidCapable = expertiseAreas
    .map(normalizeMatchToken)
    .some((expertiseArea) => FIRST_AID_EXPERTISE_MARKERS.has(expertiseArea));

  return {
    ...volunteerRow,
    normalized_expertise_areas: expertiseAreas,
    is_first_aid_capable: isFirstAidCapable,
  };
}

function buildVolunteerCandidateForRequest(requestContext, volunteerRow) {
  const volunteerContext = buildVolunteerMatchContext(volunteerRow);

  if (!canVolunteerMatchRequest(volunteerContext, requestContext)) {
    return null;
  }

  const distanceMeters = calculateDistanceMeters(
    {
      latitude: requestContext.latitude,
      longitude: requestContext.longitude,
    },
    {
      latitude: volunteerContext.last_known_latitude,
      longitude: volunteerContext.last_known_longitude,
    },
  );

  return {
    ...volunteerContext,
    suitability_score: requestContext.needs_first_aid_specialist && volunteerContext.is_first_aid_capable ? 1 : 0,
    distance_meters: distanceMeters,
  };
}

function buildRequestCandidateForVolunteer(volunteerContext, requestRow) {
  const requestContext = buildRequestMatchContext(requestRow);

  if (!canVolunteerMatchRequest(volunteerContext, requestContext)) {
    return null;
  }

  const distanceMeters = calculateDistanceMeters(
    {
      latitude: volunteerContext.last_known_latitude,
      longitude: volunteerContext.last_known_longitude,
    },
    {
      latitude: requestContext.latitude,
      longitude: requestContext.longitude,
    },
  );

  return {
    ...requestContext,
    distance_meters: distanceMeters,
  };
}

function isCandidateWithinMatchRadius(candidate) {
  return candidate.distance_meters === null || candidate.distance_meters <= getConfiguredMatchRadiusMeters();
}

function compareVolunteerCandidates(leftCandidate, rightCandidate) {
  if (leftCandidate.suitability_score !== rightCandidate.suitability_score) {
    return rightCandidate.suitability_score - leftCandidate.suitability_score;
  }

  const distanceComparison = compareNullableDistances(leftCandidate.distance_meters, rightCandidate.distance_meters);
  if (distanceComparison !== 0) {
    return distanceComparison;
  }

  const updatedAtComparison = compareNullableDatesDescending(
    leftCandidate.location_updated_at,
    rightCandidate.location_updated_at,
  );
  if (updatedAtComparison !== 0) {
    return updatedAtComparison;
  }

  return leftCandidate.volunteer_id.localeCompare(rightCandidate.volunteer_id);
}

function compareRequestCandidates(leftCandidate, rightCandidate) {
  const leftPhaseRank = Number(leftCandidate.assignment_phase_rank) || 0;
  const rightPhaseRank = Number(rightCandidate.assignment_phase_rank) || 0;

  if (leftPhaseRank !== rightPhaseRank) {
    return leftPhaseRank - rightPhaseRank;
  }

  if (leftCandidate.priority !== rightCandidate.priority) {
    return rightCandidate.priority - leftCandidate.priority;
  }

  const distanceComparison = compareNullableDistances(leftCandidate.distance_meters, rightCandidate.distance_meters);
  if (distanceComparison !== 0) {
    return distanceComparison;
  }

  const createdAtComparison = new Date(leftCandidate.created_at).getTime() - new Date(rightCandidate.created_at).getTime();
  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  return leftCandidate.request_id.localeCompare(rightCandidate.request_id);
}

async function findVolunteerByUserId(userId) {
  const sql = `
    SELECT * FROM volunteers
    WHERE user_id = $1;
  `;
  const result = await query(sql, [userId]);
  return result.rows[0] || null;
}

async function findVolunteerById(volunteerId) {
  const sql = `
    SELECT * FROM volunteers
    WHERE volunteer_id = $1;
  `;
  const result = await query(sql, [volunteerId]);
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

async function findAvailableVolunteersForMatching() {
  const sql = `
    SELECT
      v.*,
      COALESCE(expertise_context.expertise_areas, ARRAY[]::TEXT[]) AS expertise_areas
    FROM volunteers v
    LEFT JOIN user_profiles up ON up.user_id = v.user_id
    LEFT JOIN LATERAL (
      SELECT ARRAY_REMOVE(ARRAY_AGG(e.expertise_area ORDER BY e.is_verified DESC, e.expertise_id ASC), NULL) AS expertise_areas
      FROM expertise e
      WHERE e.profile_id = up.profile_id
    ) expertise_context ON TRUE
    WHERE v.is_available = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM assignments a
        JOIN help_requests hr ON a.request_id = hr.request_id
        WHERE a.volunteer_id = v.volunteer_id
          AND a.is_cancelled = FALSE
          AND hr.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS')
      )
    ORDER BY v.location_updated_at DESC NULLS LAST, v.volunteer_id ASC;
  `;
  const result = await query(sql);
  return result.rows.map(buildVolunteerMatchContext);
}

async function findActiveAssignmentsForOpenRequests() {
  const sql = `
    SELECT
      a.assignment_id,
      a.request_id,
      a.volunteer_id,
      COALESCE(expertise_context.expertise_areas, ARRAY[]::TEXT[]) AS expertise_areas
    FROM assignments a
    JOIN help_requests hr ON hr.request_id = a.request_id
    JOIN volunteers v ON v.volunteer_id = a.volunteer_id
    LEFT JOIN user_profiles up ON up.user_id = v.user_id
    LEFT JOIN LATERAL (
      SELECT ARRAY_REMOVE(ARRAY_AGG(e.expertise_area ORDER BY e.is_verified DESC, e.expertise_id ASC), NULL) AS expertise_areas
      FROM expertise e
      WHERE e.profile_id = up.profile_id
    ) expertise_context ON TRUE
    WHERE a.is_cancelled = FALSE
      AND hr.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS')
    ORDER BY a.assigned_at ASC, a.assignment_id ASC;
  `;
  const result = await query(sql);

  return result.rows.map((assignmentRow) => {
    const volunteerContext = buildVolunteerMatchContext(assignmentRow);

    return {
      ...assignmentRow,
      is_first_aid_capable: volunteerContext.is_first_aid_capable,
    };
  });
}

function buildOpenRequestMatchContexts(requestRows, assignmentRows) {
  const assignmentSummaryByRequestId = assignmentRows.reduce((summaryMap, assignmentRow) => {
    const currentSummary = summaryMap.get(assignmentRow.request_id) || {
      active_assignment_count: 0,
      has_first_aid_capable_assignment: false,
    };

    currentSummary.active_assignment_count += 1;
    currentSummary.has_first_aid_capable_assignment = currentSummary.has_first_aid_capable_assignment
      || assignmentRow.is_first_aid_capable;

    summaryMap.set(assignmentRow.request_id, currentSummary);
    return summaryMap;
  }, new Map());

  return requestRows.map((requestRow) => {
    const requestSummary = assignmentSummaryByRequestId.get(requestRow.request_id) || {
      active_assignment_count: 0,
      has_first_aid_capable_assignment: false,
    };

    return buildRequestMatchContext({
      ...requestRow,
      ...requestSummary,
    });
  });
}

async function findOpenRequestsForMatching() {
  const requestSql = `
    SELECT hr.*, rl.latitude, rl.longitude
    FROM help_requests hr
    LEFT JOIN request_locations rl ON hr.request_id = rl.request_id
    WHERE hr.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS')
    ORDER BY hr.created_at ASC, hr.request_id ASC;
  `;
  const requestResult = await query(requestSql);
  const assignmentRows = await findActiveAssignmentsForOpenRequests();

  return buildOpenRequestMatchContexts(requestResult.rows, assignmentRows);
}

function selectBestRequestForVolunteer(volunteer, requestRows) {
  return requestRows
    .filter(isRequestEligibleForMatching)
    .filter((requestRow) => requestRow.user_id === null || requestRow.user_id !== volunteer.user_id)
    .filter((requestRow) => !requestRow.is_internally_fulfilled)
    .map((requestRow) => buildRequestCandidateForVolunteer(volunteer, requestRow))
    .filter(Boolean)
    .filter(isCandidateWithinMatchRadius)
    .sort(compareRequestCandidates)[0] || null;
}

function selectBestVolunteerForRequest(requestRow, volunteerRows) {
  if (!isRequestEligibleForMatching(requestRow)) {
    return null;
  }

  if (requestRow.is_internally_fulfilled) {
    return null;
  }

  return volunteerRows
    .filter((volunteerRow) => requestRow.user_id === null || volunteerRow.user_id !== requestRow.user_id)
    .map((volunteerRow) => buildVolunteerCandidateForRequest(requestRow, volunteerRow))
    .filter(Boolean)
    .filter(isCandidateWithinMatchRadius)
    .sort(compareVolunteerCandidates)[0] || null;
}

async function findMatchingRequestForVolunteer(volunteerId) {
  const volunteerSql = `
    SELECT
      v.*,
      COALESCE(expertise_context.expertise_areas, ARRAY[]::TEXT[]) AS expertise_areas
    FROM volunteers v
    LEFT JOIN user_profiles up ON up.user_id = v.user_id
    LEFT JOIN LATERAL (
      SELECT ARRAY_REMOVE(ARRAY_AGG(e.expertise_area ORDER BY e.is_verified DESC, e.expertise_id ASC), NULL) AS expertise_areas
      FROM expertise e
      WHERE e.profile_id = up.profile_id
    ) expertise_context ON TRUE
    WHERE v.volunteer_id = $1
    LIMIT 1;
  `;
  const vResult = await query(volunteerSql, [volunteerId]);
  const volunteer = vResult.rows[0] ? buildVolunteerMatchContext(vResult.rows[0]) : null;

  if (!volunteer) return null;

  const openRequests = await findOpenRequestsForMatching();

  if (volunteer.is_first_aid_capable) {
    const specialistFollowUpRequest = selectBestRequestForVolunteer(
      volunteer,
      openRequests.filter(
        (requestRow) => requestRow.needs_first_aid_specialist && !requestRow.needs_initial_coverage,
      ),
    );

    if (specialistFollowUpRequest) {
      return specialistFollowUpRequest;
    }
  }

  const firstPassRequest = selectBestRequestForVolunteer(
    volunteer,
    openRequests.filter((requestRow) => requestRow.needs_initial_coverage),
  );

  if (firstPassRequest) {
    return firstPassRequest;
  }

  return selectBestRequestForVolunteer(
    volunteer,
    openRequests.filter((requestRow) => !requestRow.needs_initial_coverage),
  );
}

async function findMatchingVolunteerForRequest(requestId) {
  const openRequests = await findOpenRequestsForMatching();
  const request = openRequests.find((requestRow) => requestRow.request_id === requestId) || null;

  if (!request) return null;
  const availableVolunteers = await findAvailableVolunteersForMatching();

  return selectBestVolunteerForRequest(request, availableVolunteers);
}

async function createAssignment(volunteerId, requestId) {
  const assignmentId = makeId('asg');
  const sql = `
    INSERT INTO assignments (assignment_id, volunteer_id, request_id, assigned_at, is_cancelled)
    SELECT $1::VARCHAR(64), $2::VARCHAR(64), $3::VARCHAR(64), CURRENT_TIMESTAMP, FALSE
    FROM volunteers v
    JOIN help_requests hr ON hr.request_id = $3::VARCHAR(64)
    WHERE v.volunteer_id = $2::VARCHAR(64)
      AND v.is_available = TRUE
      AND hr.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS')
      AND NOT EXISTS (
        SELECT 1
        FROM assignments a
        JOIN help_requests active_requests ON active_requests.request_id = a.request_id
        WHERE a.volunteer_id = $2::VARCHAR(64)
          AND a.is_cancelled = FALSE
          AND active_requests.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS')
      )
    ON CONFLICT (volunteer_id) WHERE is_cancelled = FALSE DO NOTHING
    RETURNING *;
  `;
  const result = await query(sql, [assignmentId, volunteerId, requestId]);
  return result.rows[0] || null;
}

async function markRequestAssignedIfPending(requestId) {
  const sql = `
    UPDATE help_requests
    SET status = 'ASSIGNED'
    WHERE request_id = $1
      AND status = 'PENDING'
    RETURNING *;
  `;
  const result = await query(sql, [requestId]);
  return result.rows[0] || null;
}

async function syncRequestStatusPreservingInProgress(requestId) {
  const sql = `
    UPDATE help_requests hr
    SET status = CASE
      WHEN hr.status = 'IN_PROGRESS' THEN 'IN_PROGRESS'::request_status
      WHEN EXISTS (
        SELECT 1
        FROM assignments a
        WHERE a.request_id = hr.request_id
          AND a.is_cancelled = FALSE
      ) THEN 'ASSIGNED'::request_status
      ELSE 'PENDING'::request_status
    END
    WHERE hr.request_id = $1
    RETURNING *;
  `;
  const result = await query(sql, [requestId]);
  return result.rows[0] || null;
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
           hr.urgency_level, hr.priority_level, hr.created_at AS opened_at,
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
  const assignment = result.rows[0] || null;

  if (!assignment) {
    return null;
  }

  const derivedLevels = deriveOperationalLevels({
    affectedPeopleCount: assignment.affected_people_count,
    riskFlags: assignment.risk_flags,
  });

  return {
    ...assignment,
    urgency_level: assignment.urgency_level || derivedLevels.urgencyLevel,
    priority_level: assignment.priority_level || derivedLevels.priorityLevel,
  };
}

async function getAssignmentById(assignmentId) {
  const sql = `
    SELECT * FROM assignments
    WHERE assignment_id = $1;
  `;
  const result = await query(sql, [assignmentId]);
  return result.rows[0] || null;
}

async function findAssignmentByRequestId(requestId) {
  const sql = `
    SELECT * FROM assignments
    WHERE request_id = $1 AND is_cancelled = FALSE
    ORDER BY assigned_at ASC, assignment_id ASC
    LIMIT 1;
  `;
  const result = await query(sql, [requestId]);
  return result.rows[0] || null;
}

async function findActiveAssignmentsByRequestId(requestId) {
  const sql = `
    SELECT * FROM assignments
    WHERE request_id = $1 AND is_cancelled = FALSE
    ORDER BY assigned_at ASC, assignment_id ASC;
  `;
  const result = await query(sql, [requestId]);
  return result.rows;
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

async function findRequestOwnerByRequestId(requestId) {
  const result = await query(
    `
      SELECT request_id, user_id
      FROM help_requests
      WHERE request_id = $1
      LIMIT 1
    `,
    [requestId],
  );

  return result.rows[0] || null;
}

module.exports = {
  buildRequestMatchContext,
  findVolunteerByUserId,
  findVolunteerById,
  createVolunteer,
  updateVolunteerAvailability,
  createAvailabilityRecord,
  findAvailableVolunteersForMatching,
  findOpenRequestsForMatching,
  findPendingRequests,
  findMatchingRequestForVolunteer,
  findMatchingVolunteerForRequest,
  createAssignment,
  markRequestAssignedIfPending,
  syncRequestStatusPreservingInProgress,
  updateRequestStatus,
  getAssignmentByVolunteerId,
  getAssignmentById,
  findAssignmentByRequestId,
  findActiveAssignmentsByRequestId,
  cancelAssignment,
  findRequestOwnerByRequestId,
};
