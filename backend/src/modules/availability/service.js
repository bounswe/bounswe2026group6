const {
  findVolunteerByUserId,
  createVolunteer,
  updateVolunteerAvailability,
  createAvailabilityRecord,
  findMatchingRequestForVolunteer,
  createAssignment,
  updateRequestStatus,
  getAssignmentByVolunteerId,
  getAssignmentById,
  cancelAssignment,
  findMatchingVolunteerForRequest,
} = require('./repository');

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

  // Log to availability_records
  await createAvailabilityRecord(volunteer.volunteer_id, isAvailable, false);

  let assignment = null;
  // If volunteer just became available, try to match them with a request
  if (isAvailable) {
    const existingAssignment = await getAssignmentByVolunteerId(volunteer.volunteer_id);
    if (!existingAssignment) {
      const matchingRequest = await findMatchingRequestForVolunteer(volunteer.volunteer_id);
      if (matchingRequest) {
        assignment = await createAssignment(volunteer.volunteer_id, matchingRequest.request_id);
        await updateRequestStatus(matchingRequest.request_id, 'ASSIGNED');
        // Refresh assignment with full data
        assignment = await getAssignmentByVolunteerId(volunteer.volunteer_id);
      }
    } else {
      assignment = existingAssignment;
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

  // For MVP, we just store the sync records and set the latest status
  if (records.length > 0) {
    // Sort by timestamp to find the latest
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

  // If volunteer is now available and has no assignment, try to match
  if (updatedVolunteer.is_available && !currentAssignment) {
    const matchingRequest = await findMatchingRequestForVolunteer(volunteer.volunteer_id);
    if (matchingRequest) {
      await createAssignment(volunteer.volunteer_id, matchingRequest.request_id);
      await updateRequestStatus(matchingRequest.request_id, 'ASSIGNED');
      currentAssignment = await getAssignmentByVolunteerId(volunteer.volunteer_id);
    }
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

  await cancelAssignment(assignmentId);
  await updateRequestStatus(assignment.request_id, 'PENDING'); // Put it back to pending for re-assignment

  // Proactively try to find a NEW assignment for this volunteer since they are still available
  // (Assuming they want to stay available after cancelling)
  const newAssignment = await findMatchingRequestForVolunteer(volunteer.volunteer_id);
  let assignmentResult = null;
  if (newAssignment) {
    await createAssignment(volunteer.volunteer_id, newAssignment.request_id);
    await updateRequestStatus(newAssignment.request_id, 'ASSIGNED');
    assignmentResult = await getAssignmentByVolunteerId(volunteer.volunteer_id);
  }

  return { 
    message: 'Assignment cancelled and request put back to pending',
    newAssignment: assignmentResult
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

  await updateRequestStatus(requestId, 'RESOLVED');

  // Try to find a NEW assignment for this volunteer
  const newAssignment = await findMatchingRequestForVolunteer(volunteer.volunteer_id);
  let assignmentResult = null;
  if (newAssignment) {
    await createAssignment(volunteer.volunteer_id, newAssignment.request_id);
    await updateRequestStatus(newAssignment.request_id, 'ASSIGNED');
    assignmentResult = await getAssignmentByVolunteerId(volunteer.volunteer_id);
  }

  return { 
    message: 'Request marked as resolved',
    newAssignment: assignmentResult
  };
}

async function getAvailabilityStatus(userId) {
  let volunteer = await findVolunteerByUserId(userId);
  if (!volunteer) {
    // If volunteer record doesn't exist, they are not available by default
    // We could create one, but it's cleaner to just return false if it doesn't exist yet
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
  const matchingVolunteer = await findMatchingVolunteerForRequest(requestId);
  if (matchingVolunteer) {
    await createAssignment(matchingVolunteer.volunteer_id, requestId);
    await updateRequestStatus(requestId, 'ASSIGNED');
    return true;
  }
  return false;
}

module.exports = {
  setAvailability,
  syncAvailability,
  getMyAssignment,
  cancelMyAssignment,
  resolveMyAssignment,
  getAvailabilityStatus,
  tryToAssignRequest,
};
