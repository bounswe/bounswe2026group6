'use strict';

const express = require('express');
const request = require('supertest');

function loadAuthRouteExportsWithLimiterEnabled() {
  jest.resetModules();
  process.env.ENABLE_RATE_LIMIT_IN_TEST = 'true';
  jest.doMock('../../../../src/modules/auth/controller', () => ({
    getAuthInfo: (_req, res) => res.status(200).json({ ok: true }),
    signup: (_req, res) => res.status(200).json({ ok: true }),
    login: (_req, res) => res.status(200).json({ ok: true }),
    verifyEmail: (_req, res) => res.status(200).json({ ok: true }),
    getMe: (_req, res) => res.status(200).json({ ok: true }),
    resendVerification: (_req, res) => res.status(200).json({ ok: true }),
    forgotPassword: (_req, res) => res.status(200).json({ ok: true }),
    resetPasswordHandler: (_req, res) => res.status(200).json({ ok: true }),
    logout: (_req, res) => res.status(200).json({ ok: true }),
    deleteMe: (_req, res) => res.status(200).json({ ok: true }),
    googleLogin: (_req, res) => res.status(200).json({ ok: true }),
  }));
  jest.doMock('../../../../src/modules/admin/routes', () => {
    const mockExpress = require('express');
    return { adminRouter: mockExpress.Router() };
  });
  jest.doMock('../../../../src/modules/auth/middleware', () => ({
    requireAuth: (_req, _res, next) => next(),
  }));
  // eslint-disable-next-line global-require
  return require('../../../../src/modules/auth/routes');
}

describe('auth login rate limiter', () => {
  afterEach(() => {
    delete process.env.ENABLE_RATE_LIMIT_IN_TEST;
  });

  test('uses ip+email key for login limiter', () => {
    const { buildLoginRateLimitKey } = loadAuthRouteExportsWithLimiterEnabled();

    const key = buildLoginRateLimitKey({
      ip: '127.0.0.1',
      body: { email: '  Test@Example.com ' },
    });

    expect(key).toContain('|test@example.com');
  });

  test('blocks repeated failed attempts per email but does not block different email', async () => {
    const { loginLimiter } = loadAuthRouteExportsWithLimiterEnabled();

    const app = express();
    app.use(express.json());
    app.post('/login', loginLimiter, (_req, res) => {
      res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    });

    for (let i = 0; i < 5; i += 1) {
      const response = await request(app)
        .post('/login')
        .send({ email: 'locked@example.com', password: 'wrong-pass' });
      expect(response.status).toBe(401);
    }

    const blockedResponse = await request(app)
      .post('/login')
      .send({ email: 'locked@example.com', password: 'wrong-pass' });
    expect(blockedResponse.status).toBe(429);
    expect(blockedResponse.body.code).toBe('TOO_MANY_REQUESTS');

    const otherEmailResponse = await request(app)
      .post('/login')
      .send({ email: 'other@example.com', password: 'wrong-pass' });
    expect(otherEmailResponse.status).toBe(401);
  });
});
