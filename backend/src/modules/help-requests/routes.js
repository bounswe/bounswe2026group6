const express = require('express');

const {
  createHelpRequest,
  listHelpRequestsByUserId,
  findHelpRequestByIdForUser,
} = require('./repository');
const { validateCreateHelpRequest } = require('./validator');

const helpRequestsRouter = express.Router();

function getCurrentUserId(request) {
  const userId = request.header('x-user-id');

  if (typeof userId !== 'string') {
    return null;
  }

  const trimmedUserId = userId.trim();

  return trimmedUserId || null;
}

function respondMissingUserId(response) {
  response.status(401).json({
    message: 'Missing `x-user-id` header. Use it until the auth flow is implemented.',
  });
}

function handleDatabaseError(error, response) {
  if (error.code === '23503') {
    response.status(400).json({
      message: 'The provided user does not exist in the database yet.',
    });

    return true;
  }

  return false;
}

helpRequestsRouter.post('/', async (request, response) => {
  const userId = getCurrentUserId(request);

  if (!userId) {
    respondMissingUserId(response);
    return;
  }

  const { errors, warnings, value } = validateCreateHelpRequest(request.body || {});

  if (errors.length > 0) {
    response.status(400).json({
      message: 'Validation failed.',
      errors,
    });

    return;
  }

  try {
    const createdRequest = await createHelpRequest({
      ...value,
      userId,
    });

    response.status(201).json({
      request: createdRequest,
      warnings,
    });
  } catch (error) {
    if (handleDatabaseError(error, response)) {
      return;
    }

    response.status(500).json({
      message: 'Failed to create help request.',
    });
  }
});

helpRequestsRouter.get('/', async (request, response) => {
  const userId = getCurrentUserId(request);

  if (!userId) {
    respondMissingUserId(response);
    return;
  }

  try {
    const requests = await listHelpRequestsByUserId(userId);

    response.status(200).json({ requests });
  } catch (_error) {
    response.status(500).json({
      message: 'Failed to list help requests.',
    });
  }
});

helpRequestsRouter.get('/:requestId', async (request, response) => {
  const userId = getCurrentUserId(request);

  if (!userId) {
    respondMissingUserId(response);
    return;
  }

  try {
    const helpRequest = await findHelpRequestByIdForUser(userId, request.params.requestId);

    if (!helpRequest) {
      response.status(404).json({
        message: 'Help request not found.',
      });

      return;
    }

    response.status(200).json({ request: helpRequest });
  } catch (_error) {
    response.status(500).json({
      message: 'Failed to fetch help request.',
    });
  }
});

module.exports = {
  helpRequestsRouter,
};
