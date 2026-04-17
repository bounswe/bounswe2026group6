const express = require('express');

const { authRouter } = require('../modules/auth/routes');
const { profilesRouter } = require('../modules/profiles/routes');
const { helpRequestsRouter } = require('../modules/help-requests/routes');
const { availabilityRouter } = require('../modules/availability/routes');

const apiRouter = express.Router();

apiRouter.get('/', (_request, response) => {
  response.status(200).json({
    service: 'api',
    status: 'ok',
  });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/profiles', profilesRouter);
apiRouter.use('/help-requests', helpRequestsRouter);
apiRouter.use('/availability', availabilityRouter);

module.exports = {
  apiRouter,
};
