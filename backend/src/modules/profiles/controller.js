const {
  getMyProfile,
  hasProfile,
  patchMyProfile,
  patchMyPhysical,
  patchMyHealth,
  patchMyLocation,
  patchMyPrivacy,
} = require('./service');
const {
  readUserId,
  validateProfilePatch,
  validatePhysicalPatch,
  validateHealthPatch,
  validateLocationPatch,
  validatePrivacyPatch,
} = require('./validators');

function sendError(response, status, code, message) {
  return response.status(status).json({ code, message });
}

function sendAuthError(response) {
  return sendError(response, 401, 'UNAUTHORIZED', 'Authentication required');
}

function mapServiceError(response, error) {
  if (error.message === 'USER_NOT_FOUND') {
    return sendError(response, 404, 'NOT_FOUND', 'User not found');
  }

  if (error.message === 'PROFILE_NOT_FOUND') {
    return sendError(response, 404, 'NOT_FOUND', 'Profile not found. Create base profile first via PATCH /api/profiles/me');
  }

  console.error('profiles.controller failed', error);
  return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
}

async function getMe(request, response) {
  const userId = readUserId(request);

  if (!userId) {
    return sendAuthError(response);
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

async function patchMe(request, response) {
  const userId = readUserId(request);

  if (!userId) {
    return sendAuthError(response);
  }

  try {
    const profileExists = await hasProfile(userId);
    const validation = validateProfilePatch(request.body, { requireNames: !profileExists });

    if (!validation.ok) {
      return sendError(response, 400, validation.code, validation.message);
    }

    const profile = await patchMyProfile(userId, validation.data);
    return response.status(200).json(profile);
  } catch (error) {
    return mapServiceError(response, error);
  }
}

async function patchPhysical(request, response) {
  const userId = readUserId(request);

  if (!userId) {
    return sendAuthError(response);
  }

  const validation = validatePhysicalPatch(request.body);
  if (!validation.ok) {
    return sendError(response, 400, validation.code, validation.message);
  }

  try {
    const profile = await patchMyPhysical(userId, validation.data, Object.keys(validation.data));
    return response.status(200).json(profile);
  } catch (error) {
    return mapServiceError(response, error);
  }
}

async function patchHealth(request, response) {
  const userId = readUserId(request);

  if (!userId) {
    return sendAuthError(response);
  }

  const validation = validateHealthPatch(request.body);
  if (!validation.ok) {
    return sendError(response, 400, validation.code, validation.message);
  }

  try {
    const profile = await patchMyHealth(userId, validation.data, Object.keys(validation.data));
    return response.status(200).json(profile);
  } catch (error) {
    return mapServiceError(response, error);
  }
}

async function patchLocation(request, response) {
  const userId = readUserId(request);

  if (!userId) {
    return sendAuthError(response);
  }

  const validation = validateLocationPatch(request.body);
  if (!validation.ok) {
    return sendError(response, 400, validation.code, validation.message);
  }

  try {
    const profile = await patchMyLocation(userId, validation.data, Object.keys(validation.data));
    return response.status(200).json(profile);
  } catch (error) {
    return mapServiceError(response, error);
  }
}

async function patchPrivacy(request, response) {
  const userId = readUserId(request);

  if (!userId) {
    return sendAuthError(response);
  }

  const validation = validatePrivacyPatch(request.body);
  if (!validation.ok) {
    return sendError(response, 400, validation.code, validation.message);
  }

  try {
    const profile = await patchMyPrivacy(userId, validation.data, Object.keys(validation.data));
    return response.status(200).json(profile);
  } catch (error) {
    return mapServiceError(response, error);
  }
}

module.exports = {
  getMe,
  patchMe,
  patchPhysical,
  patchHealth,
  patchLocation,
  patchPrivacy,
};
