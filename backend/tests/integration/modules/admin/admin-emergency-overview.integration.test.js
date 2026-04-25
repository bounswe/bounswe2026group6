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
          'req_pending',
          'normal_user',
          ARRAY['first_aid']::TEXT[],
          '',
          6,
          ARRAY['fire', 'injury']::TEXT[],
          ARRAY[]::TEXT[],
          'first_aid',
          'Pending emergency',
          NULL,
          'Ayse Yilmaz',
          5551112233,
          TRUE,
          'PENDING',
          NOW() - INTERVAL '1 hour',
          NULL,
          NULL,
          FALSE
        ),
        (
          'req_in_progress',
          'normal_user',
          ARRAY['food']::TEXT[],
          '',
          3,
          ARRAY['injury']::TEXT[],
          ARRAY[]::TEXT[],
          'food',
          'In progress emergency',
          NULL,
          'Fatma Kaya',
          5552223344,
          TRUE,
          'IN_PROGRESS',
          NOW() - INTERVAL '2 days',
          NULL,
          NULL,
          FALSE
        ),
        (
          'req_resolved',
          'normal_user',
          ARRAY['water']::TEXT[],
          '',
          1,
          ARRAY[]::TEXT[],
          ARRAY[]::TEXT[],
          'water',
          'Resolved emergency',
          NULL,
          'Mehmet Demir',
          5553334455,
          TRUE,
          'RESOLVED',
          NOW() - INTERVAL '3 days',
          NOW() - INTERVAL '2 hours',
          NULL,
          FALSE
        ),
        (
          'req_cancelled',
          'normal_user',
          ARRAY['shelter']::TEXT[],
          '',
          1,
          ARRAY[]::TEXT[],
          ARRAY[]::TEXT[],
          'shelter',
          'Cancelled emergency',
          NULL,
          'Can Aydin',
          5554445566,
          TRUE,
          'CANCELLED',
          NOW() - INTERVAL '10 days',
          NULL,
          NOW() - INTERVAL '2 hours',
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
        ('loc_pending', 'req_pending', 'turkiye', 'ankara', 'cankaya', 'kizilay', 'blok a'),
        ('loc_in_progress', 'req_in_progress', 'turkiye', 'istanbul', 'besiktas', 'levazim', 'blok b'),
        ('loc_resolved', 'req_resolved', 'turkiye', 'ankara', 'etimesgut', 'goksu', 'blok c')
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

describe('GET /api/admin/emergency-overview', () => {
  test('returns 401 without token', async () => {
    const app = createTestApp();

    const response = await request(app).get('/api/admin/emergency-overview');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  test('returns 403 for non-admin users', async () => {
    await seedBaseUsers();
    const app = createTestApp();
    const userToken = buildAuthToken({ userId: 'normal_user', isAdmin: false });

    const response = await request(app)
      .get('/api/admin/emergency-overview')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  test('returns overview without regionSummary by default', async () => {
    await seedBaseUsers();
    await seedHelpRequests();

    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/admin/emergency-overview')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.overview).toBeTruthy();
    expect(response.body.overview.totals).toEqual({
      totalEmergencies: 4,
      activeEmergencies: 2,
      resolvedEmergencies: 1,
      closedEmergencies: 2,
    });
    expect(response.body.overview.statusBreakdown).toEqual({
      pending: 1,
      inProgress: 1,
      resolved: 1,
      cancelled: 1,
    });
    expect(response.body.overview.urgencyBreakdown).toEqual({
      low: 2,
      medium: 1,
      high: 1,
    });
    expect(response.body.overview.recentActivity.createdLast24Hours).toBe(1);
    expect(response.body.overview.recentActivity.createdLast7Days).toBe(3);
    expect(response.body.overview.recentActivity.resolvedLast24Hours).toBe(1);
    expect(response.body.overview.recentActivity.resolvedLast7Days).toBe(1);
    expect(response.body.overview.recentActivity.cancelledLast24Hours).toBe(1);
    expect(response.body.overview.recentActivity.cancelledLast7Days).toBe(1);
    expect(response.body.overview.activeOperational).toHaveLength(2);
    expect(response.body.overview.activeOperational[0]).toEqual(
      expect.objectContaining({
        requestId: 'req_pending',
        status: 'PENDING',
        urgencyLevel: 'HIGH',
        priorityLevel: 'HIGH',
        closedAt: null,
        closedState: null,
        location: {
          city: 'ankara',
          district: 'cankaya',
        },
      }),
    );
    expect(response.body.overview.activeOperational[0].openedAt).toEqual(expect.any(String));
    expect(response.body.overview.activeOperational[0].openDurationMinutes).toEqual(expect.any(Number));
    expect(response.body.overview.activeOperational[1]).toEqual(
      expect.objectContaining({
        requestId: 'req_in_progress',
        status: 'IN_PROGRESS',
        urgencyLevel: 'MEDIUM',
        priorityLevel: 'MEDIUM',
        closedAt: null,
        closedState: null,
        location: {
          city: 'istanbul',
          district: 'besiktas',
        },
      }),
    );
    expect(response.body.overview.activeOperational[1].openedAt).toEqual(expect.any(String));
    expect(response.body.overview.activeOperational[1].openDurationMinutes).toEqual(expect.any(Number));
    expect(response.body.overview.regionSummary).toBeUndefined();
  });

  test('returns regionSummary when includeRegionSummary=true', async () => {
    await seedBaseUsers();
    await seedHelpRequests();

    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/admin/emergency-overview?includeRegionSummary=true')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.overview.regionSummary).toEqual([
      {
        city: 'ankara',
        total: 2,
        active: 1,
        pending: 1,
        inProgress: 0,
        resolved: 1,
        cancelled: 0,
      },
      {
        city: 'istanbul',
        total: 1,
        active: 1,
        pending: 0,
        inProgress: 1,
        resolved: 0,
        cancelled: 0,
      },
      {
        city: 'unknown',
        total: 1,
        active: 0,
        pending: 0,
        inProgress: 0,
        resolved: 0,
        cancelled: 1,
      },
    ]);
  });

  test('keeps backward-compatible legacy route under /api/auth/admin', async () => {
    await seedBaseUsers();
    await seedHelpRequests();

    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/auth/admin/emergency-overview?includeRegionSummary=true')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.overview).toBeTruthy();
    expect(response.body.overview.regionSummary).toEqual(expect.any(Array));
  });
});
