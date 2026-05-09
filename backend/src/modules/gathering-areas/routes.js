const express = require('express');

const { handleNearbyGatheringAreas, handleViewportGatheringAreas } = require('./controller');

const gatheringAreasRouter = express.Router();

gatheringAreasRouter.get('/nearby', handleNearbyGatheringAreas);
gatheringAreasRouter.get('/viewport', handleViewportGatheringAreas);

module.exports = {
  gatheringAreasRouter,
};
