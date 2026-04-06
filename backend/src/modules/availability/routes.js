const express = require('express');
const {
  handleSetAvailability,
  handleSyncAvailability,
  handleGetMyAssignment,
  handleCancelAssignment,
  handleResolveAssignment,
  handleGetAvailabilityStatus,
} = require('./controller');
const { requireAuth } = require('../auth/middleware');

const availabilityRouter = express.Router();

// All availability routes require authentication
availabilityRouter.use(requireAuth);

// Get current availability status
availabilityRouter.get('/status', handleGetAvailabilityStatus);

// Toggle availability on/off
availabilityRouter.post('/toggle', handleSetAvailability);

// Sync availability records (for offline support)
availabilityRouter.post('/sync', handleSyncAvailability);

// Get current assignment for the volunteer
availabilityRouter.get('/my-assignment', handleGetMyAssignment);

// Cancel current assignment
availabilityRouter.post('/assignments/:assignmentId/cancel', handleCancelAssignment);

// Mark request as resolved
availabilityRouter.post('/assignments/resolve', handleResolveAssignment);

module.exports = {
  availabilityRouter,
};
