'use strict';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { query } = require('../../../../src/db/pool');
const { apiRouter } = require('../../../../src/routes');

jest.mock('uuid', () => ({
  v4: () => require('crypto').randomBytes(16).toString('hex'),
}));

jest.mock('express-rate-limit', () => () => (_req, _res, next) => next());

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  return app;
}

function buildAuthToken({ userId, isAdmin }) {
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

async function seedBaseUsers() {
  await query(
    `
      INSERT INTO users (user_id, email, password_hash, is_email_verified, is_deleted, accepted_terms)
      VALUES
        ('admin_user', 'admin@example.com', 'hash', TRUE, FALSE, TRUE),
        ('normal_user', 'user@example.com', 'hash', TRUE, FALSE, TRUE)
    `,
  );

  await query(
    `
      INSERT INTO admins (admin_id, user_id, role)
      VALUES ('admin_record_1', 'admin_user', 'COORDINATOR')
    `,
  );
}

async function seedHelpRequests() {
  await query(
    `
      INSERT INTO help_requests (
        request_id,
        user_id,
        help_types,
        other_help_text,
        affected_people_count,
        risk_flags,
        vulnerable_groups,
        need_type,
        description,
        blood_type,
        contact_full_name,
        contact_phone,
        consent_given,
        status,
        created_at,
        resolved_at,
        cancelled_at,
        is_saved_locally
      )
      VALUES
        (
          'req_pending_active',
          'normal_user',
          ARRAY['first_aid']::TEXT[],
          '',
          2,
          ARRAY['injury']::TEXT[],
          ARRAY[]::TEXT[],
          'first_aid',
          'Pending emergency',
          NULL,
          'A User',
          5551112233,
          TRUE,
          'PENDING',
          NOW() - INTERVAL '1 hour',
          NULL,
          NULL,
          FALSE
        ),
        (
          'req_resolved_new',
          'normal_user',
          ARRAY['water']::TEXT[],
          '',
          1,
          ARRAY[]::TEXT[],
          ARRAY[]::TEXT[],
          'water',
          'Resolved recently',
          NULL,
          'B User',
          5552223344,
          TRUE,
          'RESOLVED',
          NOW() - INTERVAL '2 days',
          NOW() - INTERVAL '1 hour',
          NULL,
          FALSE
        ),
        (
          'req_cancelled_mid',
          'normal_user',
          ARRAY['shelter']::TEXT[],
          '',
          4,
          ARRAY['injury']::TEXT[],
          ARRAY[]::TEXT[],
          'shelter',
          'Cancelled recently',
          NULL,
          'C User',
          5553334455,
          TRUE,
          'CANCELLED',
          NOW() - INTERVAL '3 days',
          NULL,
          NOW() - INTERVAL '2 hours',
          FALSE
        ),
        (
          'req_resolved_old',
          'normal_user',
          ARRAY['food']::TEXT[],
          '',
          6,
          ARRAY['fire', 'injury']::TEXT[],
          ARRAY[]::TEXT[],
          'food',
          'Resolved older',
          NULL,
          'D User',
          5554445566,
          TRUE,
          'RESOLVED',
          NOW() - INTERVAL '10 days',
          NOW() - INTERVAL '5 days',
          NULL,
          FALSE
        ),
        (
          'req_cancelled_unknown_city',
          'normal_user',
          ARRAY['food']::TEXT[],
          '',
          1,
          ARRAY[]::TEXT[],
          ARRAY[]::TEXT[],
          'food',
          'Cancelled unknown city',
          NULL,
          'E User',
          5555556677,
          TRUE,
          'CANCELLED',
          NOW() - INTERVAL '6 days',
          NULL,
          NOW() - INTERVAL '4 days',
          FALSE
        )
    `,
  );

  await query(
    `
      INSERT INTO request_locations (
        location_id,
        request_id,
        country,
        city,
        district,
        neighborhood,
        extra_address
      )
      VALUES
        ('loc_resolved_new', 'req_resolved_new', 'turkiye', ' ankara ', 'cankaya', 'kizilay', 'blok a'),
        ('loc_cancelled_mid', 'req_cancelled_mid', 'turkiye', 'izmir', 'konak', 'alsancak', 'blok b'),
        ('loc_resolved_old', 'req_resolved_old', 'turkiye', 'ankara', 'etimesgut', 'goksu', 'blok c'),
        ('loc_unknown_city', 'req_cancelled_unknown_city', 'turkiye', '', 'kecioren', 'etlik', 'blok d')
    `,
  );
}

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

describe('GET /api/admin/emergency-history', () => {
  test('returns 401 without token', async () => {
    const app = createTestApp();
    const response = await request(app).get('/api/admin/emergency-history');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  test('returns 403 for non-admin users', async () => {
    await seedBaseUsers();
    const app = createTestApp();
    const userToken = buildAuthToken({ userId: 'normal_user', isAdmin: false });

    const response = await request(app)
      .get('/api/admin/emergency-history')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

    test('uses consistent fallback for closedAt and openDurationMinutes on dirty closed rows', async () => {
      await seedBaseUsers();

      await query(
        `
          INSERT INTO help_requests (
            request_id,
            user_id,
            help_types,
            other_help_text,
            affected_people_count,
            risk_flags,
            vulnerable_groups,
            need_type,
            description,
            blood_type,
            contact_full_name,
            contact_phone,
            consent_given,
            status,
            created_at,
            resolved_at,
            cancelled_at,
            is_saved_locally
          )
          VALUES (
            'req_dirty_closed',
            'normal_user',
            ARRAY['first_aid']::TEXT[],
            '',
            1,
            ARRAY[]::TEXT[],
            ARRAY[]::TEXT[],
            'first_aid',
            'Dirty closed row',
            NULL,
            'Z User',
            5556667788,
            TRUE,
            'RESOLVED',
            NOW() - INTERVAL '8 hours',
            NULL,
            NULL,
            FALSE
          )
        `,
      );

      const app = createTestApp();
      const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

      const response = await request(app)
        .get('/api/admin/emergency-history?status=resolved&type=first_aid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.history).toHaveLength(1);
      expect(response.body.history[0]).toEqual(
        expect.objectContaining({
          requestId: 'req_dirty_closed',
          status: 'RESOLVED',
          closedState: 'RESOLVED',
          openDurationMinutes: 0,
        }),
      );

      const openedAt = new Date(response.body.history[0].openedAt).getTime();
      const closedAt = new Date(response.body.history[0].closedAt).getTime();
      expect(closedAt).toBe(openedAt);
    });

  test('returns only resolved/cancelled history sorted by closed time', async () => {
    await seedBaseUsers();
    await seedHelpRequests();

    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/admin/emergency-history')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(4);
    expect(response.body.history.map((item) => item.requestId)).toEqual([
      'req_resolved_new',
      'req_cancelled_mid',
      'req_cancelled_unknown_city',
      'req_resolved_old',
    ]);
    expect(response.body.history.map((item) => item.status)).toEqual([
      'RESOLVED',
      'CANCELLED',
      'CANCELLED',
      'RESOLVED',
    ]);
    expect(response.body.history[0]).toEqual(
      expect.objectContaining({
        requestId: 'req_resolved_new',
        closedState: 'RESOLVED',
        urgencyLevel: 'LOW',
        priorityLevel: 'LOW',
      }),
    );
    expect(response.body.history[0].openedAt).toEqual(expect.any(String));
    expect(response.body.history[0].openDurationMinutes).toEqual(expect.any(Number));

    expect(response.body.history[1]).toEqual(
      expect.objectContaining({
        requestId: 'req_cancelled_mid',
        closedState: 'CANCELLED',
        urgencyLevel: 'MEDIUM',
        priorityLevel: 'MEDIUM',
      }),
    );
    expect(response.body.history[1].openedAt).toEqual(expect.any(String));
    expect(response.body.history[1].openDurationMinutes).toEqual(expect.any(Number));

    expect(response.body.history[3]).toEqual(
      expect.objectContaining({
        requestId: 'req_resolved_old',
        closedState: 'RESOLVED',
        urgencyLevel: 'HIGH',
        priorityLevel: 'HIGH',
      }),
    );
    expect(response.body.history.some((item) => item.requestId === 'req_pending_active')).toBe(false);
  });

  test('applies status/city/type filters', async () => {
    await seedBaseUsers();
    await seedHelpRequests();

    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/admin/emergency-history?status=resolved&city=ankara&type=water')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.history).toHaveLength(1);
    expect(response.body.history[0]).toEqual(
      expect.objectContaining({
        requestId: 'req_resolved_new',
        status: 'RESOLVED',
        needType: 'water',
      }),
    );
    expect(response.body.filters).toEqual({
      status: ['RESOLVED'],
      city: ['ankara'],
      type: ['water'],
      urgency: [],
      limit: 50,
      offset: 0,
    });
  });

  test('returns 400 for invalid status filter', async () => {
    await seedBaseUsers();
    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/admin/emergency-history?status=pending')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 for invalid urgency filter', async () => {
    await seedBaseUsers();
    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/admin/emergency-history?urgency=critical')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  test('applies limit and returns newest closed records first', async () => {
    await seedBaseUsers();
    await seedHelpRequests();

    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/admin/emergency-history?limit=2')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(4);
    expect(response.body.history).toHaveLength(2);
    expect(response.body.history.map((item) => item.requestId)).toEqual([
      'req_resolved_new',
      'req_cancelled_mid',
    ]);
  });

  test('applies offset for pagination', async () => {
    await seedBaseUsers();
    await seedHelpRequests();

    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/admin/emergency-history?limit=1&offset=1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(4);
    expect(response.body.history).toHaveLength(1);
    expect(response.body.history[0].requestId).toBe('req_cancelled_mid');
    expect(response.body.filters).toEqual({
      status: [],
      city: [],
      type: [],
      urgency: [],
      limit: 1,
      offset: 1,
    });
  });

  test('keeps total stable when offset exceeds available rows', async () => {
    await seedBaseUsers();
    await seedHelpRequests();

    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/admin/emergency-history?limit=10&offset=999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(4);
    expect(response.body.history).toEqual([]);
  });

  test('filters by urgency and unknown city', async () => {
    await seedBaseUsers();
    await seedHelpRequests();

    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const urgencyResponse = await request(app)
      .get('/api/admin/emergency-history?urgency=high')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(urgencyResponse.status).toBe(200);
    expect(urgencyResponse.body.history).toHaveLength(1);
    expect(urgencyResponse.body.history[0].requestId).toBe('req_resolved_old');

    const unknownCityResponse = await request(app)
      .get('/api/admin/emergency-history?city=unknown')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(unknownCityResponse.status).toBe(200);
    expect(unknownCityResponse.body.history).toHaveLength(1);
    expect(unknownCityResponse.body.history[0].requestId).toBe('req_cancelled_unknown_city');
  });

  test('returns successful empty state when filters do not match any closed request', async () => {
    await seedBaseUsers();
    await seedHelpRequests();

    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/admin/emergency-history?city=trabzon&type=food')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(0);
    expect(response.body.history).toEqual([]);
  });

  test('supports legacy /api/auth/admin route for history endpoint', async () => {
    await seedBaseUsers();
    await seedHelpRequests();

    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/auth/admin/emergency-history?status=cancelled')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.history).toHaveLength(2);
    expect(response.body.history.every((item) => item.status === 'CANCELLED')).toBe(true);
  });
});
