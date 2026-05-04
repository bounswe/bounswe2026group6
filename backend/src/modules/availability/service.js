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

async function syncRequestStatusFromAssignments(requestId) {
  await syncRequestStatusPreservingInProgress(requestId);
  return findActiveAssignmentsByRequestId(requestId);
}

async function setAvailability(userId, { isAvailable, latitude, longitude }) {
  let volunteer = await findVolunteerByUserId(userId);
  if (!volunteer) {
    volunteer = await createVolunteer(userId);
  }

  const updatedVolunteer = await updateVolunteerAvailability(
    volunteer.volunteer_id,
    isAvailable,
    latitude,
    longitude
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
    const sortedRecords = [...records].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const latest = sortedRecords[0];

    await updateVolunteerAvailability(
      volunteer.volunteer_id,
      latest.isAvailable,
      null,
      null
    );

    for (const record of records) {
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
    volunteer.last_known_latitude,
    volunteer.last_known_longitude,
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
      volunteer.last_known_latitude,
      volunteer.last_known_longitude,
      executor,
    );
    await createAvailabilityRecord(volunteer.volunteer_id, false, false, executor);
  } else {
    await updateVolunteerAvailability(
      volunteer.volunteer_id,
      false,
      volunteer.last_known_latitude,
      volunteer.last_known_longitude,
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
    volunteer.last_known_latitude,
    volunteer.last_known_longitude,
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
      assignment: null
    };
  }

  const assignment = await getAssignmentByVolunteerId(volunteer.volunteer_id);

  return {
    isAvailable: volunteer.is_available,
    volunteer,
    assignment
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
