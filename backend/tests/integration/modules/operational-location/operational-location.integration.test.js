'use strict';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const { operationalLocationRouter } = require('../../../../src/modules/operational-location/routes');
const { query } = require('../../../../src/db/pool');

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/operational-location', operationalLocationRouter);
  return app;
}

function buildAuthToken(userId) {
  return jwt.sign(
    {
      userId,
      email: `${userId}@example.com`,
      isAdmin: false,
      adminRole: null,
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

async function seedProfileLocationAndPrivacy(userId) {
  const profileId = `prf_${userId}`;

  await query(
    `
      INSERT INTO user_profiles (profile_id, user_id, first_name, last_name, phone_number)
      VALUES ($1, $2, 'Profile', 'Location', '5301234567');
    `,
    [profileId, userId],
  );

  await query(
    `
      INSERT INTO location_profiles (
        location_profile_id,
        profile_id,
        address,
        city,
        country,
        latitude,
        longitude
      )
      VALUES ($1, $2, 'Residential address', 'Istanbul', 'Turkey', 40.99, 29.01);
    `,
    [`loc_${userId}`, profileId],
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
      VALUES ($1, $2, 'PUBLIC', 'PRIVATE', 'EMERGENCY_ONLY', TRUE);
    `,
    [`priv_${userId}`, profileId],
  );

  return profileId;
}

async function getProfileLocationRow(profileId) {
  const result = await query(
    `
      SELECT
        address,
        city,
        country,
        latitude,
        longitude
      FROM location_profiles
      WHERE profile_id = $1;
    `,
    [profileId],
  );

  return result.rows[0];
}

async function getProfileRow(profileId) {
  const result = await query(
    `
      SELECT
        first_name,
        last_name,
        phone_number
      FROM user_profiles
      WHERE profile_id = $1;
    `,
    [profileId],
  );

  return result.rows[0];
}

async function getPrivacyRow(profileId) {
  const result = await query(
    `
      SELECT
        profile_visibility,
        health_info_visibility,
        location_visibility,
        location_sharing_enabled
      FROM privacy_settings
      WHERE profile_id = $1;
    `,
    [profileId],
  );

  return result.rows[0];
}

beforeEach(async () => {
  await query(`
    TRUNCATE TABLE
      user_operational_locations,
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

describe('operational-location integration', () => {
  test('PATCH /api/operational-location/me stores the authenticated user operational location', async () => {
    const app = createTestApp();
    const userId = 'user_op_patch';
    await seedActiveUser(userId);

    const response = await request(app)
      .patch('/api/operational-location/me')
      .set('Authorization', `Bearer ${buildAuthToken(userId)}`)
      .send({
        latitude: 41.0123,
        longitude: 29.0456,
        accuracyMeters: 20,
        source: 'DEVICE_GPS',
        capturedAt: '2026-05-04T07:00:00Z',
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      userId,
      latitude: 41.0123,
      longitude: 29.0456,
      accuracyMeters: 20,
      source: 'DEVICE_GPS',
    });
    expect(response.body.capturedAt).toBeTruthy();
    expect(response.body.updatedAt).toBeTruthy();

    const stored = await query('SELECT user_id FROM user_operational_locations WHERE user_id = $1;', [userId]);
    expect(stored.rows).toHaveLength(1);
  });

  test('GET /api/operational-location/me returns the authenticated user latest operational location', async () => {
    const app = createTestApp();
    const userId = 'user_op_get';
    await seedActiveUser(userId);

    await request(app)
      .patch('/api/operational-location/me')
      .set('Authorization', `Bearer ${buildAuthToken(userId)}`)
      .send({
        latitude: 41.0123,
        longitude: 29.0456,
        accuracyMeters: null,
        source: null,
        capturedAt: null,
      })
      .expect(200);

    const response = await request(app)
      .get('/api/operational-location/me')
      .set('Authorization', `Bearer ${buildAuthToken(userId)}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      userId,
      latitude: 41.0123,
      longitude: 29.0456,
      accuracyMeters: null,
      source: null,
      capturedAt: null,
    });
    expect(response.body.updatedAt).toBeTruthy();
  });

  test('GET /api/operational-location/me returns 404 when no operational location exists', async () => {
    const app = createTestApp();
    const userId = 'user_op_missing';
    await seedActiveUser(userId);

    const response = await request(app)
      .get('/api/operational-location/me')
      .set('Authorization', `Bearer ${buildAuthToken(userId)}`);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });

  test('PATCH /api/operational-location/me updates the existing row instead of duplicating', async () => {
    const app = createTestApp();
    const userId = 'user_op_update';
    await seedActiveUser(userId);
    const token = buildAuthToken(userId);

    await request(app)
      .patch('/api/operational-location/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ latitude: 41.0123, longitude: 29.0456 })
      .expect(200);

    const response = await request(app)
      .patch('/api/operational-location/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        latitude: 40.99,
        longitude: 28.95,
        accuracyMeters: 5,
        source: 'NETWORK',
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      userId,
      latitude: 40.99,
      longitude: 28.95,
      accuracyMeters: 5,
      source: 'NETWORK',
    });

    const countResult = await query(
      'SELECT COUNT(*)::int AS count FROM user_operational_locations WHERE user_id = $1;',
      [userId],
    );
    expect(countResult.rows[0].count).toBe(1);
  });

  test('PATCH /api/operational-location/me rejects invalid latitude and longitude', async () => {
    const app = createTestApp();
    const userId = 'user_op_invalid_coordinates';
    await seedActiveUser(userId);
    const token = buildAuthToken(userId);

    const badLatitude = await request(app)
      .patch('/api/operational-location/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ latitude: -91, longitude: 29.0456 });

    expect(badLatitude.status).toBe(400);
    expect(badLatitude.body.code).toBe('VALIDATION_ERROR');

    const badLongitude = await request(app)
      .patch('/api/operational-location/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ latitude: 41.0123, longitude: 181 });

    expect(badLongitude.status).toBe(400);
    expect(badLongitude.body.code).toBe('VALIDATION_ERROR');
  });

  test('PATCH /api/operational-location/me rejects missing latitude or longitude', async () => {
    const app = createTestApp();
    const userId = 'user_op_missing_coordinates';
    await seedActiveUser(userId);
    const token = buildAuthToken(userId);

    const missingLatitude = await request(app)
      .patch('/api/operational-location/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ longitude: 29.0456 });

    expect(missingLatitude.status).toBe(400);
    expect(missingLatitude.body.code).toBe('VALIDATION_ERROR');

    const missingLongitude = await request(app)
      .patch('/api/operational-location/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ latitude: 41.0123 });

    expect(missingLongitude.status).toBe(400);
    expect(missingLongitude.body.code).toBe('VALIDATION_ERROR');
  });

  test('PATCH /api/operational-location/me rejects empty and null payloads', async () => {
    const app = createTestApp();
    const userId = 'user_op_empty_payload';
    await seedActiveUser(userId);
    const token = buildAuthToken(userId);

    const emptyResponse = await request(app)
      .patch('/api/operational-location/me')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(emptyResponse.status).toBe(400);
    expect(emptyResponse.body.code).toBe('VALIDATION_ERROR');

    const nullResponse = await request(app)
      .patch('/api/operational-location/me')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send('null');

    expect(nullResponse.status).toBe(400);
  });

  test('GET and PATCH /api/operational-location/me require authentication', async () => {
    const app = createTestApp();

    const getResponse = await request(app)
      .get('/api/operational-location/me');

    expect(getResponse.status).toBe(401);

    const patchResponse = await request(app)
      .patch('/api/operational-location/me')
      .send({ latitude: 41.0123, longitude: 29.0456 });

    expect(patchResponse.status).toBe(401);
  });

  test('PATCH /api/operational-location/me does not modify profile residential location', async () => {
    const app = createTestApp();
    const userId = 'user_op_profile_location';
    await seedActiveUser(userId);
    const profileId = await seedProfileLocationAndPrivacy(userId);
    const beforeProfile = await getProfileRow(profileId);
    const beforeLocation = await getProfileLocationRow(profileId);

    await request(app)
      .patch('/api/operational-location/me')
      .set('Authorization', `Bearer ${buildAuthToken(userId)}`)
      .send({
        latitude: 41.2,
        longitude: 29.2,
        accuracyMeters: 8,
        source: 'DEVICE_GPS',
      })
      .expect(200);

    const afterProfile = await getProfileRow(profileId);
    const afterLocation = await getProfileLocationRow(profileId);
    expect(afterProfile).toEqual(beforeProfile);
    expect(afterLocation).toEqual(beforeLocation);
  });

  test('PATCH /api/operational-location/me does not modify profile privacy settings', async () => {
    const app = createTestApp();
    const userId = 'user_op_privacy';
    await seedActiveUser(userId);
    const profileId = await seedProfileLocationAndPrivacy(userId);
    const beforePrivacy = await getPrivacyRow(profileId);

    await request(app)
      .patch('/api/operational-location/me')
      .set('Authorization', `Bearer ${buildAuthToken(userId)}`)
      .send({
        latitude: 41.2,
        longitude: 29.2,
        source: 'DEVICE_GPS',
      })
      .expect(200);

    const afterPrivacy = await getPrivacyRow(profileId);
    expect(afterPrivacy).toEqual(beforePrivacy);
  });

  test('user B cannot retrieve user A operational location through /me', async () => {
    const app = createTestApp();
    const userA = 'user_op_owner_a';
    const userB = 'user_op_owner_b';
    await seedActiveUser(userA);
    await seedActiveUser(userB);

    await request(app)
      .patch('/api/operational-location/me')
      .set('Authorization', `Bearer ${buildAuthToken(userA)}`)
      .send({
        latitude: 41.0123,
        longitude: 29.0456,
        source: 'DEVICE_GPS',
      })
      .expect(200);

    const response = await request(app)
      .get('/api/operational-location/me')
      .set('Authorization', `Bearer ${buildAuthToken(userB)}`);

    expect(response.status).toBe(404);
    expect(response.body.userId).not.toBe(userA);
  });
});
