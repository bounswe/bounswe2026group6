const express = require('express');
const {
  getMe,
  patchMe,
  patchPhysical,
  patchHealth,
  patchLocation,
  patchPrivacy,
} = require('./controller');

const profilesRouter = express.Router();

profilesRouter.get('/', (_request, response) => {
  response.status(200).json({
    module: 'profiles',
    scope: ['profile', 'privacy', 'health', 'location'],
    status: 'ready for implementation',
  });
});

profilesRouter.get('/me', getMe);
profilesRouter.patch('/me', patchMe);
profilesRouter.patch('/me/physical', patchPhysical);
profilesRouter.patch('/me/health', patchHealth);
profilesRouter.patch('/me/location', patchLocation);
profilesRouter.patch('/me/privacy', patchPrivacy);

module.exports = {
  profilesRouter,
};
