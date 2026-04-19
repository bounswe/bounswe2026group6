const {
  getLocationTree,
  searchLocations,
  reverseGeocode,
} = require('./service');
const {
  validateTreeQuery,
  validateSearchQuery,
  validateReverseQuery,
} = require('./validators');

function sendError(response, status, code, message) {
  return response.status(status).json({ code, message });
}

function mapServiceError(response, error) {
  if (error.code === 'GEOCODER_TIMEOUT') {
    return sendError(response, 504, 'GEOCODER_TIMEOUT', 'Location provider timed out');
  }

  if (error.code === 'LOCATION_NOT_FOUND') {
    return sendError(response, 404, 'LOCATION_NOT_FOUND', 'No location found for coordinates');
  }

  if (error.code === 'GEOCODER_UNAVAILABLE') {
    return sendError(response, 503, 'GEOCODER_UNAVAILABLE', 'Location provider is unavailable');
  }

  console.error('location.controller failed', error);
  return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
}

async function handleGetLocationTree(request, response) {
  const validation = validateTreeQuery(request.query || {});
  if (!validation.ok) {
    return sendError(response, 400, validation.code, validation.message);
  }

  try {
    const tree = await getLocationTree(validation.value.countryCode);

    if (!tree) {
      return sendError(response, 404, 'NOT_FOUND', 'No location tree found for countryCode');
    }

    return response.status(200).json({
      countryCode: validation.value.countryCode,
      tree,
    });
  } catch (error) {
    return mapServiceError(response, error);
  }
}

async function handleSearchLocation(request, response) {
  const validation = validateSearchQuery(request.query || {});
  if (!validation.ok) {
    return sendError(response, 400, validation.code, validation.message);
  }

  try {
    const items = await searchLocations(validation.value);
    return response.status(200).json({ items });
  } catch (error) {
    return mapServiceError(response, error);
  }
}

async function handleReverseLocation(request, response) {
  const validation = validateReverseQuery(request.query || {});
  if (!validation.ok) {
    return sendError(response, 400, validation.code, validation.message);
  }

  try {
    const item = await reverseGeocode(validation.value);

    if (!item) {
      return sendError(response, 404, 'LOCATION_NOT_FOUND', 'No location found for coordinates');
    }

    return response.status(200).json({ item });
  } catch (error) {
    return mapServiceError(response, error);
  }
}

module.exports = {
  handleGetLocationTree,
  handleSearchLocation,
  handleReverseLocation,
};
