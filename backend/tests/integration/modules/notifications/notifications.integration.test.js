'use strict';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const { notificationsRouter } = require('../../../../src/modules/notifications/routes');
const { query } = require('../../../../src/db/pool');

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/notifications', notificationsRouter);
  return app;
}

function buildAuthToken(userId, { isAdmin = false } = {}) {
  return jwt.sign(
    {
      userId,
      email: `${userId}@example.com`,
      isAdmin,
      adminRole: isAdmin ? 'SUPER_ADMIN' : null,
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

beforeEach(async () => {
  await query(`
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
  `);
}, 15000);

describe('notifications integration', () => {
  test('device register and unregister endpoints work', async () => {
    const app = createTestApp();
    await seedActiveUser('user_notif_dev_1');
    const token = buildAuthToken('user_notif_dev_1');

    const registerResponse = await request(app)
      .post('/api/notifications/devices/register')
      .set('Authorization', `Bearer ${token}`)
      .send({
        platform: 'ANDROID',
        provider: 'FCM',
        deviceToken: 'fcm_device_token_123',
      });

    expect(registerResponse.status).toBe(200);
    expect(registerResponse.body.device).toMatchObject({
      userId: 'user_notif_dev_1',
      platform: 'ANDROID',
      provider: 'FCM',
      deviceToken: 'fcm_device_token_123',
      isActive: true,
    });

    const unregisterResponse = await request(app)
      .post('/api/notifications/devices/unregister')
      .set('Authorization', `Bearer ${token}`)
      .send({
        provider: 'FCM',
        deviceToken: 'fcm_device_token_123',
      });

    expect(unregisterResponse.status).toBe(200);
    expect(unregisterResponse.body.device).toMatchObject({
      isActive: false,
    });
  });

  test('preferences endpoints work for authenticated user', async () => {
    const app = createTestApp();
    await seedActiveUser('user_notif_pref_1');
    const token = buildAuthToken('user_notif_pref_1');

    const getInitial = await request(app)
      .get('/api/notifications/preferences')
      .set('Authorization', `Bearer ${token}`);

    expect(getInitial.status).toBe(200);
    expect(getInitial.body.preferences).toMatchObject({
      userId: 'user_notif_pref_1',
      pushEnabled: true,
    });

    const update = await request(app)
      .patch('/api/notifications/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ pushEnabled: false });

    expect(update.status).toBe(200);
    expect(update.body.preferences).toMatchObject({
      userId: 'user_notif_pref_1',
      pushEnabled: false,
    });
  });

  test('type preferences and unread-count endpoints work', async () => {
    const app = createTestApp();
    await seedActiveUser('user_notif_type_1');
    const token = buildAuthToken('user_notif_type_1');

    await request(app)
      .post('/api/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'SYSTEM',
        title: 't1',
        body: 'b1',
        data: {},
      });

    const unread = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`);

    expect(unread.status).toBe(200);
    expect(unread.body.unreadCount).toBeGreaterThanOrEqual(1);

    const listTypes = await request(app)
      .get('/api/notifications/preferences/types')
      .set('Authorization', `Bearer ${token}`);

    expect(listTypes.status).toBe(200);
    expect(Array.isArray(listTypes.body.preferences)).toBe(true);
    expect(listTypes.body.preferences.find((item) => item.notificationType === 'SYSTEM')).toBeTruthy();

    const updateType = await request(app)
      .patch('/api/notifications/preferences/types')
      .set('Authorization', `Bearer ${token}`)
      .send({
        notificationType: 'SYSTEM',
        pushEnabled: false,
      });

    expect(updateType.status).toBe(200);
    expect(updateType.body.preference).toMatchObject({
      notificationType: 'SYSTEM',
      pushEnabled: false,
    });
  });

  test('admin stats endpoint requires admin and returns aggregates', async () => {
    const app = createTestApp();
    await seedActiveUser('user_notif_admin_1');
    await seedActiveUser('user_notif_admin_2');
    const userToken = buildAuthToken('user_notif_admin_1', { isAdmin: false });
    const adminToken = buildAuthToken('user_notif_admin_2', { isAdmin: true });

    const forbidden = await request(app)
      .get('/api/notifications/admin/stats')
      .set('Authorization', `Bearer ${userToken}`);

    expect(forbidden.status).toBe(403);

    await request(app)
      .post('/api/notifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'SYSTEM',
        title: 'Admin alert',
        body: 'Body',
        data: {},
      });

    const adminResult = await request(app)
      .get('/api/notifications/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(adminResult.status).toBe(200);
    expect(Array.isArray(adminResult.body.totals)).toBe(true);
    expect(typeof adminResult.body.unreadCount).toBe('number');
  });

  test('POST creates notification and GET lists it with mobile payload shape', async () => {
    const app = createTestApp();
    await seedActiveUser('user_notif_1');
    const token = buildAuthToken('user_notif_1');

    const createResponse = await request(app)
      .post('/api/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'HELP_REQUEST_STATUS_CHANGED',
        title: 'Request updated',
        body: 'Your request is matched with a volunteer.',
        entity: {
          type: 'HELP_REQUEST',
          id: 'req_123',
        },
        data: {
          screen: 'request-details',
          requestId: 'req_123',
        },
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.notification).toMatchObject({
      type: 'HELP_REQUEST_STATUS_CHANGED',
      title: 'Request updated',
      body: 'Your request is matched with a volunteer.',
      isRead: false,
      readAt: null,
      entity: {
        type: 'HELP_REQUEST',
        id: 'req_123',
      },
      data: {
        screen: 'request-details',
        requestId: 'req_123',
      },
    });

    const listResponse = await request(app)
      .get('/api/notifications?limit=10')
      .set('Authorization', `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.unreadCount).toBe(1);
    expect(listResponse.body.items).toHaveLength(1);
    expect(listResponse.body.items[0]).toMatchObject({
      id: createResponse.body.notification.id,
      type: 'HELP_REQUEST_STATUS_CHANGED',
      isRead: false,
      readAt: null,
      entity: { type: 'HELP_REQUEST', id: 'req_123' },
      data: { screen: 'request-details', requestId: 'req_123' },
    });
  });

  test('PATCH /:id/read marks notification as read idempotently', async () => {
    const app = createTestApp();
    await seedActiveUser('user_notif_2');
    const token = buildAuthToken('user_notif_2');

    const createResponse = await request(app)
      .post('/api/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'SYSTEM',
        title: 'Welcome',
        body: 'Welcome to notifications.',
        data: {},
      });

    const notificationId = createResponse.body.notification.id;

    const firstPatch = await request(app)
      .patch(`/api/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${token}`);

    expect(firstPatch.status).toBe(200);
    expect(firstPatch.body.notification.isRead).toBe(true);
    expect(firstPatch.body.notification.readAt).toBeTruthy();

    const secondPatch = await request(app)
      .patch(`/api/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${token}`);

    expect(secondPatch.status).toBe(200);
    expect(secondPatch.body.notification.isRead).toBe(true);
    expect(secondPatch.body.notification.readAt).toBeTruthy();
  });

  test('PATCH /read-all marks all unread notifications and returns unread count', async () => {
    const app = createTestApp();
    await seedActiveUser('user_notif_3');
    const token = buildAuthToken('user_notif_3');

    await request(app)
      .post('/api/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'SYSTEM',
        title: 'A',
        body: 'A',
        data: {},
      });

    await request(app)
      .post('/api/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'SYSTEM',
        title: 'B',
        body: 'B',
        data: {},
      });

    const readAllResponse = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${token}`);

    expect(readAllResponse.status).toBe(200);
    expect(readAllResponse.body.updatedCount).toBe(2);
    expect(readAllResponse.body.unreadCount).toBe(0);
  });

  test('GET only returns current user notifications', async () => {
    const app = createTestApp();
    await seedActiveUser('user_notif_4');
    await seedActiveUser('user_notif_5');
    const tokenA = buildAuthToken('user_notif_4');
    const tokenB = buildAuthToken('user_notif_5');

    await request(app)
      .post('/api/notifications')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        type: 'SYSTEM',
        title: 'A1',
        body: 'A1',
        data: {},
      });

    await request(app)
      .post('/api/notifications')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        type: 'SYSTEM',
        title: 'B1',
        body: 'B1',
        data: {},
      });

    const listA = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${tokenA}`);

    const listB = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(listA.status).toBe(200);
    expect(listA.body.items).toHaveLength(1);
    expect(listA.body.items[0].title).toBe('A1');

    expect(listB.status).toBe(200);
    expect(listB.body.items).toHaveLength(1);
    expect(listB.body.items[0].title).toBe('B1');
  });
});
