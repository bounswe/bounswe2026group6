const jwt = require('jsonwebtoken');

const { env } = require('../../config/env');
const {
  createHelpRequest,
  listHelpRequestsByUserId,
  findHelpRequestById,
  findHelpRequestByIdForUser,
  markHelpRequestAsSynced,
  markHelpRequestAsResolved,
  markHelpRequestAsSyncedByRequestId,
  markHelpRequestAsResolvedByRequestId,
} = require('./repository');
const { tryToAssignRequest } = require('../availability/service');

const JWT_SECRET = env.jwt.secret;
const GUEST_HELP_REQUEST_SCOPE = 'help_request_guest_read';
const GUEST_HELP_REQUEST_TOKEN_TTL = '30d';

async function createMyHelpRequest(userId, input) {
  try {
    const helpRequest = await createHelpRequest({
      ...input,
      userId,
    });

    // Try to auto-assign a volunteer
    await tryToAssignRequest(helpRequest.id);

    // Return the request (it might have been updated to ASSIGNED status)
    return await findHelpRequestById(helpRequest.id);
  } catch (error) {
    if (error.code === '23503') {
      const wrappedError = new Error('The provided user does not exist in the database yet.');
      wrappedError.code = 'INVALID_USER';
      throw wrappedError;
    }

    throw error;
  }
}

async function listMyHelpRequests(userId) {
  return listHelpRequestsByUserId(userId);
}

async function getMyHelpRequest(userId, requestId) {
  return findHelpRequestByIdForUser(userId, requestId);
}

function buildGuestAccessError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function issueGuestHelpRequestAccessToken(requestId) {
  return jwt.sign(
    {
      scope: GUEST_HELP_REQUEST_SCOPE,
      requestId,
    },
    JWT_SECRET,
    {
      expiresIn: GUEST_HELP_REQUEST_TOKEN_TTL,
    },
  );
}

function verifyGuestHelpRequestAccessToken(guestAccessToken) {
  if (typeof guestAccessToken !== 'string' || guestAccessToken.trim() === '') {
    throw buildGuestAccessError('INVALID_GUEST_ACCESS_TOKEN', 'Guest access token is required.');
  }

  try {
    const decoded = jwt.verify(guestAccessToken.trim(), JWT_SECRET);

    if (
      !decoded
      || decoded.scope !== GUEST_HELP_REQUEST_SCOPE
      || typeof decoded.requestId !== 'string'
      || decoded.requestId.trim() === ''
    ) {
      throw buildGuestAccessError('INVALID_GUEST_ACCESS_TOKEN', 'Invalid or expired guest access token.');
    }

    return decoded.requestId;
  } catch (error) {
    if (error.code === 'INVALID_GUEST_ACCESS_TOKEN') {
      throw error;
    }

    throw buildGuestAccessError('INVALID_GUEST_ACCESS_TOKEN', 'Invalid or expired guest access token.');
  }
}

async function getGuestHelpRequest(requestId, guestAccessToken) {
  const tokenRequestId = verifyGuestHelpRequestAccessToken(guestAccessToken);

  if (tokenRequestId !== requestId) {
    throw buildGuestAccessError('FORBIDDEN_GUEST_ACCESS', 'Guest access token is not valid for this help request.');
  }

  const helpRequest = await findHelpRequestById(requestId);

  if (!helpRequest) {
    return null;
  }

  if (helpRequest.userId) {
    throw buildGuestAccessError(
      'FORBIDDEN_GUEST_ACCESS',
      'Guest access token can only be used for guest-created help requests.',
    );
  }

  return helpRequest;
}

function buildInvalidTransitionError(message) {
  const error = new Error(message);
  error.code = 'INVALID_STATUS_TRANSITION';
  return error;
}

async function applyStatusTransition(currentRequest, nextStatus, handlers) {
  if (nextStatus === 'SYNCED') {
    if (currentRequest.internalStatus === 'RESOLVED') {
      throw buildInvalidTransitionError('A resolved request cannot be moved back to synced.');
    }

    return handlers.sync();
  }

  if (nextStatus === 'RESOLVED') {
    if (currentRequest.internalStatus === 'RESOLVED') {
      return currentRequest;
    }

    return handlers.resolve();
  }

  throw buildInvalidTransitionError('This status update is not supported in the help request module.');
}

async function updateMyHelpRequestStatus(userId, requestId, nextStatus) {
  const currentRequest = await findHelpRequestByIdForUser(userId, requestId);

  if (!currentRequest) {
    return null;
  }

  return applyStatusTransition(currentRequest, nextStatus, {
    sync: () => markHelpRequestAsSynced(userId, requestId),
    resolve: () => markHelpRequestAsResolved(userId, requestId),
  });
}

async function updateGuestHelpRequestStatus(requestId, nextStatus, guestAccessToken) {
  const currentRequest = await getGuestHelpRequest(requestId, guestAccessToken);

  if (!currentRequest) {
    return null;
  }

  return applyStatusTransition(currentRequest, nextStatus, {
    sync: () => markHelpRequestAsSyncedByRequestId(requestId),
    resolve: () => markHelpRequestAsResolvedByRequestId(requestId),
  });
}

module.exports = {
  createMyHelpRequest,
  listMyHelpRequests,
  getMyHelpRequest,
  issueGuestHelpRequestAccessToken,
  getGuestHelpRequest,
  updateMyHelpRequestStatus,
  updateGuestHelpRequestStatus,
};
