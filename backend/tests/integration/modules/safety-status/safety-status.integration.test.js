'use strict';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const { safetyStatusRouter } = require('../../../../src/modules/safety-status/routes');
const { query } = require('../../../../src/db/pool');

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/safety-status', safetyStatusRouter);
  return app;
}

function buildAuthToken(userId, overrides = {}) {
  return jwt.sign(
    {
      userId,
      email: `${userId}@example.com`,
      isAdmin: false,
      adminRole: null,
      ...overrides,
    },
    process.env.JWT_SECRET || 'dev-secret-123',
    { expiresIn: '1h' },
  );
}

async function seedActiveUser(userId, email = `${userId}@example.com`) {
  await query(
    `
      INSERT INTO users (
        user_id,
        email,
        password_hash,
        is_email_verified,
        is_deleted,
        accepted_terms
      )
      VALUES ($1, $2, 'hash', TRUE, FALSE, TRUE);
    `,
    [userId, email],
  );
}

async function seedProfile(userId, options = {}) {
  const profileId = `prf_${userId}`;
  await query(
    `
      INSERT INTO user_profiles (profile_id, user_id, first_name, last_name, phone_number)
      VALUES ($1, $2, $3, $4, '5301234567');
    `,
    [profileId, userId, options.firstName || 'Safety', options.lastName || 'User'],
  );

  await query(
    `
      INSERT INTO privacy_settings (
        settings_id,
        profile_id,
        profile_visibility,
        health_info_visibility,
        location_visibility,
        location_sharing_enabled
      )
      VALUES ($1, $2, $3, 'PRIVATE', $4, $5);
    `,
    [
      `priv_${userId}`,
      profileId,
      options.profileVisibility || 'PRIVATE',
      options.locationVisibility || 'PRIVATE',
      Boolean(options.locationSharingEnabled),
    ],
  );
}

beforeEach(async () => {
  await query(`
    TRUNCATE TABLE
      user_safety_statuses,
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

describe('safety-status integration', () => {
  test('GET /api/safety-status/me requires authentication', async () => {
    const app = createTestApp();

    const response = await request(app)
      .get('/api/safety-status/me');

    expect(response.status).toBe(401);
  });

  test('GET /api/safety-status/me returns unknown when no status exists yet', async () => {
    const app = createTestApp();
    const userId = 'user_safety_empty';
    await seedActiveUser(userId);

    const response = await request(app)
      .get('/api/safety-status/me')
      .set('Authorization', `Bearer ${buildAuthToken(userId)}`);

    expect(response.status).toBe(200);
    expect(response.body.safetyStatus).toEqual({
      userId,
      status: 'unknown',
      note: null,
      shareLocationConsent: false,
      location: null,
      updatedAt: null,
    });
  });

  test('PATCH /api/safety-status/me updates only the authenticated user status', async () => {
    const app = createTestApp();
    const userId = 'user_safety_owner';
    const otherUserId = 'user_safety_other';
    await seedActiveUser(userId);
    await seedActiveUser(otherUserId);

    const response = await request(app)
      .patch('/api/safety-status/me')
      .set('Authorization', `Bearer ${buildAuthToken(userId)}`)
      .send({
        status: 'safe',
        note: 'With family',
        shareLocationConsent: true,
        location: {
          latitude: 41.043,
          longitude: 29.009,
          accuracyMeters: 15,
          source: 'GPS',
          capturedAt: '2026-05-02T12:00:00.000Z',
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.safetyStatus).toMatchObject({
      userId,
      status: 'safe',
      note: 'With family',
      shareLocationConsent: true,
    });
    expect(response.body.safetyStatus.location.latitude).toBeCloseTo(41.043, 6);

    const rows = await query('SELECT user_id, status FROM user_safety_statuses ORDER BY user_id ASC;');
    expect(rows.rows).toEqual([{ user_id: userId, status: 'safe' }]);
  });

  test('PATCH /api/safety-status/me rejects invalid status values', async () => {
    const app = createTestApp();
    const userId = 'user_safety_invalid';
    await seedActiveUser(userId);

    const response = await request(app)
      .patch('/api/safety-status/me')
      .set('Authorization', `Bearer ${buildAuthToken(userId)}`)
      .send({ status: 'lost' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(response.body.details).toContain('`status` must be one of: safe, not_safe, unknown.');
  });

  test('GET /api/safety-status/visible exposes only self, admin, and public profile statuses', async () => {
    const app = createTestApp();
    const viewerId = 'user_safety_viewer';
    const adminId = 'user_safety_admin';
    const publicId = 'user_safety_public';
    const emergencyOnlyId = 'user_safety_emergency_only';
    const privateId = 'user_safety_private';
    await seedActiveUser(viewerId);
    await seedActiveUser(adminId);
    await seedActiveUser(publicId);
    await seedActiveUser(emergencyOnlyId);
    await seedActiveUser(privateId);
    await seedProfile(publicId, {
      firstName: 'Public',
      lastName: 'Person',
      profileVisibility: 'PUBLIC',
      locationVisibility: 'PUBLIC',
      locationSharingEnabled: true,
    });
    await seedProfile(emergencyOnlyId, {
      firstName: 'Trusted',
      lastName: 'Circle',
      profileVisibility: 'EMERGENCY_ONLY',
      locationVisibility: 'PUBLIC',
      locationSharingEnabled: true,
    });
    await seedProfile(privateId, {
      firstName: 'Private',
      lastName: 'Person',
      profileVisibility: 'PRIVATE',
      locationVisibility: 'PUBLIC',
      locationSharingEnabled: true,
    });

    await request(app)
      .patch('/api/safety-status/me')
      .set('Authorization', `Bearer ${buildAuthToken(viewerId)}`)
      .send({ status: 'safe' })
      .expect(200);
    await request(app)
      .patch('/api/safety-status/me')
      .set('Authorization', `Bearer ${buildAuthToken(publicId)}`)
      .send({
        status: 'not_safe',
        shareLocationConsent: true,
        location: { latitude: 41.04321, longitude: 29.00987 },
      })
      .expect(200);
    await request(app)
      .patch('/api/safety-status/me')
      .set('Authorization', `Bearer ${buildAuthToken(emergencyOnlyId)}`)
      .send({
        status: 'not_safe',
        shareLocationConsent: true,
        location: { latitude: 41.05321, longitude: 29.01987 },
      })
      .expect(200);
    await request(app)
      .patch('/api/safety-status/me')
      .set('Authorization', `Bearer ${buildAuthToken(privateId)}`)
      .send({ status: 'not_safe' })
      .expect(200);

    const response = await request(app)
      .get('/api/safety-status/visible')
      .set('Authorization', `Bearer ${buildAuthToken(viewerId)}`);

    expect(response.status).toBe(200);
    const byUserId = Object.fromEntries(
      response.body.safetyStatuses.map((item) => [item.userId, item]),
    );
    expect(byUserId[viewerId]).toBeTruthy();
    expect(byUserId[publicId]).toMatchObject({
      displayName: 'Public Person',
      status: 'not_safe',
    });
    expect(byUserId[publicId].location).toMatchObject({
      latitude: 41.043,
      longitude: 29.01,
    });
    expect(byUserId[emergencyOnlyId]).toBeUndefined();
    expect(byUserId[privateId]).toBeUndefined();

    const adminResponse = await request(app)
      .get('/api/safety-status/visible')
      .set('Authorization', `Bearer ${buildAuthToken(adminId, { isAdmin: true, adminRole: 'OPS' })}`);

    expect(adminResponse.status).toBe(200);
    const adminByUserId = Object.fromEntries(
      adminResponse.body.safetyStatuses.map((item) => [item.userId, item]),
    );
    expect(adminByUserId[publicId]).toBeTruthy();
    expect(adminByUserId[emergencyOnlyId]).toMatchObject({
      displayName: 'Trusted Circle',
      status: 'not_safe',
    });
    expect(adminByUserId[privateId]).toBeTruthy();
  });
});
