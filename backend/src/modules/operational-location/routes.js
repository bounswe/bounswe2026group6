const express = require('express');
const { requireAuth } = require('../auth/middleware');
const {
  handleGetMyOperationalLocation,
  handlePatchMyOperationalLocation,
} = require('./controller');

const operationalLocationRouter = express.Router();

operationalLocationRouter.use(requireAuth);

operationalLocationRouter.get('/me', handleGetMyOperationalLocation);
operationalLocationRouter.patch('/me', handlePatchMyOperationalLocation);

module.exports = {
  operationalLocationRouter,
};
