'use strict';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const { availabilityRouter } = require('../../../../src/modules/availability/routes');
const { query } = require('../../../../src/db/pool');

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/availability', availabilityRouter);
  return app;
}

function buildAuthToken(userId) {
  return jwt.sign(
    {
      userId,
      email: 'user@example.com',
      isAdmin: false,
      adminRole: null,
    },
    process.env.JWT_SECRET || 'dev-secret-123',
    { expiresIn: '1h' },
  );
}

async function seedActiveUser(userId, email = 'user@example.com') {
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

async function seedHelpRequest(requestId, userId, needType = 'general') {
  await query(
    `
      INSERT INTO help_requests (request_id, user_id, need_type, description, status, contact_full_name, contact_phone)
      VALUES ($1, $2, $3, 'Need help', 'PENDING', 'Test Person', 5550000000);
    `,
    [requestId, userId, needType],
  );
}

beforeEach(async () => {
  await query(`
    TRUNCATE TABLE
      assignments,
      availability_records,
      volunteers,
      help_requests,
      users
    RESTART IDENTITY CASCADE;
  `);
});

describe('Availability integration', () => {
  test('POST /api/availability/toggle returns 401 without token', async () => {
    const app = createTestApp();
    const response = await request(app)
      .post('/api/availability/toggle')
      .send({ isAvailable: true });
    expect(response.status).toBe(401);
  });

  test('POST /api/availability/toggle sets availability and creates volunteer', async () => {
    const app = createTestApp();
    const userId = 'user_av_1';
    await seedActiveUser(userId, 'av1@example.com');
    const token = buildAuthToken(userId);

    const response = await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${token}`)
      .send({ isAvailable: true, latitude: 41.0, longitude: 29.0 });

    expect(response.status).toBe(200);
    expect(response.body.volunteer.is_available).toBe(true);
    expect(response.body.volunteer.user_id).toBe(userId);

    const vResult = await query('SELECT * FROM volunteers WHERE user_id = $1', [userId]);
    expect(vResult.rows).toHaveLength(1);
    expect(vResult.rows[0].is_available).toBe(true);
  });

  test('POST /api/availability/toggle matches a request if available', async () => {
    const app = createTestApp();
    const volunteerUserId = 'user_v_1';
    const requesterUserId = 'user_r_1';
    await seedActiveUser(volunteerUserId, 'v1@example.com');
    await seedActiveUser(requesterUserId, 'r1@example.com');
    await seedHelpRequest('req_1', requesterUserId);
    const token = buildAuthToken(volunteerUserId);

    const response = await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${token}`)
      .send({ isAvailable: true });

    expect(response.status).toBe(200);
    expect(response.body.assignment).toBeTruthy();
    expect(response.body.assignment.request_id).toBe('req_1');

    const rResult = await query('SELECT status FROM help_requests WHERE request_id = $1', ['req_1']);
    expect(rResult.rows[0].status).toBe('ASSIGNED');
  });

  test('POST /api/availability/sync stores multiple records', async () => {
    const app = createTestApp();
    const userId = 'user_av_2';
    await seedActiveUser(userId, 'av2@example.com');
    const token = buildAuthToken(userId);

    const response = await request(app)
      .post('/api/availability/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({
        records: [
          { isAvailable: true, timestamp: new Date(Date.now() - 10000).toISOString() },
          { isAvailable: false, timestamp: new Date().toISOString() },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.volunteer.is_available).toBe(false);

    const arResult = await query('SELECT * FROM availability_records');
    expect(arResult.rows).toHaveLength(2);
  });

  test('GET /api/availability/my-assignment returns current assignment', async () => {
    const app = createTestApp();
    const volunteerUserId = 'user_v_2';
    const requesterUserId = 'user_r_2';
    await seedActiveUser(volunteerUserId, 'v2@example.com');
    await seedActiveUser(requesterUserId, 'r2@example.com');
    await seedHelpRequest('req_2', requesterUserId);
    const token = buildAuthToken(volunteerUserId);

    // First toggle to get assigned
    await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${token}`)
      .send({ isAvailable: true });

    const response = await request(app)
      .get('/api/availability/my-assignment')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.assignment).toBeTruthy();
    expect(response.body.assignment.request_id).toBe('req_2');
  });

  test('POST /api/availability/assignments/:id/cancel cancels assignment', async () => {
    const app = createTestApp();
    const volunteerUserId = 'user_v_3';
    const requesterUserId = 'user_r_3';
    await seedActiveUser(volunteerUserId, 'v3@example.com');
    await seedActiveUser(requesterUserId, 'r3@example.com');
    await seedHelpRequest('req_3', requesterUserId);
    const token = buildAuthToken(volunteerUserId);

    const toggleRes = await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${token}`)
      .send({ isAvailable: true });

    const assignmentId = toggleRes.body.assignment.assignment_id;

    const response = await request(app)
      .post(`/api/availability/assignments/${assignmentId}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('Assignment cancelled');
    
    const aResult = await query('SELECT * FROM assignments WHERE assignment_id = $1', [assignmentId]);
    expect(aResult.rows).toHaveLength(0);

    // It might be re-assigned immediately if it's the only request
    const rResult = await query('SELECT status FROM help_requests WHERE request_id = $1', ['req_3']);
    expect(['PENDING', 'ASSIGNED']).toContain(rResult.rows[0].status);
  });

  test('POST /api/availability/assignments/resolve resolves request', async () => {
    const app = createTestApp();
    const volunteerUserId = 'user_v_4';
    const requesterUserId = 'user_r_4';
    await seedActiveUser(volunteerUserId, 'v4@example.com');
    await seedActiveUser(requesterUserId, 'r4@example.com');
    await seedHelpRequest('req_4', requesterUserId);
    const token = buildAuthToken(volunteerUserId);

    await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${token}`)
      .send({ isAvailable: true });

    const response = await request(app)
      .post('/api/availability/assignments/resolve')
      .set('Authorization', `Bearer ${token}`)
      .send({ requestId: 'req_4' });

    expect(response.status).toBe(200);

    const rResult = await query('SELECT status FROM help_requests WHERE request_id = $1', ['req_4']);
    expect(rResult.rows[0].status).toBe('RESOLVED');
  });

  test('GET /api/availability/status returns current availability and assignment', async () => {
    const app = createTestApp();
    const volunteerUserId = 'user_v_5';
    const requesterUserId = 'user_r_5';
    await seedActiveUser(volunteerUserId, 'v5@example.com');
    await seedActiveUser(requesterUserId, 'r5@example.com');
    await seedHelpRequest('req_5', requesterUserId);
    const token = buildAuthToken(volunteerUserId);

    // Initial status should be not available
    let response = await request(app)
      .get('/api/availability/status')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.isAvailable).toBe(false);
    expect(response.body.volunteer).toBeNull();

    // Toggle to available
    await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${token}`)
      .send({ isAvailable: true });

    // Status should now be available and have an assignment
    response = await request(app)
      .get('/api/availability/status')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.isAvailable).toBe(true);
    expect(response.body.volunteer).toBeTruthy();
    expect(response.body.volunteer.user_id).toBe(volunteerUserId);
    expect(response.body.assignment).toBeTruthy();
    expect(response.body.assignment.request_id).toBe('req_5');
  });

  test('POST /api/availability/toggle to false cancels active assignment', async () => {
    const app = createTestApp();
    const volunteerUserId = 'user_v_6';
    const requesterUserId = 'user_r_6';
    await seedActiveUser(volunteerUserId, 'v6@example.com');
    await seedActiveUser(requesterUserId, 'r6@example.com');
    await seedHelpRequest('req_6', requesterUserId);
    const token = buildAuthToken(volunteerUserId);

    // 1. Become available first to get assigned
    await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${token}`)
      .send({ isAvailable: true });

    // Verify assignment exists
    const beforeResult = await query('SELECT * FROM assignments WHERE request_id = $1', ['req_6']);
    expect(beforeResult.rows).toHaveLength(1);

    // 2. Set to unavailable
    const response = await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${token}`)
      .send({ isAvailable: false });

    expect(response.status).toBe(200);
    expect(response.body.volunteer.is_available).toBe(false);
    expect(response.body.assignment).toBeNull();

    // 3. Verify assignment is deleted and request is PENDING again
    const afterResult = await query('SELECT * FROM assignments WHERE request_id = $1', ['req_6']);
    expect(afterResult.rows).toHaveLength(0);

    const rResult = await query('SELECT status FROM help_requests WHERE request_id = $1', ['req_6']);
    expect(rResult.rows[0].status).toBe('PENDING');
  });

  test('POST /api/availability/sync to false cancels active assignment', async () => {
    const app = createTestApp();
    const volunteerUserId = 'user_v_7';
    const requesterUserId = 'user_r_7';
    await seedActiveUser(volunteerUserId, 'v7@example.com');
    await seedActiveUser(requesterUserId, 'r7@example.com');
    await seedHelpRequest('req_7', requesterUserId);
    const token = buildAuthToken(volunteerUserId);

    // 1. Become available
    await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${token}`)
      .send({ isAvailable: true });

    // 2. Sync to unavailable
    const response = await request(app)
      .post('/api/availability/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({
        records: [
          { isAvailable: false, timestamp: new Date().toISOString() },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.volunteer.is_available).toBe(false);
    expect(response.body.assignment).toBeNull();

    // 3. Verify
    const afterResult = await query('SELECT * FROM assignments WHERE request_id = $1', ['req_7']);
    expect(afterResult.rows).toHaveLength(0);

    const rResult = await query('SELECT status FROM help_requests WHERE request_id = $1', ['req_7']);
    expect(rResult.rows[0].status).toBe('PENDING');
  });
});
