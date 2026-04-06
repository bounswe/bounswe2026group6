// tests/integration/modules/auth/auth.integration.test.js
'use strict';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { query } = require('../../../../src/db/pool');

// ─── Mock uuid (ESM uyumsuzluğu) ─────────────────────────────────────────────
jest.mock('uuid', () => ({
  v4: () => require('crypto').randomBytes(16).toString('hex'),
}));

// ─── Mock mailer ──────────────────────────────────────────────────────────────
jest.mock('../../../../src/config/mailer', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

// ─── Mock rate limiter (test sırasında 429 almamak için) ─────────────────────
jest.mock('express-rate-limit', () => () => (_req, _res, next) => next());

const { authRouter } = require('../../../../src/modules/auth/routes');

// ─── App factory ─────────────────────────────────────────────────────────────
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

// ─── Test verisi ──────────────────────────────────────────────────────────────
const validUser = {
  email: 'integtest@test.com',
  password: '12345678',
  acceptedTerms: true,
};

// ─── DB temizliği ─────────────────────────────────────────────────────────────
beforeEach(async () => {
  await query(`
    TRUNCATE TABLE
      messages,
      assignments,
      availability_records,
      resources,
      volunteers,
      request_locations,
      help_requests,
      news_announcements,
      reports,
      expertise,
      privacy_settings,
      location_profiles,
      health_info,
      physical_info,
      user_profiles,
      admins,
      users
    RESTART IDENTITY CASCADE;
  `);
});

// ─── POST /api/auth/signup ────────────────────────────────────────────────────

describe('POST /api/auth/signup', () => {
  test('201 - creates user successfully', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/auth/signup').send(validUser);
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(validUser.email);
  });

  test('400 - missing email', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/auth/signup').send({
      password: '12345678',
      acceptedTerms: true,
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('400 - invalid email format', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/auth/signup').send({
      email: 'notanemail',
      password: '12345678',
      acceptedTerms: true,
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('400 - password too short', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/auth/signup').send({
      email: 'integtest@test.com',
      password: '123',
      acceptedTerms: true,
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('400 - acceptedTerms false', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/auth/signup').send({
      email: 'integtest@test.com',
      password: '12345678',
      acceptedTerms: false,
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('409 - email already exists', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);
    const res = await request(app).post('/api/auth/signup').send(validUser);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_ALREADY_EXISTS');
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  test('401 - email not verified', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);

    const res = await request(app).post('/api/auth/login').send({
      email: validUser.email,
      password: validUser.password,
    });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  test('401 - wrong password', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);
    await query(`UPDATE users SET is_email_verified = TRUE WHERE email = $1`, [validUser.email]);

    const res = await request(app).post('/api/auth/login').send({
      email: validUser.email,
      password: 'wrongpassword',
    });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  test('401 - user not found', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/auth/login').send({
      email: 'nonexistent@test.com',
      password: '12345678',
    });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  test('200 - login successful', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);
    await query(`UPDATE users SET is_email_verified = TRUE WHERE email = $1`, [validUser.email]);

    const res = await request(app).post('/api/auth/login').send({
      email: validUser.email,
      password: validUser.password,
    });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  test('401 - no token', async () => {
    const app = createTestApp();
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('200 - returns current user', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);
    await query(`UPDATE users SET is_email_verified = TRUE WHERE email = $1`, [validUser.email]);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: validUser.email,
      password: validUser.password,
    });
    const token = loginRes.body.accessToken;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(validUser.email);
  });
});

// ─── GET /api/auth/verify-email ──────────────────────────────────────────────

describe('GET /api/auth/verify-email', () => {
  test('400 - missing token', async () => {
    const app = createTestApp();
    const res = await request(app).get('/api/auth/verify-email');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('400 - invalid token', async () => {
    const app = createTestApp();
    const res = await request(app)
      .get('/api/auth/verify-email')
      .query({ token: 'invalidtoken' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_VERIFICATION_TOKEN');
  });

  test('200 - email verified successfully', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);

    const userRow = await query(`SELECT user_id FROM users WHERE email = $1`, [validUser.email]);
    const userId = userRow.rows[0].user_id;

    const token = jwt.sign(
      { type: 'email-verification', userId, email: validUser.email },
      process.env.JWT_SECRET || 'dev-secret-123',
      { expiresIn: '1d' }
    );

    const res = await request(app)
      .get('/api/auth/verify-email')
      .query({ token });
    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
  });
});

// ─── POST /api/auth/resend-verification ──────────────────────────────────────

describe('POST /api/auth/resend-verification', () => {
  test('400 - missing email', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/auth/resend-verification').send({});
    expect(res.status).toBe(400);
  });

  test('400 - user not found', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/auth/resend-verification')
      .send({ email: 'nonexistent@test.com' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('USER_NOT_FOUND');
  });

  test('400 - already verified', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);
    await query(`UPDATE users SET is_email_verified = TRUE WHERE email = $1`, [validUser.email]);

    const res = await request(app)
      .post('/api/auth/resend-verification')
      .send({ email: validUser.email });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EMAIL_ALREADY_VERIFIED');
  });

  test('200 - resend successful', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);

    const res = await request(app)
      .post('/api/auth/resend-verification')
      .send({ email: validUser.email });
    expect(res.status).toBe(200);
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  test('401 - no token', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });

  test('200 - logout successful', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);
    await query(`UPDATE users SET is_email_verified = TRUE WHERE email = $1`, [validUser.email]);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: validUser.email,
      password: validUser.password,
    });
    const token = loginRes.body.accessToken;

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
  });
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
  test('400 - missing email', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });

  test('404 - user not found', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nonexistent@test.com' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('USER_NOT_FOUND');
  });

  test('200 - reset email sent', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: validUser.email });
    expect(res.status).toBe(200);
  });
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────

describe('POST /api/auth/reset-password', () => {
  test('400 - missing token', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ newPassword: '12345678' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('400 - invalid token', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'invalidtoken', newPassword: '12345678' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_RESET_TOKEN');
  });

  test('400 - password too short', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'sometoken', newPassword: '123' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('200 - password reset successful', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);

    const userRow = await query(`SELECT user_id FROM users WHERE email = $1`, [validUser.email]);
    const userId = userRow.rows[0].user_id;

    const token = jwt.sign(
      { type: 'password-reset', userId, email: validUser.email },
      process.env.JWT_SECRET || 'dev-secret-123',
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'newpassword123' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
  });
});