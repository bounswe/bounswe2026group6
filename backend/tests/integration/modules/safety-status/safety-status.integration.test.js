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

  if (options.latitude !== undefined && options.longitude !== undefined) {
    await query(
      `
        INSERT INTO location_profiles (
          location_profile_id,
          profile_id,
          city,
          district,
          neighborhood,
          latitude,
          longitude
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7);
      `,
      [
        `loc_${userId}`,
        profileId,
        options.city || 'Istanbul',
        options.district || 'Besiktas',
        options.neighborhood || 'Levazim',
        options.latitude,
        options.longitude,
      ],
    );
  }
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
      safety_circle_invites,
      safety_circle_members,
      safety_circles,
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

  test('GET /api/safety-status/visible nearby filters visible users by profile neighborhood and privacy', async () => {
    const app = createTestApp();
    const viewerId = 'user_nearby_viewer';
    const nearId = 'user_nearby_public';
    const farId = 'user_nearby_far';
    const privateLocationId = 'user_nearby_private_location';
    await seedActiveUser(viewerId);
    await seedActiveUser(nearId);
    await seedActiveUser(farId);
    await seedActiveUser(privateLocationId);
    await seedProfile(viewerId, {
      profileVisibility: 'PRIVATE',
      locationVisibility: 'EMERGENCY_ONLY',
      locationSharingEnabled: true,
      neighborhood: 'Levazim',
      latitude: 41.043,
      longitude: 29.009,
    });
    await seedProfile(nearId, {
      firstName: 'Near',
      lastName: 'Visible',
      profileVisibility: 'PUBLIC',
      locationVisibility: 'EMERGENCY_ONLY',
      locationSharingEnabled: true,
      neighborhood: 'Levazim',
      latitude: 41.044,
      longitude: 29.01,
    });
    await seedProfile(farId, {
      firstName: 'Far',
      lastName: 'Visible',
      profileVisibility: 'PUBLIC',
      locationVisibility: 'EMERGENCY_ONLY',
      locationSharingEnabled: true,
      neighborhood: 'Moda',
      latitude: 40.19,
      longitude: 29.06,
    });
    await seedProfile(privateLocationId, {
      firstName: 'Private',
      lastName: 'Location',
      profileVisibility: 'PUBLIC',
      locationVisibility: 'PRIVATE',
      locationSharingEnabled: true,
      neighborhood: 'Levazim',
      latitude: 41.044,
      longitude: 29.01,
    });

    for (const userId of [viewerId, nearId, farId, privateLocationId]) {
      await request(app)
        .patch('/api/safety-status/me')
        .set('Authorization', `Bearer ${buildAuthToken(userId)}`)
        .send({ status: userId === nearId ? 'safe' : 'not_safe' })
        .expect(200);
    }

    const response = await request(app)
      .get('/api/safety-status/visible?nearby=true')
      .set('Authorization', `Bearer ${buildAuthToken(viewerId)}`);

    expect(response.status).toBe(200);
    const byUserId = Object.fromEntries(
      response.body.safetyStatuses.map((item) => [item.userId, item]),
    );
    expect(byUserId[nearId]).toMatchObject({
      displayName: 'Near Visible',
      status: 'safe',
    });
    expect(byUserId[nearId]).not.toHaveProperty('neighborhood');
    expect(byUserId[nearId]).not.toHaveProperty('district');
    expect(byUserId[nearId]).not.toHaveProperty('city');
    expect(byUserId[viewerId]).toBeUndefined();
    expect(byUserId[farId]).toBeUndefined();
    expect(byUserId[privateLocationId]).toMatchObject({
      displayName: 'Private Location',
      status: 'not_safe',
      location: null,
    });
  });

  test('GET /api/safety-status/visible nearby hides emergency-only location from non-circle viewers', async () => {
    const app = createTestApp();
    const viewerId = 'user_nearby_location_viewer';
    const emergencyLocationId = 'user_nearby_location_emergency';
    await seedActiveUser(viewerId);
    await seedActiveUser(emergencyLocationId);
    await seedProfile(viewerId, {
      profileVisibility: 'PRIVATE',
      locationVisibility: 'PRIVATE',
      locationSharingEnabled: false,
      neighborhood: 'Levazim',
      latitude: 41.043,
      longitude: 29.009,
    });
    await seedProfile(emergencyLocationId, {
      firstName: 'Emergency',
      lastName: 'Location',
      profileVisibility: 'PUBLIC',
      locationVisibility: 'EMERGENCY_ONLY',
      locationSharingEnabled: true,
      neighborhood: 'Levazim',
      latitude: 41.044,
      longitude: 29.01,
    });

    await request(app)
      .patch('/api/safety-status/me')
      .set('Authorization', `Bearer ${buildAuthToken(viewerId)}`)
      .send({ status: 'safe' })
      .expect(200);
    await request(app)
      .patch('/api/safety-status/me')
      .set('Authorization', `Bearer ${buildAuthToken(emergencyLocationId)}`)
      .send({
        status: 'not_safe',
        shareLocationConsent: true,
        location: { latitude: 41.04444, longitude: 29.01001 },
      })
      .expect(200);

    const nonCircleResponse = await request(app)
      .get('/api/safety-status/visible?nearby=true')
      .set('Authorization', `Bearer ${buildAuthToken(viewerId)}`);

    expect(nonCircleResponse.status).toBe(200);
    const nonCircleByUserId = Object.fromEntries(
      nonCircleResponse.body.safetyStatuses.map((item) => [item.userId, item]),
    );
    expect(nonCircleByUserId[emergencyLocationId]).toMatchObject({
      displayName: 'Emergency Location',
      status: 'not_safe',
      location: null,
    });

    await query(
      `
        INSERT INTO safety_circles (circle_id, owner_user_id, name)
        VALUES ('circle_nearby_location', $1, 'Nearby Location Circle');
      `,
      [viewerId],
    );
    await query(
      `
        INSERT INTO safety_circle_members (circle_id, user_id, role)
        VALUES
          ('circle_nearby_location', $1, 'owner'),
          ('circle_nearby_location', $2, 'member');
      `,
      [viewerId, emergencyLocationId],
    );

    const circleResponse = await request(app)
      .get('/api/safety-status/visible?nearby=true')
      .set('Authorization', `Bearer ${buildAuthToken(viewerId)}`);

    expect(circleResponse.status).toBe(200);
    const circleByUserId = Object.fromEntries(
      circleResponse.body.safetyStatuses.map((item) => [item.userId, item]),
    );
    expect(circleByUserId[emergencyLocationId].location).toMatchObject({
      latitude: 41.044,
      longitude: 29.01,
    });
  });

  test('GET /api/safety-status/visible nearby supports explicit current-location context', async () => {
    const app = createTestApp();
    const viewerId = 'user_current_location_viewer';
    const nearId = 'user_current_location_near';
    const farId = 'user_current_location_far';
    await seedActiveUser(viewerId);
    await seedActiveUser(nearId);
    await seedActiveUser(farId);
    await seedProfile(viewerId, {
      profileVisibility: 'PRIVATE',
      locationVisibility: 'PRIVATE',
      locationSharingEnabled: true,
      neighborhood: 'Moda',
      latitude: 40.988,
      longitude: 29.024,
    });
    await seedProfile(nearId, {
      firstName: 'Current',
      lastName: 'Nearby',
      profileVisibility: 'PUBLIC',
      locationVisibility: 'PUBLIC',
      locationSharingEnabled: true,
      neighborhood: 'Levazim',
      latitude: 41.044,
      longitude: 29.01,
    });
    await seedProfile(farId, {
      firstName: 'Current',
      lastName: 'Far',
      profileVisibility: 'PUBLIC',
      locationVisibility: 'PUBLIC',
      locationSharingEnabled: true,
      neighborhood: 'Bursa',
      latitude: 40.182,
      longitude: 29.066,
    });

    for (const userId of [viewerId, nearId, farId]) {
      await request(app)
        .patch('/api/safety-status/me')
        .set('Authorization', `Bearer ${buildAuthToken(userId)}`)
        .send({
          status: userId === farId ? 'safe' : 'not_safe',
          shareLocationConsent: true,
          location: { latitude: 41.044, longitude: 29.01 },
        })
        .expect(200);
    }

    const response = await request(app)
      .get('/api/safety-status/visible?nearby=true&context=current-location&latitude=41.043&longitude=29.009')
      .set('Authorization', `Bearer ${buildAuthToken(viewerId)}`);

    expect(response.status).toBe(200);
    const byUserId = Object.fromEntries(
      response.body.safetyStatuses.map((item) => [item.userId, item]),
    );
    expect(byUserId[nearId]).toMatchObject({
      displayName: 'Current Nearby',
      status: 'not_safe',
    });
    expect(byUserId[viewerId]).toBeUndefined();
    expect(byUserId[farId]).toBeUndefined();
  });

  test('GET /api/safety-status/visible current-location context validates coordinates', async () => {
    const app = createTestApp();
    const viewerId = 'user_current_location_invalid';
    await seedActiveUser(viewerId);

    const response = await request(app)
      .get('/api/safety-status/visible?nearby=true&context=current-location&latitude=bad&longitude=29.009')
      .set('Authorization', `Bearer ${buildAuthToken(viewerId)}`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_FAILED');
  });
});
