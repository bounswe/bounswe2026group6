const express = require('express');
const { requireAuth } = require('../auth/middleware');
const {
  handleCreateCircle,
  handleListCircles,
  handleGetCircle,
  handleCreateInvite,
  handleListInvites,
  handleRespondToInvite,
  handleCircleCheckIn,
  handleLeaveCircle,
  handleDeleteCircle,
  handleTransferOwnership,
} = require('./controller');

const safetyCirclesRouter = express.Router();

safetyCirclesRouter.use(requireAuth);

safetyCirclesRouter.get('/', handleListCircles);
safetyCirclesRouter.post('/', handleCreateCircle);
safetyCirclesRouter.get('/invites', handleListInvites);
safetyCirclesRouter.post('/invites/:inviteId/respond', handleRespondToInvite);
safetyCirclesRouter.get('/:circleId', handleGetCircle);
safetyCirclesRouter.post('/:circleId/invites', handleCreateInvite);
safetyCirclesRouter.patch('/:circleId/owner', handleTransferOwnership);
safetyCirclesRouter.patch('/:circleId/check-in', handleCircleCheckIn);
safetyCirclesRouter.delete('/:circleId', handleDeleteCircle);
safetyCirclesRouter.delete('/:circleId/members/me', handleLeaveCircle);

module.exports = {
  safetyCirclesRouter,
};
