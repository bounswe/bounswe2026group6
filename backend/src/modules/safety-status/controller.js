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

function parseVisibleStatusesQuery(query) {
  const nearbyOnly = String(query.nearby || '').toLowerCase() === 'true';
  const context = String(query.context || '').trim().toLowerCase();
  const usesCurrentLocation = context === 'current-location';
  const latitude = query.latitude === undefined ? null : Number(query.latitude);
  const longitude = query.longitude === undefined ? null : Number(query.longitude);

  if (usesCurrentLocation) {
    if (!nearbyOnly) {
      return { error: 'current-location context requires nearby=true.' };
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      return { error: 'latitude must be a number between -90 and 90.' };
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return { error: 'longitude must be a number between -180 and 180.' };
    }
  }

  return {
    nearbyOnly,
    context,
    currentLocation: usesCurrentLocation ? { latitude, longitude } : null,
  };
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
    const query = parseVisibleStatusesQuery(request.query || {});
    if (query.error) {
      return sendError(response, 400, 'VALIDATION_FAILED', query.error);
    }
    const safetyStatuses = await getVisibleSafetyStatuses(request.user.userId, {
      isAdmin: Boolean(request.user.isAdmin),
      nearbyOnly: query.nearbyOnly,
      nearbyContext: query.context,
      currentLocation: query.currentLocation,
    });
    return response.status(200).json({ safetyStatuses });
  } catch (error) {
    if (error.status && error.code) {
      return sendError(response, error.status, error.code, error.message);
    }
    console.error('safetyStatus.handleGetVisibleSafetyStatuses failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

module.exports = {
  handleGetMySafetyStatus,
  handlePatchMySafetyStatus,
  handleGetVisibleSafetyStatuses,
};
