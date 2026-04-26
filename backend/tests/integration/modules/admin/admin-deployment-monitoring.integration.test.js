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
        ('normal_user', 'user@example.com', 'hash', TRUE, FALSE, TRUE),
        ('vol_user_1', 'vol1@example.com', 'hash', TRUE, FALSE, TRUE),
        ('vol_user_2', 'vol2@example.com', 'hash', TRUE, FALSE, TRUE),
        ('vol_user_3', 'vol3@example.com', 'hash', TRUE, FALSE, TRUE)
    `,
  );

  await query(
    `
      INSERT INTO admins (admin_id, user_id, role)
      VALUES ('admin_record_1', 'admin_user', 'COORDINATOR')
    `,
  );

  await query(
    `
      INSERT INTO volunteers (volunteer_id, user_id, is_available)
      VALUES
        ('vol_overloaded', 'vol_user_1', TRUE),
        ('vol_normal', 'vol_user_2', TRUE),
        ('vol_neglect2', 'vol_user_3', TRUE)
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
        -- Unassigned + long-waiting (PENDING, 8h old, no assignment)
        (
          'req_unassigned_old', 'normal_user', ARRAY['first_aid']::TEXT[], '', 1,
          ARRAY[]::TEXT[], ARRAY[]::TEXT[],
          'first_aid', 'Old pending unassigned', NULL, 'A', 5551112233, TRUE,
          'PENDING', NOW() - INTERVAL '8 hours', NULL, NULL, FALSE
        ),
        -- Unassigned + recent (PENDING, 30m old, no assignment) -> only in unassigned
        (
          'req_unassigned_new', 'normal_user', ARRAY['water']::TEXT[], '', 1,
          ARRAY[]::TEXT[], ARRAY[]::TEXT[],
          'water', 'Fresh pending unassigned', NULL, 'B', 5551112234, TRUE,
          'PENDING', NOW() - INTERVAL '30 minutes', NULL, NULL, FALSE
        ),
        -- Pending but already cancelled-assigned -> still unassigned (active a not present)
        (
          'req_pending_with_cancelled_assignment', 'normal_user', ARRAY['shelter']::TEXT[], '', 1,
          ARRAY[]::TEXT[], ARRAY[]::TEXT[],
          'shelter', 'Reassigned pending', NULL, 'C', 5551112235, TRUE,
          'PENDING', NOW() - INTERVAL '7 hours', NULL, NULL, FALSE
        ),
        -- In-progress, recently assigned (1h ago) -> only in inProgress
        (
          'req_inprogress_fresh', 'normal_user', ARRAY['food']::TEXT[], '', 1,
          ARRAY[]::TEXT[], ARRAY[]::TEXT[],
          'food', 'Fresh in-progress', NULL, 'D', 5551112236, TRUE,
          'IN_PROGRESS', NOW() - INTERVAL '3 hours', NULL, NULL, FALSE
        ),
        -- Assigned long ago (24h) -> in inProgress + neglected
        (
          'req_neglected_one', 'normal_user', ARRAY['first_aid']::TEXT[], '', 1,
          ARRAY[]::TEXT[], ARRAY[]::TEXT[],
          'first_aid', 'Neglected assignment one', NULL, 'E', 5551112237, TRUE,
          'ASSIGNED', NOW() - INTERVAL '2 days', NULL, NULL, FALSE
        ),
        -- Active assignment for a different volunteer, also stale -> neglected
        (
          'req_neglected_two', 'normal_user', ARRAY['water']::TEXT[], '', 1,
          ARRAY[]::TEXT[], ARRAY[]::TEXT[],
          'water', 'Neglected assignment two', NULL, 'F', 5551112238, TRUE,
          'IN_PROGRESS', NOW() - INTERVAL '2 days', NULL, NULL, FALSE
        ),
        -- Duplicate active reports (same contact phone + same need_type + same city, last 24h)
        (
          'req_dup_a', 'normal_user', ARRAY['first_aid']::TEXT[], '', 1,
          ARRAY[]::TEXT[], ARRAY[]::TEXT[],
          'first_aid', 'Duplicate report A', NULL, 'Dup', 5559998877, TRUE,
          'PENDING', NOW() - INTERVAL '90 minutes', NULL, NULL, FALSE
        ),
        (
          'req_dup_b', 'normal_user', ARRAY['first_aid']::TEXT[], '', 1,
          ARRAY[]::TEXT[], ARRAY[]::TEXT[],
          'first_aid', 'Duplicate report B', NULL, 'Dup', 5559998877, TRUE,
          'PENDING', NOW() - INTERVAL '30 minutes', NULL, NULL, FALSE
        ),
        -- Resolved (must be ignored everywhere)
        (
          'req_resolved', 'normal_user', ARRAY['food']::TEXT[], '', 1,
          ARRAY[]::TEXT[], ARRAY[]::TEXT[],
          'food', 'Already resolved', NULL, 'G', 5551112239, TRUE,
          'RESOLVED', NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day', NULL, FALSE
        )
    `,
  );

  await query(
    `
      INSERT INTO request_locations (
        location_id, request_id, country, city, district, neighborhood, extra_address
      )
      VALUES
        ('loc_u1', 'req_unassigned_old', 'turkiye', 'ankara', 'cankaya', 'kizilay', ''),
        ('loc_u2', 'req_unassigned_new', 'turkiye', 'ankara', 'cankaya', 'kizilay', ''),
        ('loc_u3', 'req_pending_with_cancelled_assignment', 'turkiye', 'istanbul', 'kadikoy', 'fenerbahce', ''),
        ('loc_p1', 'req_inprogress_fresh', 'turkiye', 'istanbul', 'besiktas', 'levazim', ''),
        ('loc_n1', 'req_neglected_one', 'turkiye', 'izmir', 'konak', 'alsancak', ''),
        ('loc_n2', 'req_neglected_two', 'turkiye', 'izmir', 'konak', 'alsancak', ''),
        ('loc_dup_a', 'req_dup_a', 'turkiye', 'ankara', 'cankaya', 'kizilay', ''),
        ('loc_dup_b', 'req_dup_b', 'turkiye', 'ankara', 'cankaya', 'kizilay', ''),
        ('loc_r1', 'req_resolved', 'turkiye', 'bursa', 'osmangazi', 'kukurtlu', '')
    `,
  );

  await query(
    `
      INSERT INTO assignments (assignment_id, volunteer_id, request_id, assigned_at, is_cancelled)
      VALUES
        -- Cancelled assignment for the still-pending request -> request remains unassigned
        ('asg_cancelled', 'vol_normal', 'req_pending_with_cancelled_assignment', NOW() - INTERVAL '6 hours', TRUE),
        -- Fresh active assignment
        ('asg_fresh', 'vol_normal', 'req_inprogress_fresh', NOW() - INTERVAL '1 hour', FALSE),
        -- Two active assignments to two distinct volunteers (partial unique index forbids same volunteer twice)
        ('asg_neglected_one', 'vol_overloaded', 'req_neglected_one', NOW() - INTERVAL '24 hours', FALSE),
        ('asg_neglected_two', 'vol_neglect2', 'req_neglected_two', NOW() - INTERVAL '20 hours', FALSE)
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

describe('GET /api/admin/deployment-monitoring', () => {
  test('returns 401 without token', async () => {
    const app = createTestApp();
    const response = await request(app).get('/api/admin/deployment-monitoring');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  test('returns 403 for non-admin users', async () => {
    await seedBaseUsers();
    const app = createTestApp();
    const userToken = buildAuthToken({ userId: 'normal_user', isAdmin: false });

    const response = await request(app)
      .get('/api/admin/deployment-monitoring')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  test('returns deployment monitoring buckets for admins', async () => {
    await seedBaseUsers();
    await seedHelpRequests();

    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/admin/deployment-monitoring')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.monitoring).toBeTruthy();

    const { thresholds, summary, unassigned, longWaiting, inProgress, neglected, conflicts } =
      response.body.monitoring;

    // Thresholds echo defaults
    expect(thresholds).toEqual({
      waitThresholdHours: 6,
      neglectThresholdHours: 12,
      listLimit: 10,
    });

    // Summary counts
    expect(summary.unassigned).toBe(5); // old + new + cancelled-assignment-only + dup_a + dup_b
    expect(summary.longWaiting).toBe(2); // old (8h) + cancelled-assignment-only (7h)
    expect(summary.inProgress).toBe(3); // fresh + neglected_one + neglected_two
    expect(summary.neglected).toBe(2); // both neglected ones (>12h)
    expect(summary.conflicts).toBe(1); // duplicate group: ankara + first_aid + same phone

    // Unassigned items only contain pending requests with no active assignment
    const unassignedIds = unassigned.map((row) => row.requestId);
    expect(unassignedIds).toEqual(
      expect.arrayContaining([
        'req_unassigned_old',
        'req_unassigned_new',
        'req_pending_with_cancelled_assignment',
        'req_dup_a',
        'req_dup_b',
      ]),
    );
    unassigned.forEach((row) => {
      expect(row.status).toBe('PENDING');
      expect(row.volunteerId).toBeNull();
      expect(row.assignedAt).toBeNull();
    });

    // Long-waiting omits the recent pending rows
    const longWaitingIds = longWaiting.map((row) => row.requestId);
    expect(longWaitingIds).toEqual(
      expect.arrayContaining(['req_unassigned_old', 'req_pending_with_cancelled_assignment']),
    );
    expect(longWaitingIds).not.toContain('req_unassigned_new');
    expect(longWaitingIds).not.toContain('req_dup_a');

    // In-progress contains active assignments only
    const inProgressIds = inProgress.map((row) => row.requestId);
    expect(inProgressIds).toEqual(
      expect.arrayContaining(['req_inprogress_fresh', 'req_neglected_one', 'req_neglected_two']),
    );
    inProgress.forEach((row) => {
      expect(['ASSIGNED', 'IN_PROGRESS']).toContain(row.status);
      expect(row.volunteerId).toBeTruthy();
      expect(row.assignedAt).toBeTruthy();
    });

    // Neglected contains only the >=12h ones
    const neglectedIds = neglected.map((row) => row.requestId);
    expect(neglectedIds).toEqual(
      expect.arrayContaining(['req_neglected_one', 'req_neglected_two']),
    );
    expect(neglectedIds).not.toContain('req_inprogress_fresh');
    neglected.forEach((row) => {
      expect(row.assignedHoursAgo).toBeGreaterThanOrEqual(12);
    });

    // Conflicts grouped by (city, needType, contact) duplicate group
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].groupKey).toEqual({
      city: 'ankara',
      needType: 'first_aid',
      contactKey: '***8877',
    });
    expect(conflicts[0].duplicateCount).toBe(2);
    const conflictRequestIds = conflicts[0].items.map((row) => row.requestId);
    expect(conflictRequestIds).toEqual(
      expect.arrayContaining(['req_dup_a', 'req_dup_b']),
    );
  });

  test('does not merge conflict groups with same city/type but different contacts', async () => {
    await seedBaseUsers();
    await seedHelpRequests();

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
            'req_dup_c', 'normal_user', ARRAY['first_aid']::TEXT[], '', 1,
            ARRAY[]::TEXT[], ARRAY[]::TEXT[],
            'first_aid', 'Duplicate report C', NULL, 'Dup2', 5554441100, TRUE,
            'PENDING', NOW() - INTERVAL '80 minutes', NULL, NULL, FALSE
          ),
          (
            'req_dup_d', 'normal_user', ARRAY['first_aid']::TEXT[], '', 1,
            ARRAY[]::TEXT[], ARRAY[]::TEXT[],
            'first_aid', 'Duplicate report D', NULL, 'Dup2', 5554441100, TRUE,
            'PENDING', NOW() - INTERVAL '20 minutes', NULL, NULL, FALSE
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
          ('loc_dup_c', 'req_dup_c', 'turkiye', 'ankara', 'cankaya', 'kizilay', ''),
          ('loc_dup_d', 'req_dup_d', 'turkiye', 'ankara', 'cankaya', 'kizilay', '')
      `,
    );

    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/admin/deployment-monitoring')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);

    const { summary, conflicts } = response.body.monitoring;
    expect(summary.conflicts).toBe(2);
    expect(conflicts).toHaveLength(2);

    const groupKeys = conflicts.map((group) => `${group.groupKey.city}:${group.groupKey.needType}:${group.groupKey.contactKey}`);
    expect(groupKeys).toEqual(expect.arrayContaining([
      'ankara:first_aid:***8877',
      'ankara:first_aid:***1100',
    ]));

    conflicts.forEach((group) => {
      expect(group.duplicateCount).toBe(2);
      expect(group.items).toHaveLength(2);
    });
  });

  test('respects waitThresholdHours and neglectThresholdHours query params', async () => {
    await seedBaseUsers();
    await seedHelpRequests();

    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/admin/deployment-monitoring?waitThresholdHours=1&neglectThresholdHours=48')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    const { summary, longWaiting, neglected, thresholds } = response.body.monitoring;
    expect(thresholds.waitThresholdHours).toBe(1);
    expect(thresholds.neglectThresholdHours).toBe(48);
    // With 1h threshold, all PENDING rows older than 1h count as long-waiting:
    // req_unassigned_old (8h), req_pending_with_cancelled_assignment (7h),
    // req_dup_a (1.5h). Excludes req_unassigned_new (1h) and req_dup_b (30m).
    expect(summary.longWaiting).toBe(3);
    expect(longWaiting.map((row) => row.requestId)).toEqual(
      expect.arrayContaining([
        'req_unassigned_old',
        'req_pending_with_cancelled_assignment',
        'req_dup_a',
      ]),
    );
    // With 48h threshold none of the assignments are neglected
    expect(summary.neglected).toBe(0);
    expect(neglected).toEqual([]);
  });

  test('respects listLimit', async () => {
    await seedBaseUsers();
    await seedHelpRequests();

    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/admin/deployment-monitoring?listLimit=1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    const { summary, unassigned } = response.body.monitoring;
    // Summary still reflects full counts
    expect(summary.unassigned).toBe(5);
    // List capped to 1
    expect(unassigned).toHaveLength(1);
  });

  test('returns 400 for invalid waitThresholdHours', async () => {
    await seedBaseUsers();
    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/admin/deployment-monitoring?waitThresholdHours=0')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 for invalid neglectThresholdHours', async () => {
    await seedBaseUsers();
    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/admin/deployment-monitoring?neglectThresholdHours=999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 for invalid listLimit', async () => {
    await seedBaseUsers();
    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/admin/deployment-monitoring?listLimit=0')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  test('returns zeroed summary and empty lists when there is no data', async () => {
    await seedBaseUsers();

    const app = createTestApp();
    const adminToken = buildAuthToken({ userId: 'admin_user', isAdmin: true });

    const response = await request(app)
      .get('/api/admin/deployment-monitoring')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.monitoring.summary).toEqual({
      unassigned: 0,
      longWaiting: 0,
      inProgress: 0,
      neglected: 0,
      conflicts: 0,
    });
    expect(response.body.monitoring.unassigned).toEqual([]);
    expect(response.body.monitoring.longWaiting).toEqual([]);
    expect(response.body.monitoring.inProgress).toEqual([]);
    expect(response.body.monitoring.neglected).toEqual([]);
    expect(response.body.monitoring.conflicts).toEqual([]);
  });
});
