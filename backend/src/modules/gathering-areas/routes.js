const express = require('express');

const { handleNearbyGatheringAreas } = require('./controller');

const gatheringAreasRouter = express.Router();

gatheringAreasRouter.get('/nearby', handleNearbyGatheringAreas);

module.exports = {
  gatheringAreasRouter,
};
