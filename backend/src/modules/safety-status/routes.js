const express = require('express');
const { requireAuth } = require('../auth/middleware');
const {
  handleGetMySafetyStatus,
  handlePatchMySafetyStatus,
  handleGetVisibleSafetyStatuses,
} = require('./controller');

const safetyStatusRouter = express.Router();

safetyStatusRouter.use(requireAuth);

safetyStatusRouter.get('/me', handleGetMySafetyStatus);
safetyStatusRouter.patch('/me', handlePatchMySafetyStatus);
safetyStatusRouter.get('/visible', handleGetVisibleSafetyStatuses);

module.exports = {
  safetyStatusRouter,
};
