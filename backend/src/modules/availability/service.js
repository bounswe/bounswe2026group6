const {
  findVolunteerByUserId,
  findVolunteerById,
  createVolunteer,
  updateVolunteerAvailability,
  createAvailabilityRecord,
  findAvailableVolunteersForMatching,
  findMatchingRequestForVolunteer,
  findMatchingVolunteerForRequest,
  createAssignment,
  markRequestAssignedIfPending,
  syncRequestStatusPreservingInProgress,
  getAssignmentByVolunteerId,
  getAssignmentById,
  findActiveAssignmentsByRequestId,
  cancelAssignment,
  findRequestOwnerByRequestId,
} = require('./repository');
const { createNotification } = require('../notifications/service');
const { env } = require('../../config/env');

async function notifyVolunteerTaskAssigned(volunteerUserId, requestId, actorUserId) {
  if (!volunteerUserId || !requestId) {
    return;
  }

  try {
    await createNotification({
      recipientUserId: volunteerUserId,
      actorUserId: actorUserId || null,
      type: 'TASK_ASSIGNED',
      title: 'New help request assigned',
      body: 'A help request has been matched to you.',
      entity: {
        type: 'HELP_REQUEST',
        id: requestId,
      },
      data: {
        screen: 'assignment',
        requestId,
        kind: 'helper_assignment',
      },
    });
  } catch (error) {
    console.error('availability.notifyVolunteerTaskAssigned failed', error);
  }
}

async function notifyVolunteerTaskUpdated(volunteerUserId, requestId, actorUserId, reason) {
  if (!volunteerUserId || !requestId) {
    return;
  }

  try {
    await createNotification({
      recipientUserId: volunteerUserId,
      actorUserId: actorUserId || null,
      type: 'TASK_UPDATED',
      title: 'Assigned request updated',
      body: 'An assigned help request has changed status.',
      entity: {
        type: 'HELP_REQUEST',
        id: requestId,
      },
      data: {
        screen: 'assignment',
        requestId,
        kind: 'helper_assignment_update',
        reason: reason || 'updated',
      },
    });
  } catch (error) {
    console.error('availability.notifyVolunteerTaskUpdated failed', error);
  }
}

async function notifyRequestOwnerAssigned(requestRow, actorUserId) {
  if (!requestRow || !requestRow.user_id || !requestRow.request_id) {
    return;
  }

  try {
    await createNotification({
      recipientUserId: requestRow.user_id,
      actorUserId: actorUserId || null,
      type: 'HELP_REQUEST_STATUS_CHANGED',
      title: 'Help request status updated',
      body: 'A volunteer has been assigned to your help request.',
      entity: {
        type: 'HELP_REQUEST',
        id: requestRow.request_id,
      },
      data: {
        screen: 'my-help-requests',
        requestId: requestRow.request_id,
        internalStatus: 'ASSIGNED',
      },
    });
  } catch (error) {
    console.error('availability.notifyRequestOwnerAssigned failed', error);
  }
}

async function runAssignmentCycle() {
  const availableVolunteers = await findAvailableVolunteersForMatching();
  const sortedVolunteers = [...availableVolunteers].sort((leftVolunteer, rightVolunteer) => {
    if (leftVolunteer.is_first_aid_capable !== rightVolunteer.is_first_aid_capable) {
      return leftVolunteer.is_first_aid_capable ? -1 : 1;
    }

    const leftUpdatedAt = leftVolunteer.location_updated_at
      ? new Date(leftVolunteer.location_updated_at).getTime()
      : null;
    const rightUpdatedAt = rightVolunteer.location_updated_at
      ? new Date(rightVolunteer.location_updated_at).getTime()
      : null;

    if (leftUpdatedAt === null && rightUpdatedAt !== null) {
      return 1;
    }

    if (leftUpdatedAt !== null && rightUpdatedAt === null) {
      return -1;
    }

    if (leftUpdatedAt !== rightUpdatedAt) {
      return (rightUpdatedAt || 0) - (leftUpdatedAt || 0);
    }

    return leftVolunteer.volunteer_id.localeCompare(rightVolunteer.volunteer_id);
  });
  const createdAssignments = [];

  for (const volunteer of sortedVolunteers) {
    const matchingRequest = await findMatchingRequestForVolunteer(volunteer.volunteer_id);

    if (!matchingRequest) {
      continue;
    }

    const assignment = await createAssignment(volunteer.volunteer_id, matchingRequest.request_id);
    if (!assignment) {
      continue;
    }

    await markRequestAssignedIfPending(matchingRequest.request_id);
    await notifyRequestOwnerAssigned(matchingRequest, volunteer.user_id);
    await notifyVolunteerTaskAssigned(volunteer.user_id, matchingRequest.request_id, volunteer.user_id);
    createdAssignments.push(assignment);
  }

  return createdAssignments;
}

function getConfiguredAvailabilityTtlMinutes() {
  const configuredValue = Number(process.env.VOLUNTEER_AVAILABILITY_TTL_MINUTES);

  if (Number.isFinite(configuredValue) && configuredValue > 0) {
    return Math.floor(configuredValue);
  }

  return env.volunteerMatching.availabilityTtlMinutes;
}

function getConfiguredLocationMaxAgeMinutes() {
  const configuredValue = Number(process.env.VOLUNTEER_LOCATION_MAX_AGE_MINUTES);

  if (Number.isFinite(configuredValue) && configuredValue > 0) {
    return Math.floor(configuredValue);
  }

  return env.volunteerMatching.locationMaxAgeMinutes;
}

function buildLocationSessionOptions(input) {
  return {
    accuracyMeters: Number.isFinite(input.accuracyMeters) ? input.accuracyMeters : null,
    source: typeof input.source === 'string' ? input.source : null,
    availabilityTtlMinutes: getConfiguredAvailabilityTtlMinutes(),
  };
}

function getSyncRecordEventTimestamp(record) {
  const rawTimestamp = record.capturedAt || record.timestamp;
  const parsed = rawTimestamp ? new Date(rawTimestamp) : null;

  if (!parsed || !Number.isFinite(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function parseDatabaseTimestamp(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return new Date(Date.UTC(
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
      value.getHours(),
      value.getMinutes(),
      value.getSeconds(),
      value.getMilliseconds(),
    ));
  }

  const rawValue = String(value);
  const parsed = new Date(/[zZ]$|[+-]\d{2}:\d{2}$/.test(rawValue) ? rawValue : `${rawValue}Z`);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function buildAvailabilitySessionStatus(volunteer) {
  const now = Date.now();
  const locationUpdatedAt = volunteer && volunteer.location_updated_at
    ? parseDatabaseTimestamp(volunteer.location_updated_at)
    : null;
  const availableUntil = volunteer && volunteer.available_until
    ? parseDatabaseTimestamp(volunteer.available_until)
    : null;
  const locationMaxAgeMinutes = getConfiguredLocationMaxAgeMinutes();
  const hasUsableLocation = Boolean(
    volunteer
    && volunteer.last_known_latitude !== null
    && volunteer.last_known_latitude !== undefined
    && volunteer.last_known_longitude !== null
    && volunteer.last_known_longitude !== undefined,
  );
  const isLocationFresh = Boolean(
    locationUpdatedAt
    && Number.isFinite(locationUpdatedAt.getTime())
    && now - locationUpdatedAt.getTime() <= locationMaxAgeMinutes * 60 * 1000,
  );
  const isAvailabilitySessionActive = Boolean(
    volunteer
    && volunteer.is_available
    && availableUntil
    && Number.isFinite(availableUntil.getTime())
    && availableUntil.getTime() > now,
  );
  let pauseReason = 'NONE';
  if (volunteer && volunteer.is_available) {
    if (!hasUsableLocation) {
      pauseReason = 'LOCATION_MISSING';
    } else if (!isAvailabilitySessionActive) {
      pauseReason = 'AVAILABILITY_EXPIRED';
    } else if (!isLocationFresh) {
      pauseReason = 'LOCATION_STALE';
    }
  }

  const isAssignable = Boolean(
    volunteer
    && volunteer.is_available
    && isAvailabilitySessionActive
    && isLocationFresh
    && hasUsableLocation,
  );

  return {
    availableUntil: volunteer ? volunteer.available_until || null : null,
    availabilityConfirmedAt: volunteer ? volunteer.availability_confirmed_at || null : null,
    locationUpdatedAt: volunteer ? volunteer.location_updated_at || null : null,
    locationMaxAgeMinutes,
    availabilityTtlMinutes: getConfiguredAvailabilityTtlMinutes(),
    isAssignable,
    pauseReason,
    effectiveIsAvailable: isAssignable,
    hasUsableLocation,
    isLocationFresh,
    isAvailabilitySessionActive,
    availabilitySessionExpired: Boolean(volunteer && volunteer.is_available && !isAvailabilitySessionActive),
  };
}

async function syncRequestStatusFromAssignments(requestId) {
  await syncRequestStatusPreservingInProgress(requestId);
  return findActiveAssignmentsByRequestId(requestId);
}

async function setAvailability(userId, input) {
  const { isAvailable, latitude, longitude } = input;
  let volunteer = await findVolunteerByUserId(userId);
  if (!volunteer) {
    volunteer = await createVolunteer(userId);
  }

  const hasCoordinates = isAvailable && Number.isFinite(latitude) && Number.isFinite(longitude);
  const locationOptions = hasCoordinates
    ? buildLocationSessionOptions(input)
    : {};
  const updatedVolunteer = await updateVolunteerAvailability(
    volunteer.volunteer_id,
    isAvailable,
    hasCoordinates ? latitude : undefined,
    hasCoordinates ? longitude : undefined,
    locationOptions,
  );

  await createAvailabilityRecord(volunteer.volunteer_id, isAvailable, false);

  let assignment = null;
  if (isAvailable) {
    const existingAssignment = await getAssignmentByVolunteerId(volunteer.volunteer_id);
    if (!existingAssignment) {
      await runAssignmentCycle();
      assignment = await getAssignmentByVolunteerId(volunteer.volunteer_id);
    } else {
      assignment = existingAssignment;
    }
  } else {
    const activeAssignment = await getAssignmentByVolunteerId(volunteer.volunteer_id);
    if (activeAssignment) {
      await notifyVolunteerTaskUpdated(volunteer.user_id, activeAssignment.request_id, userId, 'volunteer_unavailable');
      await cancelAssignment(activeAssignment.assignment_id);
      await syncRequestStatusFromAssignments(activeAssignment.request_id);
      await runAssignmentCycle();
    }
  }

  return {
    volunteer: updatedVolunteer,
    assignment,
  };
}

async function syncAvailability(userId, { records }) {
  let volunteer = await findVolunteerByUserId(userId);
  if (!volunteer) {
    volunteer = await createVolunteer(userId);
  }

  if (records.length > 0) {
    const sortedRecords = [...records].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const latest = sortedRecords[sortedRecords.length - 1];
    const latestHasAvailableCoordinates = latest.isAvailable
      && Number.isFinite(latest.latitude)
      && Number.isFinite(latest.longitude);

    await updateVolunteerAvailability(
      volunteer.volunteer_id,
      latest.isAvailable,
      latestHasAvailableCoordinates ? latest.latitude : undefined,
      latestHasAvailableCoordinates ? latest.longitude : undefined,
      latestHasAvailableCoordinates
        ? {
            ...buildLocationSessionOptions(latest),
            locationTimestamp: getSyncRecordEventTimestamp(latest),
          }
        : {},
    );

    for (const record of sortedRecords) {
      await createAvailabilityRecord(volunteer.volunteer_id, record.isAvailable, true);
    }
  }

  const updatedVolunteer = await findVolunteerByUserId(userId);
  let currentAssignment = await getAssignmentByVolunteerId(volunteer.volunteer_id);

  if (updatedVolunteer.is_available && !currentAssignment) {
    await runAssignmentCycle();
    currentAssignment = await getAssignmentByVolunteerId(volunteer.volunteer_id);
  } else if (!updatedVolunteer.is_available && currentAssignment) {
    await notifyVolunteerTaskUpdated(volunteer.user_id, currentAssignment.request_id, userId, 'sync_marked_unavailable');
    await cancelAssignment(currentAssignment.assignment_id);
    await syncRequestStatusFromAssignments(currentAssignment.request_id);
    await runAssignmentCycle();
    currentAssignment = null;
  }

  return {
    volunteer: updatedVolunteer,
    assignment: currentAssignment,
  };
}

async function getMyAssignment(userId) {
  const volunteer = await findVolunteerByUserId(userId);
  if (!volunteer) {
    const error = new Error('Volunteer record not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  const assignment = await getAssignmentByVolunteerId(volunteer.volunteer_id);
  return { assignment };
}

async function cancelMyAssignment(userId, { assignmentId }) {
  const volunteer = await findVolunteerByUserId(userId);
  if (!volunteer) {
    const error = new Error('Volunteer record not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  const assignment = await getAssignmentById(assignmentId);
  if (!assignment || assignment.volunteer_id !== volunteer.volunteer_id) {
    const error = new Error('Assignment not found or not owned by user');
    error.code = 'NOT_FOUND';
    throw error;
  }

  await notifyVolunteerTaskUpdated(userId, assignment.request_id, userId, 'volunteer_cancelled_assignment');
  await cancelAssignment(assignmentId);
  await syncRequestStatusFromAssignments(assignment.request_id);

  await updateVolunteerAvailability(
    volunteer.volunteer_id,
    false,
  );
  await createAvailabilityRecord(volunteer.volunteer_id, false, false);

  await runAssignmentCycle();

  return {
    message: 'Assignment cancelled, you are now unavailable, and matching has been refreshed',
    volunteerStatus: 'UNAVAILABLE'
  };
}

async function cancelAssignmentByRequestId(requestId, options = {}) {
  const executor = options.db || null;
  const shouldNotify = options.notify !== false;
  const shouldRunMatching = options.runMatching !== false;

  const assignments = executor
    ? await findActiveAssignmentsByRequestId(requestId, executor)
    : await findActiveAssignmentsByRequestId(requestId);

  for (const assignment of assignments) {
    const volunteer = executor
      ? await findVolunteerById(assignment.volunteer_id, executor)
      : await findVolunteerById(assignment.volunteer_id);
    if (shouldNotify) {
      await notifyVolunteerTaskUpdated(
        volunteer ? volunteer.user_id : null,
        requestId,
        null,
        'assignment_cancelled_by_request_update',
      );
    }
    if (executor) {
      await cancelAssignment(assignment.assignment_id, executor);
    } else {
      await cancelAssignment(assignment.assignment_id);
    }
  }

  if (assignments.length > 0 && shouldRunMatching) {
    await runAssignmentCycle();
  }
}

async function cancelAssignmentsForBannedVolunteer(userId, options = {}) {
  const executor = options.db || null;
  const shouldNotify = options.notify !== false;
  const shouldRunMatching = options.runMatching !== false;

  const volunteer = executor
    ? await findVolunteerByUserId(userId, executor)
    : await findVolunteerByUserId(userId);

  if (!volunteer) {
    return {
      volunteerId: null,
      cancelledAssignmentId: null,
      affectedRequestId: null,
    };
  }

  const activeAssignment = executor
    ? await getAssignmentByVolunteerId(volunteer.volunteer_id, executor)
    : await getAssignmentByVolunteerId(volunteer.volunteer_id);

  if (activeAssignment) {
    if (shouldNotify) {
      await notifyVolunteerTaskUpdated(userId, activeAssignment.request_id, null, 'volunteer_banned');
    }
    if (executor) {
      await cancelAssignment(activeAssignment.assignment_id, executor);
    } else {
      await cancelAssignment(activeAssignment.assignment_id);
    }
    if (executor) {
      await syncRequestStatusPreservingInProgress(activeAssignment.request_id, executor);
    } else {
      await syncRequestStatusFromAssignments(activeAssignment.request_id);
    }
  }

  if (executor) {
    await updateVolunteerAvailability(
      volunteer.volunteer_id,
      false,
      undefined,
      undefined,
      executor,
    );
    await createAvailabilityRecord(volunteer.volunteer_id, false, false, executor);
  } else {
    await updateVolunteerAvailability(
      volunteer.volunteer_id,
      false,
    );
    await createAvailabilityRecord(volunteer.volunteer_id, false, false);
  }

  if (activeAssignment && shouldRunMatching) {
    await runAssignmentCycle();
  }

  return {
    volunteerId: volunteer.volunteer_id,
    cancelledAssignmentId: activeAssignment ? activeAssignment.assignment_id : null,
    affectedRequestId: activeAssignment ? activeAssignment.request_id : null,
  };
}

async function resolveMyAssignment(userId, { requestId }) {
  const volunteer = await findVolunteerByUserId(userId);
  if (!volunteer) {
    const error = new Error('Volunteer record not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  const assignment = await getAssignmentByVolunteerId(volunteer.volunteer_id);
  if (!assignment || assignment.request_id !== requestId) {
    const error = new Error('Active assignment for this request not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  await notifyVolunteerTaskUpdated(userId, requestId, userId, 'volunteer_resolved_assignment');
  await cancelAssignment(assignment.assignment_id);
  await syncRequestStatusFromAssignments(requestId);

  await updateVolunteerAvailability(
    volunteer.volunteer_id,
    false,
  );
  await createAvailabilityRecord(volunteer.volunteer_id, false, false);

  await runAssignmentCycle();

  return {
    message: 'Assignment resolved for this volunteer, you are now unavailable, and matching has been refreshed',
    newAssignment: null
  };
}

async function getAvailabilityStatus(userId) {
  let volunteer = await findVolunteerByUserId(userId);
  if (!volunteer) {
    return {
      isAvailable: false,
      volunteer: null,
      assignment: null,
      ...buildAvailabilitySessionStatus(null),
    };
  }

  const assignment = await getAssignmentByVolunteerId(volunteer.volunteer_id);

  return {
    isAvailable: volunteer.is_available,
    volunteer,
    assignment,
    ...buildAvailabilitySessionStatus(volunteer),
  };
}

async function tryToAssignRequest(requestId) {
  const requestOwner = await findRequestOwnerByRequestId(requestId);

  while (true) {
    const volunteer = await findMatchingVolunteerForRequest(requestId);

    if (!volunteer) {
      break;
    }

    const assignment = await createAssignment(volunteer.volunteer_id, requestId);

    if (!assignment) {
      break;
    }

    await markRequestAssignedIfPending(requestId);
    await notifyRequestOwnerAssigned(
      {
        request_id: requestId,
        user_id: requestOwner ? requestOwner.user_id : null,
      },
      volunteer.user_id,
    );
    await notifyVolunteerTaskAssigned(volunteer.user_id, requestId, volunteer.user_id);
  }

  const activeAssignments = await findActiveAssignmentsByRequestId(requestId);
  return activeAssignments.length > 0;
}

module.exports = {
  setAvailability,
  syncAvailability,
  getMyAssignment,
  cancelMyAssignment,
  resolveMyAssignment,
  getAvailabilityStatus,
  tryToAssignRequest,
  cancelAssignmentByRequestId,
  cancelAssignmentsForBannedVolunteer,
};
