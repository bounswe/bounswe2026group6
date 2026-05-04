const {
  createSafetyCircle,
  listMySafetyCircles,
  getSafetyCircle,
  inviteToSafetyCircle,
  listMySafetyCircleInvites,
  respondToSafetyCircleInvite,
  checkInToSafetyCircle,
  leaveSafetyCircle,
} = require('./service');
const {
  validateCreateCircle,
  validateCreateInvite,
  validateInviteResponse,
} = require('./validators');
const { validateSafetyStatusPatch } = require('../safety-status/validators');

function sendError(response, status, code, message, details) {
  const payload = { code, message };
  if (details) {
    payload.details = details;
  }
  return response.status(status).json(payload);
}

function handleServiceError(response, error) {
  if (error.code === 'NOT_FOUND') {
    return sendError(response, 404, 'NOT_FOUND', error.message);
  }
  if (error.code === 'CONFLICT') {
    return sendError(response, 409, 'CONFLICT', error.message);
  }
  console.error('safetyCircles request failed', error);
  return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
}

async function handleCreateCircle(request, response) {
  const { errors, value } = validateCreateCircle(request.body || {});
  if (errors.length > 0) {
    return sendError(response, 400, 'VALIDATION_FAILED', 'Validation failed', errors);
  }

  try {
    const circle = await createSafetyCircle(request.user.userId, value);
    return response.status(201).json({ circle });
  } catch (error) {
    return handleServiceError(response, error);
  }
}

async function handleListCircles(request, response) {
  try {
    const circles = await listMySafetyCircles(request.user.userId);
    return response.status(200).json({ circles });
  } catch (error) {
    return handleServiceError(response, error);
  }
}

async function handleGetCircle(request, response) {
  try {
    const circle = await getSafetyCircle(request.user.userId, request.params.circleId);
    return response.status(200).json(circle);
  } catch (error) {
    return handleServiceError(response, error);
  }
}

async function handleCreateInvite(request, response) {
  const { errors, value } = validateCreateInvite(request.body || {});
  if (errors.length > 0) {
    return sendError(response, 400, 'VALIDATION_FAILED', 'Validation failed', errors);
  }

  try {
    const invite = await inviteToSafetyCircle(request.user.userId, request.params.circleId, value);
    return response.status(201).json({ invite });
  } catch (error) {
    return handleServiceError(response, error);
  }
}

async function handleListInvites(request, response) {
  try {
    const invites = await listMySafetyCircleInvites(request.user.userId);
    return response.status(200).json({ invites });
  } catch (error) {
    return handleServiceError(response, error);
  }
}

async function handleRespondToInvite(request, response) {
  const { errors, value } = validateInviteResponse(request.body || {});
  if (errors.length > 0) {
    return sendError(response, 400, 'VALIDATION_FAILED', 'Validation failed', errors);
  }

  try {
    const invite = await respondToSafetyCircleInvite(request.user.userId, request.params.inviteId, value.decision);
    return response.status(200).json({ invite });
  } catch (error) {
    return handleServiceError(response, error);
  }
}

async function handleCircleCheckIn(request, response) {
  const { errors, value } = validateSafetyStatusPatch(request.body || {});
  if (errors.length > 0) {
    return sendError(response, 400, 'VALIDATION_FAILED', 'Validation failed', errors);
  }

  try {
    const result = await checkInToSafetyCircle(request.user.userId, request.params.circleId, value);
    return response.status(200).json(result);
  } catch (error) {
    return handleServiceError(response, error);
  }
}

async function handleLeaveCircle(request, response) {
  try {
    const result = await leaveSafetyCircle(request.user.userId, request.params.circleId);
    return response.status(200).json(result);
  } catch (error) {
    return handleServiceError(response, error);
  }
}

module.exports = {
  handleCreateCircle,
  handleListCircles,
  handleGetCircle,
  handleCreateInvite,
  handleListInvites,
  handleRespondToInvite,
  handleCircleCheckIn,
  handleLeaveCircle,
};
