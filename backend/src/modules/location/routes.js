const express = require('express');

const {
  handleGetLocationTree,
  handleSearchLocation,
  handleReverseLocation,
} = require('./controller');

const locationRouter = express.Router();

locationRouter.get('/tree', handleGetLocationTree);
locationRouter.get('/search', handleSearchLocation);
locationRouter.get('/reverse', handleReverseLocation);

module.exports = {
  locationRouter,
};
