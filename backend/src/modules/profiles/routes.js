const express = require('express');
const { requireAuth } = require('../auth/middleware');
const {
  getMe,
  patchMe,
  patchPhysical,
  patchHealth,
  patchLocation,
  patchPrivacy,
  patchProfession,
  putExpertiseAreas,
} = require('./controller');

const profilesRouter = express.Router();

profilesRouter.get('/', (_request, response) => {
  response.status(200).json({
    module: 'profiles',
    scope: ['profile', 'privacy', 'health', 'location', 'profession', 'expertiseAreas'],
    status: 'ready for implementation',
  });
});

profilesRouter.get('/me', requireAuth, getMe);
profilesRouter.patch('/me', requireAuth, patchMe);
profilesRouter.patch('/me/physical', requireAuth, patchPhysical);
profilesRouter.patch('/me/health', requireAuth, patchHealth);
profilesRouter.patch('/me/location', requireAuth, patchLocation);
profilesRouter.patch('/me/privacy', requireAuth, patchPrivacy);
profilesRouter.patch('/me/profession', requireAuth, patchProfession);
profilesRouter.put('/me/expertise-areas', requireAuth, putExpertiseAreas);

module.exports = {
  profilesRouter,
};
