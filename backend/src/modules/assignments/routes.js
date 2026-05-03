const express = require('express');

const { requireAuth } = require('../auth/middleware');
const { handleGetAssignmentRoute } = require('./controller');

const assignmentsRouter = express.Router();

assignmentsRouter.use(requireAuth);

assignmentsRouter.get('/:assignmentId/route', handleGetAssignmentRoute);

module.exports = {
  assignmentsRouter,
};
