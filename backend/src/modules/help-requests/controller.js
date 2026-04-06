const {
  createMyHelpRequest,
  listMyHelpRequests,
  getMyHelpRequest,
  issueGuestHelpRequestAccessToken,
  getGuestHelpRequest,
  updateMyHelpRequestStatus,
  updateGuestHelpRequestStatus,
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

function readGuestAccessToken(request) {
  const headerToken = request.headers['x-help-request-access-token'];

  if (typeof headerToken === 'string' && headerToken.trim() !== '') {
    return headerToken.trim();
  }

  if (typeof request.query?.guestAccessToken === 'string' && request.query.guestAccessToken.trim() !== '') {
    return request.query.guestAccessToken.trim();
  }

  return null;
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
    const payload = { request: helpRequest, warnings };

    if (!userId) {
      payload.guestAccessToken = issueGuestHelpRequestAccessToken(helpRequest.id);
    }

    return response.status(201).json(payload);
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
  const requestId = request.params.requestId;

  try {
    let helpRequest = null;

    if (userId) {
      helpRequest = await getMyHelpRequest(userId, requestId);
    } else {
      const guestAccessToken = readGuestAccessToken(request);

      if (!guestAccessToken) {
        return sendError(response, 401, 'UNAUTHORIZED', 'Authentication required');
      }

      helpRequest = await getGuestHelpRequest(requestId, guestAccessToken);
    }

    if (!helpRequest) {
      return sendError(response, 404, 'NOT_FOUND', 'Help request not found');
    }

    return response.status(200).json({ request: helpRequest });
  } catch (error) {
    if (error.code === 'INVALID_GUEST_ACCESS_TOKEN') {
      return sendError(response, 401, 'UNAUTHORIZED', error.message);
    }

    if (error.code === 'FORBIDDEN_GUEST_ACCESS') {
      return sendError(response, 403, 'FORBIDDEN', error.message);
    }

    console.error('helpRequests.getHelpRequest failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

async function patchHelpRequestStatus(request, response) {
  const userId = readUserId(request);
  const requestId = request.params.requestId;
  const guestAccessToken = !userId ? readGuestAccessToken(request) : null;

  if (!userId && !guestAccessToken) {
    return sendError(response, 401, 'UNAUTHORIZED', 'Authentication required');
  }

  const { errors, value } = validateHelpRequestStatusUpdate(request.body || {});

  if (errors.length > 0) {
    return sendError(response, 400, 'VALIDATION_FAILED', 'Validation failed', errors);
  }

  try {
    const updatedRequest = userId
      ? await updateMyHelpRequestStatus(userId, requestId, value.status)
      : await updateGuestHelpRequestStatus(requestId, value.status, guestAccessToken);

    if (!updatedRequest) {
      return sendError(response, 404, 'NOT_FOUND', 'Help request not found');
    }

    return response.status(200).json({ request: updatedRequest });
  } catch (error) {
    if (error.code === 'INVALID_STATUS_TRANSITION') {
      return sendError(response, 409, 'INVALID_STATUS_TRANSITION', error.message);
    }

    if (error.code === 'INVALID_GUEST_ACCESS_TOKEN') {
      return sendError(response, 401, 'UNAUTHORIZED', error.message);
    }

    if (error.code === 'FORBIDDEN_GUEST_ACCESS') {
      return sendError(response, 403, 'FORBIDDEN', error.message);
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
