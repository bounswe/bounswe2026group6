'use strict';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const { assignmentsRouter } = require('../../../../src/modules/assignments/routes');
const { query } = require('../../../../src/db/pool');

const originalFetch = global.fetch;

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/assignments', assignmentsRouter);
  return app;
}

function buildAuthToken({ userId, isAdmin = false }) {
  return jwt.sign(
    {
      userId,
      email: `${userId}@example.com`,
      isAdmin,
      adminRole: isAdmin ? 'COORDINATOR' : null,
    },
    process.env.JWT_SECRET || 'dev-secret-123',
    { expiresIn: '1h' },
  );
}

async function seedUser(userId, email = `${userId}@example.com`) {
  await query(
    `
      INSERT INTO users (
        user_id,
        email,
        password_hash,
        is_email_verified,
        is_deleted,
        accepted_terms,
        is_banned
      )
      VALUES ($1, $2, 'hash', TRUE, FALSE, TRUE, FALSE);
    `,
    [userId, email],
  );
}

async function seedAdmin(userId = 'admin_user') {
  await seedUser(userId, `${userId}@example.com`);
  await query(
    `
      INSERT INTO admins (admin_id, user_id, role)
      VALUES ($1, $2, 'COORDINATOR');
    `,
    [`adm_${userId}`, userId],
  );
}

async function seedVolunteer({
  volunteerId = 'vol_responder',
  userId = 'responder_user',
  latitude = 41,
  longitude = 29,
} = {}) {
  await seedUser(userId, `${userId}@example.com`);
  await query(
    `
      INSERT INTO volunteers (
        volunteer_id,
        user_id,
        is_available,
        last_known_latitude,
        last_known_longitude,
        location_updated_at
      )
      VALUES ($1, $2, TRUE, $3, $4, CURRENT_TIMESTAMP);
    `,
    [volunteerId, userId, latitude, longitude],
  );
}

async function seedHelpRequest({
  requestId = 'req_route',
  requesterId = 'requester_user',
  latitude = 41.1,
  longitude = 29.1,
} = {}) {
  await seedUser(requesterId, `${requesterId}@example.com`);
  await query(
    `
      INSERT INTO help_requests (
        request_id,
        user_id,
        help_types,
        affected_people_count,
        need_type,
        description,
        status,
        contact_full_name,
        contact_phone
      )
      VALUES ($1, $2, ARRAY['general'], 1, 'general', 'Need help', 'ASSIGNED', 'Requester', 5550000000);
    `,
    [requestId, requesterId],
  );

  if (latitude !== null && longitude !== null) {
    await query(
      `
        INSERT INTO request_locations (
          location_id,
          request_id,
          country,
          city,
          district,
          neighborhood,
          extra_address,
          latitude,
          longitude
        )
        VALUES ($1, $2, 'turkiye', 'istanbul', 'besiktas', 'levazim', '', $3, $4);
      `,
      [`loc_${requestId}`, requestId, latitude, longitude],
    );
  }
}

async function seedAssignment({
  assignmentId = 'asg_route',
  volunteerId = 'vol_responder',
  requestId = 'req_route',
} = {}) {
  await query(
    `
      INSERT INTO assignments (assignment_id, volunteer_id, request_id, assigned_at, is_cancelled)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, FALSE);
    `,
    [assignmentId, volunteerId, requestId],
  );
}

async function seedRouteScenario(options = {}) {
  await seedVolunteer(options.volunteer || {});
  await seedHelpRequest(options.request || {});
  await seedAssignment(options.assignment || {});
}

beforeEach(async () => {
  await query(`
    TRUNCATE TABLE
      assignments,
      availability_records,
      volunteers,
      request_locations,
      help_requests,
      admins,
      user_profiles,
      users
    RESTART IDENTITY CASCADE;
  `);
  delete process.env.ASSIGNMENT_ROUTING_URL;
  global.fetch = jest.fn();
});

afterEach(() => {
  delete process.env.ASSIGNMENT_ROUTING_URL;
  jest.restoreAllMocks();
  global.fetch = originalFetch;
});

describe('assignment route integration', () => {
  test('GET /api/assignments/:assignmentId/route returns fallback distance for assigned responder', async () => {
    const app = createTestApp();
    await seedRouteScenario();

    const response = await request(app)
      .get('/api/assignments/asg_route/route')
      .set('Authorization', `Bearer ${buildAuthToken({ userId: 'responder_user' })}`);

    expect(response.status).toBe(200);
    expect(response.body.source).toBe('fallback');
    expect(response.body.distance_km).toBeGreaterThan(0);
    expect(response.body.estimated_time_min).toEqual(expect.any(Number));
    expect(response.body.route).toBeNull();
  });

  test('GET /api/assignments/:assignmentId/route allows admin users', async () => {
    const app = createTestApp();
    await seedRouteScenario();
    await seedAdmin('admin_user');

    const response = await request(app)
      .get('/api/assignments/asg_route/route')
      .set('Authorization', `Bearer ${buildAuthToken({ userId: 'admin_user', isAdmin: true })}`);

    expect(response.status).toBe(200);
    expect(response.body.source).toBe('fallback');
    expect(response.body.distance_km).toBeGreaterThan(0);
  });

  test('GET /api/assignments/:assignmentId/route rejects other users', async () => {
    const app = createTestApp();
    await seedRouteScenario();
    await seedUser('other_user');

    const response = await request(app)
      .get('/api/assignments/asg_route/route')
      .set('Authorization', `Bearer ${buildAuthToken({ userId: 'other_user' })}`);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  test('GET /api/assignments/:assignmentId/route returns 404 when assignment is missing', async () => {
    const app = createTestApp();
    await seedUser('responder_user');

    const response = await request(app)
      .get('/api/assignments/missing_assignment/route')
      .set('Authorization', `Bearer ${buildAuthToken({ userId: 'responder_user' })}`);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('ASSIGNMENT_NOT_FOUND');
  });

  test('GET /api/assignments/:assignmentId/route returns location_unavailable when coordinates are missing', async () => {
    const app = createTestApp();
    await seedRouteScenario({
      volunteer: { latitude: null, longitude: null },
    });

    const response = await request(app)
      .get('/api/assignments/asg_route/route')
      .set('Authorization', `Bearer ${buildAuthToken({ userId: 'responder_user' })}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ error: 'location_unavailable' });
  });

  test('GET /api/assignments/:assignmentId/route uses routing provider when configured', async () => {
    const app = createTestApp();
    await seedRouteScenario();
    process.env.ASSIGNMENT_ROUTING_URL = 'https://router.example.test/route';
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        distance_km: 12.345,
        estimated_time_min: 18,
        route: [{ latitude: 41, longitude: 29 }],
      }),
    });

    const response = await request(app)
      .get('/api/assignments/asg_route/route')
      .set('Authorization', `Bearer ${buildAuthToken({ userId: 'responder_user' })}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      distance_km: 12.35,
      estimated_time_min: 18,
      route: [{ latitude: 41, longitude: 29 }],
      source: 'routing',
    });
  });

  test('GET /api/assignments/:assignmentId/route falls back when routing provider fails', async () => {
    const app = createTestApp();
    await seedRouteScenario();
    process.env.ASSIGNMENT_ROUTING_URL = 'https://router.example.test/route';
    global.fetch.mockRejectedValueOnce(new Error('provider failed'));

    const response = await request(app)
      .get('/api/assignments/asg_route/route')
      .set('Authorization', `Bearer ${buildAuthToken({ userId: 'responder_user' })}`);

    expect(response.status).toBe(200);
    expect(response.body.source).toBe('fallback');
    expect(response.body.distance_km).toBeGreaterThan(0);
    expect(response.body.route).toBeNull();
  });
});
