const express = require('express');
const rateLimit = require('express-rate-limit');
const { env } = require('../../config/env');
const { adminRouter } = require('../admin/routes');

function shouldSkipAuthRateLimit() {
  return env.nodeEnv === 'test' && process.env.ENABLE_RATE_LIMIT_IN_TEST !== 'true';
}

function buildLoginRateLimitKey(request) {
  const normalizedIp = typeof rateLimit.ipKeyGenerator === 'function'
    ? rateLimit.ipKeyGenerator(request.ip)
    : request.ip;
  const email = typeof request.body?.email === 'string'
    ? request.body.email.trim().toLowerCase()
    : '';
  const safeEmail = email || 'unknown-email';

  return `${normalizedIp}|${safeEmail}`;
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 requests
  skip: shouldSkipAuthRateLimit,
  message: {
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many requests, please try again later',
  },
});

const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // max 5 failed attempts per email+ip per minute
  skipSuccessfulRequests: true,
  keyGenerator: buildLoginRateLimitKey,
  skip: shouldSkipAuthRateLimit,
  message: {
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many login attempts, please try again in a minute',
  },
});

const {
  getAuthInfo,
  signup,
  login,
  verifyEmail,
  getMe,
  resendVerification,
  forgotPassword,
  resetPasswordHandler,
  logout,
  deleteMe,
} = require('./controller');
const { requireAuth } = require('./middleware');

const authRouter = express.Router();

authRouter.get('/', getAuthInfo);
authRouter.post('/signup', authLimiter, signup);
authRouter.post('/login', loginLimiter, login);
authRouter.get('/verify-email', verifyEmail);
authRouter.post('/resend-verification', authLimiter, resendVerification);
authRouter.post('/forgot-password', authLimiter, forgotPassword);
authRouter.post('/reset-password', authLimiter, resetPasswordHandler);
authRouter.post('/logout', requireAuth, logout);
authRouter.get('/me', requireAuth, getMe);
authRouter.delete('/me', requireAuth, deleteMe);

// Backward-compatibility alias for legacy admin paths under /api/auth/admin/*
authRouter.use('/admin', adminRouter);

module.exports = {
  authRouter,
  buildLoginRateLimitKey,
  loginLimiter,
};
