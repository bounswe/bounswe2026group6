'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('express-rate-limit', () => () => (_req, _res, next) => next());
jest.mock('uuid', () => ({
  v4: () => require('crypto').randomBytes(16).toString('hex'),
}));
jest.mock('../../../../src/config/mailer', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

const { createApp } = require('../../../../src/app');
const { env } = require('../../../../src/config/env');
const { query } = require('../../../../src/db/pool');

const TRUNCATE_SQL = `
  TRUNCATE TABLE
    notification_deliveries,
    notification_devices,
    notification_type_preferences,
    notification_preferences,
    notifications,
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
`;

beforeEach(async () => {
  await query(TRUNCATE_SQL);
});

async function seedUser({ userId, email }) {
  await query(
    `
      INSERT INTO users (user_id, email, password_hash, is_email_verified, accepted_terms)
      VALUES ($1, $2, 'test-hash', TRUE, TRUE)
    `,
    [userId, email],
  );
}

async function seedAdmin({ userId = 'admin-user', adminId = 'admin-1', email = 'admin@example.com', role = 'COORDINATOR' } = {}) {
  await seedUser({ userId, email });
  await query(
    `
      INSERT INTO admins (admin_id, user_id, role)
      VALUES ($1, $2, $3)
    `,
    [adminId, userId, role],
  );
  // The production migration seeds demo announcements when the first admin is
  // created. These tests verify explicit API behavior, so keep each scenario's
  // announcement set isolated from migration-owned demo rows.
  await query("DELETE FROM news_announcements WHERE announcement_id LIKE 'seed_announcement_%'");

  return {
    adminId,
    userId,
    token: jwt.sign(
      {
        userId,
        email,
        isAdmin: true,
        adminRole: role,
      },
      env.jwt.secret,
      { expiresIn: '1h' },
    ),
  };
}

async function seedNonAdmin({ userId = 'regular-user', email = 'regular@example.com' } = {}) {
  await seedUser({ userId, email });

  return jwt.sign(
    {
      userId,
      email,
      isAdmin: false,
      adminRole: null,
    },
    env.jwt.secret,
    { expiresIn: '1h' },
  );
}

async function seedAnnouncement({
  id,
  adminId,
  title,
  content,
  createdAt,
}) {
  await query(
    `
      INSERT INTO news_announcements (announcement_id, admin_id, title, content, created_at)
      VALUES ($1, $2, $3, $4, $5::timestamp)
    `,
    [id, adminId, title, content, createdAt],
  );
}

describe('announcements API', () => {
  test('GET /api/announcements returns public announcements from the database', async () => {
    const app = createApp();
    const { adminId } = await seedAdmin();
    await seedAnnouncement({
      id: 'ann_old',
      adminId,
      title: 'Older update',
      content: 'Older preparedness update body.',
      createdAt: '2026-04-01T10:00:00Z',
    });
    await seedAnnouncement({
      id: 'ann_new',
      adminId,
      title: 'Newer update',
      content: 'New emergency announcement body.',
      createdAt: '2026-04-02T10:00:00Z',
    });

    const response = await request(app).get('/api/announcements');

    expect(response.status).toBe(200);
    expect(response.body.announcements).toHaveLength(2);
    expect(response.body.announcements[0]).toMatchObject({
      id: 'ann_new',
      adminId,
      title: 'Newer update',
      content: 'New emergency announcement body.',
    });
    expect(response.body.announcements[0].createdAt).toBeTruthy();
  });

  test('GET /api/announcements validates limit', async () => {
    const app = createApp();

    const response = await request(app).get('/api/announcements?limit=0');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_FAILED');
  });

  test('admin can create update and delete an announcement', async () => {
    const app = createApp();
    const { token, adminId } = await seedAdmin();

    const createResponse = await request(app)
      .post('/api/admin/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Shelter status update',
        content: 'Community shelter capacity has been updated for tonight.',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.announcement).toMatchObject({
      adminId,
      title: 'Shelter status update',
      content: 'Community shelter capacity has been updated for tonight.',
    });
    expect(createResponse.body.announcement.id).toMatch(/^ann_/);

    const announcementId = createResponse.body.announcement.id;

    const updateResponse = await request(app)
      .patch(`/api/admin/announcements/${announcementId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Updated shelter status',
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.announcement).toMatchObject({
      id: announcementId,
      title: 'Updated shelter status',
      content: 'Community shelter capacity has been updated for tonight.',
    });

    const deleteResponse = await request(app)
      .delete(`/api/admin/announcements/${announcementId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteResponse.status).toBe(204);

    const publicResponse = await request(app).get('/api/announcements');
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body.announcements).toEqual([]);
  });

  test('admin mutations reject unauthenticated and non-admin users', async () => {
    const app = createApp();
    const nonAdminToken = await seedNonAdmin();

    const unauthenticatedResponse = await request(app)
      .post('/api/admin/announcements')
      .send({ title: 'Blocked', content: 'No token.' });

    expect(unauthenticatedResponse.status).toBe(401);
    expect(unauthenticatedResponse.body.code).toBe('UNAUTHORIZED');

    const forbiddenResponse = await request(app)
      .post('/api/admin/announcements')
      .set('Authorization', `Bearer ${nonAdminToken}`)
      .send({ title: 'Blocked', content: 'Not an admin.' });

    expect(forbiddenResponse.status).toBe(403);
    expect(forbiddenResponse.body.code).toBe('FORBIDDEN');
  });

  test('admin mutations validate payload and return not found for missing announcements', async () => {
    const app = createApp();
    const { token } = await seedAdmin();

    const invalidCreate = await request(app)
      .post('/api/admin/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Missing content' });

    expect(invalidCreate.status).toBe(400);
    expect(invalidCreate.body.code).toBe('VALIDATION_FAILED');

    const missingPatch = await request(app)
      .patch('/api/admin/announcements/missing-announcement')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Updated body.' });

    expect(missingPatch.status).toBe(404);
    expect(missingPatch.body.code).toBe('NOT_FOUND');
  });
});
