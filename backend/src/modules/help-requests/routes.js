const express = require('express');
const { requireAuth } = require('../auth/middleware');
const {
  createHelpRequest,
  listHelpRequests,
  getHelpRequest,
  patchHelpRequestStatus,
} = require('./controller');

const helpRequestsRouter = express.Router();

helpRequestsRouter.use(requireAuth);

helpRequestsRouter.post('/', createHelpRequest);
helpRequestsRouter.get('/', listHelpRequests);
helpRequestsRouter.get('/:requestId', getHelpRequest);
helpRequestsRouter.patch('/:requestId/status', patchHelpRequestStatus);

module.exports = {
  helpRequestsRouter,
};
