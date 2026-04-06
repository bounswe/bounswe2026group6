const express = require('express');
const { requireAuth, optionalAuth } = require('../auth/middleware');
const {
  createHelpRequest,
  listHelpRequests,
  getHelpRequest,
  patchHelpRequestStatus,
} = require('./controller');

const helpRequestsRouter = express.Router();

// Guest-accessible: optionalAuth sets req.user if token present, but doesn't block
helpRequestsRouter.post('/', optionalAuth, createHelpRequest);

// These routes require authentication
helpRequestsRouter.get('/', requireAuth, listHelpRequests);
helpRequestsRouter.get('/:requestId', optionalAuth, getHelpRequest);
helpRequestsRouter.patch('/:requestId/status', optionalAuth, patchHelpRequestStatus);

module.exports = {
  helpRequestsRouter,
};
