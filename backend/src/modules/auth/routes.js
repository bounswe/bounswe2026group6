const express = require('express');
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 requests
  message: {
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many requests, please try again later',
  },
});

const {
  getAuthInfo,
  signup,
  login,
  verifyEmail,
  getMe,
  getAdminUsers,
  getAdminHelpRequests,
  getAdminAnnouncements,
  getAdminStats,
  resendVerification,
} = require('./controller');
const { requireAuth, requireAdmin } = require('./middleware');

const authRouter = express.Router();

authRouter.get('/', getAuthInfo);

authRouter.post('/signup', authLimiter, signup);
authRouter.post('/login', authLimiter, login);
authRouter.get('/verify-email', verifyEmail);
authRouter.post('/resend-verification', authLimiter, resendVerification);

authRouter.get('/me', requireAuth, getMe);

authRouter.get('/admin/users', requireAuth, requireAdmin, getAdminUsers);
authRouter.get('/admin/help-requests', requireAuth, requireAdmin, getAdminHelpRequests);
authRouter.get('/admin/announcements', requireAuth, requireAdmin, getAdminAnnouncements);
authRouter.get('/admin/stats', requireAuth, requireAdmin, getAdminStats);

module.exports = {
  authRouter,
};