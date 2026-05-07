const { getNearbyGatheringAreas } = require('./service');
const { validateNearbyQuery } = require('./validators');

function sendError(response, status, code, message) {
  return response.status(status).json({ code, message });
}

function mapServiceError(response, error) {
  if (error.code === 'OVERPASS_TIMEOUT') {
    return sendError(response, 504, 'OVERPASS_TIMEOUT', 'Gathering areas provider timed out');
  }

  if (error.code === 'OVERPASS_UNAVAILABLE') {
    return sendError(response, 503, 'OVERPASS_UNAVAILABLE', 'Gathering areas provider is unavailable');
  }

  if (error.code === 'OVERPASS_INVALID_PAYLOAD') {
    return sendError(response, 503, 'OVERPASS_UNAVAILABLE', 'Gathering areas provider is unavailable');
  }

  console.error('gathering-areas.controller failed', error);
  return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
}

async function handleNearbyGatheringAreas(request, response) {
  const validation = validateNearbyQuery(request.query || {});
  if (!validation.ok) {
    return sendError(response, 400, validation.code, validation.message);
  }

  try {
    const result = await getNearbyGatheringAreas(validation.value);
    return response.status(200).json(result);
  } catch (error) {
    return mapServiceError(response, error);
  }
}

module.exports = {
  handleNearbyGatheringAreas,
};
