const express = require('express');
const { getMe, notImplemented } = require('./controller');

const profilesRouter = express.Router();

profilesRouter.get('/', (_request, response) => {
  response.status(200).json({
    module: 'profiles',
    scope: ['profile', 'privacy', 'health', 'location'],
    status: 'ready for implementation',
  });
});

profilesRouter.get('/me', getMe);
profilesRouter.patch('/me', notImplemented);
profilesRouter.patch('/me/physical', notImplemented);
profilesRouter.patch('/me/health', notImplemented);
profilesRouter.patch('/me/location', notImplemented);
profilesRouter.patch('/me/privacy', notImplemented);

module.exports = {
  profilesRouter,
};
