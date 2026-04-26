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
          'req_a1', 'normal_user', ARRAY['first_aid']::TEXT[], '', 6,
          ARRAY['fire', 'injury']::TEXT[], ARRAY[]::TEXT[],
          'first_aid', 'Pending in ankara', NULL, 'A One', 5551112233, TRUE,
          'PENDING', NOW() - INTERVAL '2 hours', NULL, NULL, FALSE
        ),
        (
          'req_a2', 'normal_user', ARRAY['first_aid']::TEXT[], '', 3,
          ARRAY['injury']::TEXT[], ARRAY[]::TEXT[],
          'first_aid', 'In progress in ankara', NULL, 'A Two', 5552223344, TRUE,
          'IN_PROGRESS', NOW() - INTERVAL '2 days', NULL, NULL, FALSE
        ),
        (
          'req_a3', 'normal_user', ARRAY['water']::TEXT[], '', 1,
          ARRAY[]::TEXT[], ARRAY[]::TEXT[],
          'water', 'Resolved in istanbul today', NULL, 'A Three', 5553334455, TRUE,
          'RESOLVED', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 hours', NULL, FALSE
        ),
        (
          'req_a4', 'normal_user', ARRAY['shelter']::TEXT[], '', 1,
          ARRAY[]::TEXT[], ARRAY[]::TEXT[],
          'shelter', 'Cancelled in istanbul today', NULL, 'A Four', 5554445566, TRUE,
          'CANCELLED', NOW() - INTERVAL '10 days', NULL, NOW() - INTERVAL '3 hours', FALSE
        ),
        (
          'req_a5', 'normal_user', ARRAY['food']::TEXT[], '', 2,
          ARRAY[]::TEXT[], ARRAY[]::TEXT[],
          'food', 'Old created previous window', NULL, 'A Five', 5555556677, TRUE,
          'PENDING', NOW() - INTERVAL '10 days', NULL, NULL, FALSE
        )
    `,
  );

  await query(
    `
      INSERT INTO request_locations (
        location_id, request_id, country, city, district, neighborhood, extra_address
      )
      VALUES
        ('loc_a1', 'req_a1', 'turkiye', 'ankara', 'cankaya', 'kizilay', ''),
        ('loc_a2', 'req_a2', 'turkiye', 'ankara', 'etimesgut', 'goksu', ''),
        ('loc_a3', 'req_a3', 'turkiye', 'istanbul', 'besiktas', 'levazim', ''),
        ('loc_a4', 'req_a4', 'turkiye', 'istanbul', 'kadikoy', 'fenerbahce', ''),
        ('loc_a5', 'req_a5', 'turkiye', 'izmir', 'konak', 'alsancak', '')
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

describe('GET /api/admin/emergency-analytics', () => {
  test('returns 401 without token', async () => {
    const app = createTestApp();
    const response = await request(app).get('/api/admin/emergency-analytics');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  test('returns 403 for non-admin users', async () => {
    await seedBaseUsers();
    const app = createTestApp();
    const userToken = buildAuthToken({ userId: 'normal_user', isAdmin: false });

    const response = await request(app)
      .get('/api/admin/emergency-analytics')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  test('returns aggregated analytics for admin users', async () => {
    await seedBaseUsers();
    await seedHelpRequests();

    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/admin/emergency-analytics')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.analytics).toBeTruthy();

    const { regionBreakdown, typeBreakdown, dailyTrend, periodComparison } =
      response.body.analytics;

    // Region breakdown: ankara has 2, istanbul has 2, izmir has 1
    expect(regionBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ city: 'ankara', total: 2, active: 2 }),
        expect.objectContaining({ city: 'istanbul', total: 2, resolved: 1, cancelled: 1 }),
        expect.objectContaining({ city: 'izmir', total: 1, active: 1 }),
      ]),
    );
    expect(regionBreakdown[0].total).toBeGreaterThanOrEqual(regionBreakdown[1].total);

    // Type breakdown
    const firstAid = typeBreakdown.find((row) => row.needType === 'first_aid');
    expect(firstAid).toEqual(
      expect.objectContaining({ total: 2, active: 2, resolved: 0, cancelled: 0 }),
    );
    const totalSum = typeBreakdown.reduce((sum, row) => sum + row.total, 0);
    expect(totalSum).toBe(5);
    typeBreakdown.forEach((row) => {
      expect(typeof row.percentage).toBe('number');
    });

    // Daily trend default 14 days, sorted ascending
    expect(dailyTrend).toHaveLength(14);
    const dates = dailyTrend.map((row) => row.date);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
    dailyTrend.forEach((row) => {
      expect(typeof row.created).toBe('number');
      expect(typeof row.resolved).toBe('number');
      expect(typeof row.cancelled).toBe('number');
    });
    const totalCreated = dailyTrend.reduce((sum, row) => sum + row.created, 0);
    expect(totalCreated).toBeGreaterThanOrEqual(4);

    // Period comparison: default windowDays = 7
    expect(periodComparison.windowDays).toBe(7);
    // current created (last 7d): req_a1, req_a2, req_a3 = 3
    expect(periodComparison.created.current).toBe(3);
    // previous created (7d-14d): req_a4, req_a5 = 2
    expect(periodComparison.created.previous).toBe(2);
    expect(periodComparison.created.delta).toBe(1);
    expect(periodComparison.resolved.current).toBe(1);
    expect(periodComparison.cancelled.current).toBe(1);
  });

  test('respects regionLimit query param', async () => {
    await seedBaseUsers();
    await seedHelpRequests();

    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/admin/emergency-analytics?regionLimit=2')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.analytics.regionBreakdown).toHaveLength(2);
  });

  test('respects trendDays query param', async () => {
    await seedBaseUsers();
    await seedHelpRequests();

    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/admin/emergency-analytics?trendDays=7')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.analytics.dailyTrend).toHaveLength(7);
  });

  test('returns 400 for invalid trendDays', async () => {
    await seedBaseUsers();
    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/admin/emergency-analytics?trendDays=999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 for invalid regionLimit', async () => {
    await seedBaseUsers();
    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/admin/emergency-analytics?regionLimit=0')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 for invalid comparisonWindowDays', async () => {
    await seedBaseUsers();
    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/admin/emergency-analytics?comparisonWindowDays=100')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  test('returns empty arrays and zero comparisons when there is no data', async () => {
    await seedBaseUsers();

    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/admin/emergency-analytics')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.analytics.regionBreakdown).toEqual([]);
    expect(response.body.analytics.typeBreakdown).toEqual([]);
    expect(response.body.analytics.dailyTrend).toHaveLength(14);
    response.body.analytics.dailyTrend.forEach((row) => {
      expect(row.created).toBe(0);
      expect(row.resolved).toBe(0);
      expect(row.cancelled).toBe(0);
    });
    expect(response.body.analytics.periodComparison.created).toEqual({
      current: 0,
      previous: 0,
      delta: 0,
      percentChange: 0,
    });
  });
});
