const express = require('express');

const { authRouter } = require('../modules/auth/routes');
const { adminRouter } = require('../modules/admin/routes');
const { profilesRouter } = require('../modules/profiles/routes');
const { helpRequestsRouter } = require('../modules/help-requests/routes');
const { availabilityRouter } = require('../modules/availability/routes');
const { assignmentsRouter } = require('../modules/assignments/routes');
const { locationRouter } = require('../modules/location/routes');
const { gatheringAreasRouter } = require('../modules/gathering-areas/routes');
const { notificationsRouter } = require('../modules/notifications/routes');
const { announcementsRouter } = require('../modules/announcements/routes');
const { safetyStatusRouter } = require('../modules/safety-status/routes');

const apiRouter = express.Router();

apiRouter.get('/', (_request, response) => {
  response.status(200).json({
    service: 'api',
    status: 'ok',
    name: 'Neighborhood Emergency Preparedness Hub API',
    modules: ['auth', 'admin', 'profiles', 'help-requests', 'availability', 'assignments', 'location', 'gathering-areas', 'notifications', 'announcements', 'safety-status'],
  });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/profiles', profilesRouter);
apiRouter.use('/help-requests', helpRequestsRouter);
apiRouter.use('/availability', availabilityRouter);
apiRouter.use('/assignments', assignmentsRouter);
apiRouter.use('/location', locationRouter);
apiRouter.use('/gathering-areas', gatheringAreasRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/announcements', announcementsRouter);
apiRouter.use('/safety-status', safetyStatusRouter);

module.exports = {
  apiRouter,
};
