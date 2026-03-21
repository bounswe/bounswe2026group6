const { getMyProfile } = require('./service');
const { readUserId } = require('./validators');

function sendError(response, status, code, message) {
  return response.status(status).json({ code, message });
}

async function getMe(request, response) {
  const userId = readUserId(request);

  if (!userId) {
    return sendError(response, 401, 'UNAUTHORIZED', 'Authentication required');
  }

  try {
    const profile = await getMyProfile(userId);

    if (!profile) {
      return sendError(response, 404, 'NOT_FOUND', 'Profile not found');
    }

    return response.status(200).json(profile);
  } catch (error) {
    console.error('profiles.getMe failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

function notImplemented(_request, response) {
  return sendError(response, 501, 'NOT_IMPLEMENTED', 'This endpoint is planned but not implemented yet');
}

module.exports = {
  getMe,
  notImplemented,
};
