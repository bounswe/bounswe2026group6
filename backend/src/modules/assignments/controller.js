const { getAssignmentRoute } = require('./service');

function sendError(response, status, code, message) {
  return response.status(status).json({ code, message });
}

async function handleGetAssignmentRoute(request, response) {
  const { assignmentId } = request.params;
  if (!assignmentId) {
    return sendError(response, 400, 'VALIDATION_ERROR', 'assignmentId is required');
  }

  try {
    const route = await getAssignmentRoute({
      assignmentId,
      userId: request.user.userId,
    });

    return response.status(200).json(route);
  } catch (error) {
    if (error.code === 'ASSIGNMENT_NOT_FOUND') {
      return sendError(response, 404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found');
    }

    if (error.code === 'FORBIDDEN') {
      return sendError(response, 403, 'FORBIDDEN', 'You cannot access this assignment route');
    }

    if (error.code === 'LOCATION_UNAVAILABLE') {
      return response.status(200).json({ error: 'location_unavailable' });
    }

    console.error('assignments.route failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Something went wrong');
  }
}

module.exports = {
  handleGetAssignmentRoute,
};
