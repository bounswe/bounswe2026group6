const {
  createMyHelpRequest,
  listMyHelpRequests,
  getMyHelpRequest,
  issueGuestHelpRequestAccessToken,
  getGuestHelpRequest,
  updateMyHelpRequest,
  updateMyHelpRequestStatus,
  updateGuestHelpRequest,
  updateGuestHelpRequestStatus,
  listActiveHelpRequestsForVisibility,
} = require('./service');
const {
  readUserId,
  validateCreateHelpRequest,
  validateHelpRequestStatusUpdate,
  validateActiveHelpRequestListQuery,
} = require('./validators');
const { env } = require('../../config/env');

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

  return null;
}

async function createHelpRequest(request, response) {
  const userId = readUserId(request);

  if (!userId && !env.helpRequests.guestCreateEnabled) {
    return sendError(response, 403, 'GUEST_HELP_REQUESTS_DISABLED', 'Guest help request submission is disabled');
  }

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

async function updateHelpRequest(request, response) {
  const userId = readUserId(request);
  const requestId = request.params.requestId;
  const guestAccessToken = !userId ? readGuestAccessToken(request) : null;

  if (!userId && !guestAccessToken) {
    return sendError(response, 401, 'UNAUTHORIZED', 'Authentication required');
  }

  const { errors, warnings, value } = validateCreateHelpRequest(request.body || {});

  if (errors.length > 0) {
    return sendError(response, 400, 'VALIDATION_FAILED', 'Validation failed', errors);
  }

  try {
    const updatedRequest = userId
      ? await updateMyHelpRequest(userId, requestId, value)
      : await updateGuestHelpRequest(requestId, value, guestAccessToken);

    if (!updatedRequest) {
      return sendError(response, 404, 'NOT_FOUND', 'Help request not found');
    }

    return response.status(200).json({ request: updatedRequest, warnings });
  } catch (error) {
    if (error.code === 'REQUEST_NOT_EDITABLE') {
      return sendError(response, 409, 'REQUEST_NOT_EDITABLE', error.message);
    }

    if (error.code === 'INVALID_GUEST_ACCESS_TOKEN') {
      return sendError(response, 401, 'UNAUTHORIZED', error.message);
    }

    if (error.code === 'FORBIDDEN_GUEST_ACCESS') {
      return sendError(response, 403, 'FORBIDDEN', error.message);
    }

    console.error('helpRequests.updateHelpRequest failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

async function listActiveHelpRequests(request, response) {
  const { errors, value } = validateActiveHelpRequestListQuery(request.query || {});
  if (errors.length > 0) {
    return sendError(response, 400, 'VALIDATION_FAILED', 'Validation failed', errors);
  }

  try {
    const isAdmin = Boolean(request.user?.isAdmin);
    const payload = await listActiveHelpRequestsForVisibility({
      ...value,
      isAdmin,
    });

    return response.status(200).json({
      requests: payload.items,
      total: payload.total,
      pagination: {
        limit: value.limit,
        offset: value.offset,
      },
      filters: {
        type: value.typeFilters,
        status: value.statusFilters,
        bbox: value.bbox,
      },
    });
  } catch (error) {
    console.error('helpRequests.listActiveHelpRequests failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

module.exports = {
  createHelpRequest,
  listHelpRequests,
  getHelpRequest,
  updateHelpRequest,
  patchHelpRequestStatus,
  listActiveHelpRequests,
};
