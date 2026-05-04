const {
  getMySafetyStatus,
  patchMySafetyStatus,
  getVisibleSafetyStatuses,
} = require('./service');
const { validateSafetyStatusPatch } = require('./validators');

function sendError(response, status, code, message, details) {
  const payload = { code, message };
  if (details) {
    payload.details = details;
  }
  return response.status(status).json(payload);
}

async function handleGetMySafetyStatus(request, response) {
  try {
    const safetyStatus = await getMySafetyStatus(request.user.userId);
    return response.status(200).json({ safetyStatus });
  } catch (error) {
    console.error('safetyStatus.handleGetMySafetyStatus failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

async function handlePatchMySafetyStatus(request, response) {
  const { errors, value } = validateSafetyStatusPatch(request.body || {});
  if (errors.length > 0) {
    return sendError(response, 400, 'VALIDATION_FAILED', 'Validation failed', errors);
  }

  try {
    const safetyStatus = await patchMySafetyStatus(request.user.userId, value);
    return response.status(200).json({ safetyStatus });
  } catch (error) {
    console.error('safetyStatus.handlePatchMySafetyStatus failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

async function handleGetVisibleSafetyStatuses(request, response) {
  try {
    const safetyStatuses = await getVisibleSafetyStatuses(request.user.userId, {
      isAdmin: Boolean(request.user.isAdmin),
    });
    return response.status(200).json({ safetyStatuses });
  } catch (error) {
    console.error('safetyStatus.handleGetVisibleSafetyStatuses failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

module.exports = {
  handleGetMySafetyStatus,
  handlePatchMySafetyStatus,
  handleGetVisibleSafetyStatuses,
};
