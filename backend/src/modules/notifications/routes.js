const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth, requireAdmin } = require('../auth/middleware');
const {
  createNotification,
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  registerDevice,
  unregisterDevice,
  getPreferences,
  patchPreferences,
  getTypePreferences,
  patchTypePreference,
  getUnreadCount,
  getAdminStats,
  postEmergencyBroadcast,
} = require('./controller');

const notificationsRouter = express.Router();
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many notification write requests, please try again soon.',
  },
});

notificationsRouter.use(requireAuth);

notificationsRouter.post('/', writeLimiter, requireAdmin, createNotification);
notificationsRouter.get('/', getMyNotifications);
notificationsRouter.patch('/read-all', writeLimiter, markAllAsRead);
notificationsRouter.patch('/:notificationId/read', writeLimiter, markAsRead);
notificationsRouter.post('/devices/register', writeLimiter, registerDevice);
notificationsRouter.post('/devices/unregister', writeLimiter, unregisterDevice);
notificationsRouter.get('/preferences', getPreferences);
notificationsRouter.patch('/preferences', writeLimiter, patchPreferences);
notificationsRouter.get('/preferences/types', getTypePreferences);
notificationsRouter.patch('/preferences/types', writeLimiter, patchTypePreference);
notificationsRouter.get('/unread-count', getUnreadCount);
notificationsRouter.get('/admin/stats', requireAdmin, getAdminStats);
notificationsRouter.post('/admin/broadcast/emergency', writeLimiter, requireAdmin, postEmergencyBroadcast);

module.exports = {
  notificationsRouter,
};
