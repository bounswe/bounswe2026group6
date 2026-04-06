const {
  createMyHelpRequest,
  listMyHelpRequests,
  getMyHelpRequest,
  updateMyHelpRequestStatus,
} = require('./service');
const {
  readUserId,
  validateCreateHelpRequest,
  validateHelpRequestStatusUpdate,
} = require('./validators');

function sendError(response, status, code, message, details) {
  const payload = { code, message };

  if (details) {
    payload.details = details;
  }

  return response.status(status).json(payload);
}

async function createHelpRequest(request, response) {
  const userId = readUserId(request);

  // userId may be null for guest submissions — that is allowed

  const { errors, warnings, value } = validateCreateHelpRequest(request.body || {});

  if (errors.length > 0) {
    return sendError(response, 400, 'VALIDATION_FAILED', 'Validation failed', errors);
  }

  try {
    const helpRequest = await createMyHelpRequest(userId, value);

    return response.status(201).json({ request: helpRequest, warnings });
  } catch (error) {
    if (error.code === 'INVALID_USER') {
      return sendError(response, 400, 'INVALID_USER', 'The provided user does not exist in the database yet.');
    }

    console.error('helpRequests.createHelpRequest failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

async function listHelpRequests(request, response) {
  const userId = readUserId(request);

  if (!userId) {
    return sendError(response, 401, 'UNAUTHORIZED', 'Authentication required');
  }

  try {
    const requests = await listMyHelpRequests(userId);
    return response.status(200).json({ requests });
  } catch (error) {
    console.error('helpRequests.listHelpRequests failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

async function getHelpRequest(request, response) {
  const userId = readUserId(request);

  if (!userId) {
    return sendError(response, 401, 'UNAUTHORIZED', 'Authentication required');
  }

  try {
    const helpRequest = await getMyHelpRequest(userId, request.params.requestId);

    if (!helpRequest) {
      return sendError(response, 404, 'NOT_FOUND', 'Help request not found');
    }

    return response.status(200).json({ request: helpRequest });
  } catch (error) {
    console.error('helpRequests.getHelpRequest failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

async function patchHelpRequestStatus(request, response) {
  const userId = readUserId(request);

  if (!userId) {
    return sendError(response, 401, 'UNAUTHORIZED', 'Authentication required');
  }

  const { errors, value } = validateHelpRequestStatusUpdate(request.body || {});

  if (errors.length > 0) {
    return sendError(response, 400, 'VALIDATION_FAILED', 'Validation failed', errors);
  }

  try {
    const updatedRequest = await updateMyHelpRequestStatus(
      userId,
      request.params.requestId,
      value.status,
    );

    if (!updatedRequest) {
      return sendError(response, 404, 'NOT_FOUND', 'Help request not found');
    }

    return response.status(200).json({ request: updatedRequest });
  } catch (error) {
    if (error.code === 'INVALID_STATUS_TRANSITION') {
      return sendError(response, 409, 'INVALID_STATUS_TRANSITION', error.message);
    }

    console.error('helpRequests.patchHelpRequestStatus failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

module.exports = {
  createHelpRequest,
  listHelpRequests,
  getHelpRequest,
  patchHelpRequestStatus,
};
