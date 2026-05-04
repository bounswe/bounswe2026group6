const {
  getMyOperationalLocation,
  patchMyOperationalLocation,
} = require('./service');
const { validateOperationalLocationPatch } = require('./validators');

function sendError(response, status, code, message) {
  return response.status(status).json({ code, message });
}

async function handleGetMyOperationalLocation(request, response) {
  try {
    const operationalLocation = await getMyOperationalLocation(request.user.userId);

    if (!operationalLocation) {
      return sendError(response, 404, 'NOT_FOUND', 'Operational location not found');
    }

    return response.status(200).json(operationalLocation);
  } catch (error) {
    console.error('operationalLocation.handleGetMyOperationalLocation failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

async function handlePatchMyOperationalLocation(request, response) {
  const validation = validateOperationalLocationPatch(request.body);

  if (!validation.ok) {
    return sendError(response, 400, validation.code, validation.message);
  }

  try {
    const operationalLocation = await patchMyOperationalLocation(request.user.userId, validation.data);
    return response.status(200).json(operationalLocation);
  } catch (error) {
    console.error('operationalLocation.handlePatchMyOperationalLocation failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

module.exports = {
  handleGetMyOperationalLocation,
  handlePatchMyOperationalLocation,
};
