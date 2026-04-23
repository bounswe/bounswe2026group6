'use strict';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const { availabilityRouter } = require('../../../../src/modules/availability/routes');
const { tryToAssignRequest } = require('../../../../src/modules/availability/service');
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

async function seedVolunteer({
  volunteerId,
  userId,
  isAvailable = true,
  latitude = null,
  longitude = null,
  locationUpdatedAt = '2026-04-23T08:00:00.000Z',
}) {
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
      VALUES ($1, $2, $3, $4, $5, $6);
    `,
    [volunteerId, userId, isAvailable, latitude, longitude, locationUpdatedAt],
  );
}

async function seedVolunteerProfile(userId, expertiseArea) {
  const profileId = `prf_${userId}`;

  await query(
    `
      INSERT INTO user_profiles (profile_id, user_id, first_name, last_name, phone_number)
      VALUES ($1, $2, 'Helper', 'User', '5301234567');
    `,
    [profileId, userId],
  );

  if (expertiseArea) {
    await query(
      `
        INSERT INTO expertise (expertise_id, profile_id, profession, expertise_area, is_verified)
        VALUES ($1, $2, 'Volunteer', $3, FALSE);
      `,
      [`exp_${userId}`, profileId, expertiseArea],
    );
  }
}

async function seedHelpRequest(requestId, userId, options = {}) {
  const {
    needType = 'general',
    helpTypes = [needType],
    affectedPeopleCount = 1,
    latitude = null,
    longitude = null,
    createdAt = '2026-04-23T08:00:00.000Z',
  } = options;

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
          contact_phone,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, 'Need help', 'PENDING', 'Test Person', 5550000000, $6);
      `,
    [requestId, userId, helpTypes, affectedPeopleCount, needType, createdAt],
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
          longitude,
          is_gps_location,
          is_last_known,
          captured_at
        )
        VALUES ($1, $2, 'turkiye', 'istanbul', 'besiktas', 'levazim', 'Test Address', $3, $4, FALSE, FALSE, $5);
      `,
      [`loc_${requestId}`, requestId, latitude, longitude, createdAt],
    );
  }
}

async function listAssignedVolunteerIds(requestId) {
  const result = await query(
    `
      SELECT volunteer_id
      FROM assignments
      WHERE request_id = $1 AND is_cancelled = FALSE
      ORDER BY assigned_at ASC, volunteer_id ASC;
    `,
    [requestId],
  );

  return result.rows.map((row) => row.volunteer_id);
}

beforeEach(async () => {
  await query(`
    TRUNCATE TABLE
      assignments,
      availability_records,
      volunteers,
      request_locations,
      help_requests,
      expertise,
      user_profiles,
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

  test('POST /api/availability/toggle prefers older first-aid + SAR request for a medical volunteer', async () => {
    const app = createTestApp();
    const volunteerUserId = 'user_v_priority';
    await seedActiveUser(volunteerUserId, 'priority@example.com');
    await seedVolunteerProfile(volunteerUserId, '["First Aid","Logistics"]');

    await seedActiveUser('user_r_priority_1', 'priorityr1@example.com');
    await seedActiveUser('user_r_priority_2', 'priorityr2@example.com');
    await seedActiveUser('user_r_priority_3', 'priorityr3@example.com');

    await seedHelpRequest('req_priority_sar', 'user_r_priority_1', {
      needType: 'fire_brigade',
      helpTypes: ['fire_brigade'],
      createdAt: '2026-04-23T08:00:00.000Z',
    });
    await seedHelpRequest('req_priority_fa_new', 'user_r_priority_2', {
      needType: 'first_aid',
      helpTypes: ['first_aid', 'fire_brigade'],
      createdAt: '2026-04-23T08:05:00.000Z',
    });
    await seedHelpRequest('req_priority_fa_old', 'user_r_priority_3', {
      needType: 'first_aid',
      helpTypes: ['first_aid', 'fire_brigade'],
      createdAt: '2026-04-23T08:01:00.000Z',
    });

    const token = buildAuthToken(volunteerUserId);
    const response = await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${token}`)
      .send({ isAvailable: true });

    expect(response.status).toBe(200);
    expect(response.body.assignment).toBeTruthy();
    expect(response.body.assignment.request_id).toBe('req_priority_fa_old');
  });

  test('POST /api/availability/toggle falls back to a general volunteer for first-aid-only requests', async () => {
    const app = createTestApp();
    const volunteerUserId = 'user_v_general_first_aid';
    const requesterUserId = 'user_r_general_first_aid';
    await seedActiveUser(volunteerUserId, 'generalfa@example.com');
    await seedActiveUser(requesterUserId, 'requestfa@example.com');
    await seedHelpRequest('req_general_first_aid', requesterUserId, {
      needType: 'first_aid',
      helpTypes: ['first_aid'],
    });

    const token = buildAuthToken(volunteerUserId);
    const response = await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${token}`)
      .send({ isAvailable: true });

    expect(response.status).toBe(200);
    expect(response.body.assignment).toBeTruthy();
    expect(response.body.assignment.request_id).toBe('req_general_first_aid');
  });

  test('POST /api/availability/toggle handles SAR, supplies, and shelter requests through the same initial-coverage matcher', async () => {
    const app = createTestApp();

    const sarVolunteerId = 'user_v_sar';
    const suppliesVolunteerId = 'user_v_supplies';
    const shelterVolunteerId = 'user_v_shelter';
    const requesterIds = ['user_r_sar', 'user_r_supplies', 'user_r_shelter'];

    await seedActiveUser(sarVolunteerId, 'sar@example.com');
    await seedActiveUser(suppliesVolunteerId, 'supplies@example.com');
    await seedActiveUser(shelterVolunteerId, 'shelter@example.com');
    await Promise.all(requesterIds.map((userId) => seedActiveUser(userId, `${userId}@example.com`)));

    await seedHelpRequest('req_sar_only', 'user_r_sar', {
      needType: 'fire_brigade',
      helpTypes: ['fire_brigade'],
    });
    await seedHelpRequest('req_supplies_only', 'user_r_supplies', {
      needType: 'food',
      helpTypes: ['food', 'water'],
    });
    await seedHelpRequest('req_shelter_only', 'user_r_shelter', {
      needType: 'shelter',
      helpTypes: ['shelter'],
    });

    const sarResponse = await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${buildAuthToken(sarVolunteerId)}`)
      .send({ isAvailable: true });
    const suppliesResponse = await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${buildAuthToken(suppliesVolunteerId)}`)
      .send({ isAvailable: true });
    const shelterResponse = await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${buildAuthToken(shelterVolunteerId)}`)
      .send({ isAvailable: true });

    expect(sarResponse.body.assignment.request_id).toBe('req_sar_only');
    expect([
      suppliesResponse.body.assignment.request_id,
      shelterResponse.body.assignment.request_id,
    ].sort()).toEqual(['req_shelter_only', 'req_supplies_only']);
  });

  test('POST /api/availability/toggle applies the 1 km cutoff and safely falls back when coordinates are missing', async () => {
    const app = createTestApp();

    const nearVolunteerId = 'user_v_near';
    const noCoordVolunteerId = 'user_v_nocoord';
    await seedActiveUser(nearVolunteerId, 'near@example.com');
    await seedActiveUser(noCoordVolunteerId, 'nocoord@example.com');
    await seedActiveUser('user_r_far', 'far@example.com');
    await seedActiveUser('user_r_missing', 'missing@example.com');

    await seedHelpRequest('req_far_only', 'user_r_far', {
      needType: 'food',
      helpTypes: ['food'],
      latitude: 41.03,
      longitude: 29.03,
    });
    await seedHelpRequest('req_missing_coords', 'user_r_missing', {
      needType: 'food',
      helpTypes: ['food'],
      createdAt: '2026-04-23T08:10:00.000Z',
    });

    const farResponse = await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${buildAuthToken(nearVolunteerId)}`)
      .send({ isAvailable: true, latitude: 41.0, longitude: 29.0 });

    expect(farResponse.status).toBe(200);
    expect(farResponse.body.assignment).toBeTruthy();
    expect(farResponse.body.assignment.request_id).toBe('req_missing_coords');

    const noCoordResponse = await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${buildAuthToken(noCoordVolunteerId)}`)
      .send({ isAvailable: true });

    expect(noCoordResponse.status).toBe(200);
    expect(noCoordResponse.body.assignment).toBeTruthy();
    expect(noCoordResponse.body.assignment.request_id).toBe('req_far_only');

    const farStatus = await query('SELECT status FROM help_requests WHERE request_id = $1', ['req_far_only']);
    expect(farStatus.rows[0].status).toBe('ASSIGNED');
  });

  test('tryToAssignRequest expands SAR requests up to affectedPeopleCount + 1 after initial coverage', async () => {
    await seedActiveUser('user_r_sar_growth', 'sar-growth@example.com');
    await seedHelpRequest('req_sar_growth', 'user_r_sar_growth', {
      needType: 'fire_brigade',
      helpTypes: ['fire_brigade'],
      affectedPeopleCount: 3,
    });

    for (const [index, volunteerId] of ['vol_sar_1', 'vol_sar_2', 'vol_sar_3', 'vol_sar_4'].entries()) {
      const userId = `user_${volunteerId}`;
      await seedActiveUser(userId, `${userId}@example.com`);
      await seedVolunteer({
        volunteerId,
        userId,
        isAvailable: true,
        locationUpdatedAt: `2026-04-23T08:0${index}:00.000Z`,
      });
    }

    const assigned = await tryToAssignRequest('req_sar_growth');

    expect(assigned).toBe(true);
    expect(await listAssignedVolunteerIds('req_sar_growth')).toHaveLength(4);

    const statusResult = await query('SELECT status FROM help_requests WHERE request_id = $1', ['req_sar_growth']);
    expect(statusResult.rows[0].status).toBe('ASSIGNED');
  });

  test('tryToAssignRequest uses the schema default affectedPeopleCount of 1 when SAR count is omitted', async () => {
    await seedActiveUser('user_r_sar_single', 'sar-single@example.com');
    await seedHelpRequest('req_sar_single', 'user_r_sar_single', {
      needType: 'fire_brigade',
      helpTypes: ['fire_brigade'],
    });

    for (const [index, volunteerId] of ['vol_sar_single_1', 'vol_sar_single_2', 'vol_sar_single_3'].entries()) {
      const userId = `user_${volunteerId}`;
      await seedActiveUser(userId, `${userId}@example.com`);
      await seedVolunteer({
        volunteerId,
        userId,
        isAvailable: true,
        locationUpdatedAt: `2026-04-23T08:1${index}:00.000Z`,
      });
    }

    const assigned = await tryToAssignRequest('req_sar_single');

    expect(assigned).toBe(true);
    expect(await listAssignedVolunteerIds('req_sar_single')).toHaveLength(2);

    const requestResult = await query(
      'SELECT affected_people_count FROM help_requests WHERE request_id = $1',
      ['req_sar_single'],
    );
    expect(requestResult.rows[0].affected_people_count).toBe(1);
  });

  test('tryToAssignRequest fulfills first aid + SAR requests with a first-aid-capable responder when available from the start', async () => {
    await seedActiveUser('user_r_fa_sar_full', 'fasarfull@example.com');
    await seedHelpRequest('req_fa_sar_full', 'user_r_fa_sar_full', {
      needType: 'first_aid',
      helpTypes: ['first_aid', 'fire_brigade'],
      affectedPeopleCount: 3,
    });

    await seedActiveUser('user_vol_fa_full', 'fa-full@example.com');
    await seedVolunteer({ volunteerId: 'vol_fa_full', userId: 'user_vol_fa_full', isAvailable: true });
    await seedVolunteerProfile('user_vol_fa_full', '["First Aid"]');

    for (const [index, volunteerId] of ['vol_fa_sar_g1', 'vol_fa_sar_g2', 'vol_fa_sar_g3'].entries()) {
      const userId = `user_${volunteerId}`;
      await seedActiveUser(userId, `${userId}@example.com`);
      await seedVolunteer({
        volunteerId,
        userId,
        isAvailable: true,
        locationUpdatedAt: `2026-04-23T08:2${index}:00.000Z`,
      });
    }

    await tryToAssignRequest('req_fa_sar_full');

    const assignedVolunteerIds = await listAssignedVolunteerIds('req_fa_sar_full');
    expect(assignedVolunteerIds).toHaveLength(4);
    expect(assignedVolunteerIds).toContain('vol_fa_full');
  });

  test('a first aid + SAR request that started with a general fallback adds a first-aid-capable volunteer later', async () => {
    const app = createTestApp();

    await seedActiveUser('user_r_fa_sar_late', 'fasarlate@example.com');
    await seedHelpRequest('req_fa_sar_late', 'user_r_fa_sar_late', {
      needType: 'first_aid',
      helpTypes: ['first_aid', 'fire_brigade'],
      affectedPeopleCount: 1,
    });

    await seedActiveUser('user_vol_general_late', 'general-late@example.com');
    await seedVolunteer({ volunteerId: 'vol_general_late', userId: 'user_vol_general_late', isAvailable: true });

    await tryToAssignRequest('req_fa_sar_late');

    expect(await listAssignedVolunteerIds('req_fa_sar_late')).toEqual(['vol_general_late']);

    await seedActiveUser('user_vol_fa_late', 'fa-late@example.com');
    await seedVolunteer({ volunteerId: 'vol_fa_late', userId: 'user_vol_fa_late', isAvailable: false });
    await seedVolunteerProfile('user_vol_fa_late', '["First Aid"]');

    const response = await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${buildAuthToken('user_vol_fa_late')}`)
      .send({ isAvailable: true });

    expect(response.status).toBe(200);
    expect(response.body.assignment.request_id).toBe('req_fa_sar_late');
    expect(await listAssignedVolunteerIds('req_fa_sar_late')).toEqual(['vol_general_late', 'vol_fa_late']);
  });

  test('tryToAssignRequest does not reuse a volunteer who is already assigned to an IN_PROGRESS request', async () => {
    await seedActiveUser('user_r_in_progress_busy', 'in-progress-busy@example.com');
    await seedHelpRequest('req_in_progress_busy', 'user_r_in_progress_busy', {
      needType: 'food',
      helpTypes: ['food'],
    });

    await seedActiveUser('user_r_in_progress_open', 'in-progress-open@example.com');
    await seedHelpRequest('req_in_progress_open', 'user_r_in_progress_open', {
      needType: 'water',
      helpTypes: ['water'],
      createdAt: '2026-04-23T08:10:00.000Z',
    });

    await seedActiveUser('user_vol_in_progress_busy', 'vol-in-progress-busy@example.com');
    await seedVolunteer({ volunteerId: 'vol_in_progress_busy', userId: 'user_vol_in_progress_busy', isAvailable: true });

    await query(
      `
        INSERT INTO assignments (assignment_id, volunteer_id, request_id, assigned_at, is_cancelled)
        VALUES ('asg_in_progress_busy', 'vol_in_progress_busy', 'req_in_progress_busy', CURRENT_TIMESTAMP, FALSE);
      `,
    );
    await query(
      `
        UPDATE help_requests
        SET status = 'IN_PROGRESS'
        WHERE request_id = 'req_in_progress_busy';
      `,
    );

    const assigned = await tryToAssignRequest('req_in_progress_open');

    expect(assigned).toBe(false);
    expect(await listAssignedVolunteerIds('req_in_progress_open')).toEqual([]);
  });

  test('a first-aid-only request that started with a general fallback adds a first-aid-capable volunteer later', async () => {
    const app = createTestApp();

    await seedActiveUser('user_r_fa_only_late', 'faonlylate@example.com');
    await seedHelpRequest('req_fa_only_late', 'user_r_fa_only_late', {
      needType: 'first_aid',
      helpTypes: ['first_aid'],
    });

    await seedActiveUser('user_vol_general_fa_only', 'general-fa-only@example.com');
    await seedVolunteer({ volunteerId: 'vol_general_fa_only', userId: 'user_vol_general_fa_only', isAvailable: true });

    await tryToAssignRequest('req_fa_only_late');

    expect(await listAssignedVolunteerIds('req_fa_only_late')).toEqual(['vol_general_fa_only']);

    await seedActiveUser('user_vol_fa_only_late', 'fa-only-late@example.com');
    await seedVolunteer({ volunteerId: 'vol_fa_only_late', userId: 'user_vol_fa_only_late', isAvailable: false });
    await seedVolunteerProfile('user_vol_fa_only_late', '["First Aid"]');

    const response = await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${buildAuthToken('user_vol_fa_only_late')}`)
      .send({ isAvailable: true });

    expect(response.status).toBe(200);
    expect(response.body.assignment.request_id).toBe('req_fa_only_late');
    expect(await listAssignedVolunteerIds('req_fa_only_late')).toEqual(['vol_general_fa_only', 'vol_fa_only_late']);
  });

  test('an IN_PROGRESS first aid + SAR request can still receive a later first-aid-capable follow-up', async () => {
    const app = createTestApp();

    await seedActiveUser('user_r_fa_sar_progress', 'fasarprogress@example.com');
    await seedHelpRequest('req_fa_sar_progress', 'user_r_fa_sar_progress', {
      needType: 'first_aid',
      helpTypes: ['first_aid', 'fire_brigade'],
      affectedPeopleCount: 1,
    });

    await seedActiveUser('user_vol_general_progress', 'general-progress@example.com');
    await seedVolunteer({ volunteerId: 'vol_general_progress', userId: 'user_vol_general_progress', isAvailable: true });

    await tryToAssignRequest('req_fa_sar_progress');
    expect(await listAssignedVolunteerIds('req_fa_sar_progress')).toEqual(['vol_general_progress']);

    await query(
      `
        UPDATE help_requests
        SET status = 'IN_PROGRESS'
        WHERE request_id = 'req_fa_sar_progress';
      `,
    );

    await seedActiveUser('user_vol_fa_progress', 'fa-progress@example.com');
    await seedVolunteer({ volunteerId: 'vol_fa_progress', userId: 'user_vol_fa_progress', isAvailable: false });
    await seedVolunteerProfile('user_vol_fa_progress', '["First Aid"]');

    const response = await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${buildAuthToken('user_vol_fa_progress')}`)
      .send({ isAvailable: true });

    expect(response.status).toBe(200);
    expect(response.body.assignment.request_id).toBe('req_fa_sar_progress');

    const assignedVolunteerIds = await listAssignedVolunteerIds('req_fa_sar_progress');
    expect(assignedVolunteerIds).toHaveLength(2);
    expect(assignedVolunteerIds).toContain('vol_general_progress');
    expect(assignedVolunteerIds).toContain('vol_fa_progress');
  });

  test('minimum first coverage happens before SAR expansion across simultaneous requests', async () => {
    const app = createTestApp();

    await seedActiveUser('user_r_fair_sar', 'fair-sar@example.com');
    await seedActiveUser('user_r_fair_supplies', 'fair-supplies@example.com');
    await seedHelpRequest('req_fair_sar', 'user_r_fair_sar', {
      needType: 'fire_brigade',
      helpTypes: ['fire_brigade'],
      affectedPeopleCount: 2,
      createdAt: '2026-04-23T08:00:00.000Z',
    });
    await seedHelpRequest('req_fair_supplies', 'user_r_fair_supplies', {
      needType: 'food',
      helpTypes: ['food'],
      createdAt: '2026-04-23T08:01:00.000Z',
    });

    for (const volunteerUserId of ['user_v_fair_1', 'user_v_fair_2', 'user_v_fair_3']) {
      await seedActiveUser(volunteerUserId, `${volunteerUserId}@example.com`);
    }

    const firstResponse = await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${buildAuthToken('user_v_fair_1')}`)
      .send({ isAvailable: true });
    expect(firstResponse.body.assignment.request_id).toBe('req_fair_sar');

    const secondResponse = await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${buildAuthToken('user_v_fair_2')}`)
      .send({ isAvailable: true });
    expect(secondResponse.body.assignment.request_id).toBe('req_fair_supplies');

    const thirdResponse = await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${buildAuthToken('user_v_fair_3')}`)
      .send({ isAvailable: true });
    expect(thirdResponse.body.assignment.request_id).toBe('req_fair_sar');

    expect(await listAssignedVolunteerIds('req_fair_sar')).toHaveLength(2);
    expect(await listAssignedVolunteerIds('req_fair_supplies')).toHaveLength(1);
  });

  test('SAR expansion still respects the 1 km cutoff for additional responders', async () => {
    await seedActiveUser('user_r_sar_radius', 'sar-radius@example.com');
    await seedHelpRequest('req_sar_radius', 'user_r_sar_radius', {
      needType: 'fire_brigade',
      helpTypes: ['fire_brigade'],
      affectedPeopleCount: 2,
      latitude: 41.0,
      longitude: 29.0,
    });

    await seedActiveUser('user_vol_near_radius', 'near-radius@example.com');
    await seedVolunteer({
      volunteerId: 'vol_near_radius',
      userId: 'user_vol_near_radius',
      isAvailable: true,
      latitude: 41.0005,
      longitude: 29.0005,
    });

    await seedActiveUser('user_vol_far_radius', 'far-radius@example.com');
    await seedVolunteer({
      volunteerId: 'vol_far_radius',
      userId: 'user_vol_far_radius',
      isAvailable: true,
      latitude: 41.03,
      longitude: 29.03,
    });

    await tryToAssignRequest('req_sar_radius');

    expect(await listAssignedVolunteerIds('req_sar_radius')).toEqual(['vol_near_radius']);
  });

  test('expansion order stays deterministic with stable request tie-breaking', async () => {
    const app = createTestApp();

    await seedActiveUser('user_r_det_a', 'det-a@example.com');
    await seedActiveUser('user_r_det_b', 'det-b@example.com');
    await seedHelpRequest('req_a', 'user_r_det_a', {
      needType: 'fire_brigade',
      helpTypes: ['fire_brigade'],
      affectedPeopleCount: 1,
      createdAt: '2026-04-23T08:00:00.000Z',
    });
    await seedHelpRequest('req_b', 'user_r_det_b', {
      needType: 'fire_brigade',
      helpTypes: ['fire_brigade'],
      affectedPeopleCount: 1,
      createdAt: '2026-04-23T08:00:00.000Z',
    });

    await seedActiveUser('user_vol_det_1', 'det-1@example.com');
    await seedActiveUser('user_vol_det_2', 'det-2@example.com');
    await seedVolunteer({ volunteerId: 'vol_det_1', userId: 'user_vol_det_1', isAvailable: true });
    await seedVolunteer({ volunteerId: 'vol_det_2', userId: 'user_vol_det_2', isAvailable: true });

    await tryToAssignRequest('req_a');

    expect(await listAssignedVolunteerIds('req_a')).toHaveLength(1);
    expect(await listAssignedVolunteerIds('req_b')).toHaveLength(1);

    await seedActiveUser('user_vol_det_3', 'det-3@example.com');
    const response = await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${buildAuthToken('user_vol_det_3')}`)
      .send({ isAvailable: true });

    expect(response.status).toBe(200);
    expect(response.body.assignment.request_id).toBe('req_a');
    expect(await listAssignedVolunteerIds('req_a')).toHaveLength(2);
    expect(await listAssignedVolunteerIds('req_b')).toHaveLength(1);
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

  test('cancelling one responder on a multi-responder SAR request rematches another volunteer and keeps the request assigned', async () => {
    const app = createTestApp();

    await seedActiveUser('user_req_multi_cancel', 'req-multi-cancel@example.com');
    await seedHelpRequest('req_multi_cancel', 'user_req_multi_cancel', {
      needType: 'fire_brigade',
      helpTypes: ['fire_brigade'],
      affectedPeopleCount: 1,
    });

    for (const volunteerUserId of ['user_multi_cancel_1', 'user_multi_cancel_2', 'user_multi_cancel_3']) {
      await seedActiveUser(volunteerUserId, `${volunteerUserId}@example.com`);
    }

    const firstToken = buildAuthToken('user_multi_cancel_1');
    const secondToken = buildAuthToken('user_multi_cancel_2');
    const thirdToken = buildAuthToken('user_multi_cancel_3');

    const firstToggle = await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${firstToken}`)
      .send({ isAvailable: true });
    expect(firstToggle.status).toBe(200);
    expect(firstToggle.body.assignment.request_id).toBe('req_multi_cancel');

    const secondToggle = await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${secondToken}`)
      .send({ isAvailable: true });
    expect(secondToggle.status).toBe(200);
    expect(secondToggle.body.assignment.request_id).toBe('req_multi_cancel');

    const thirdToggle = await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${thirdToken}`)
      .send({ isAvailable: true });
    expect(thirdToggle.status).toBe(200);
    expect(thirdToggle.body.assignment).toBeNull();

    expect(await listAssignedVolunteerIds('req_multi_cancel')).toHaveLength(2);

    const cancelResponse = await request(app)
      .post(`/api/availability/assignments/${firstToggle.body.assignment.assignment_id}/cancel`)
      .set('Authorization', `Bearer ${firstToken}`);

    expect(cancelResponse.status).toBe(200);

    const assignedVolunteerIds = await listAssignedVolunteerIds('req_multi_cancel');
    expect(assignedVolunteerIds).toHaveLength(2);

    const requestStatus = await query('SELECT status FROM help_requests WHERE request_id = $1', ['req_multi_cancel']);
    expect(requestStatus.rows[0].status).toBe('ASSIGNED');

    const firstStatus = await request(app)
      .get('/api/availability/status')
      .set('Authorization', `Bearer ${firstToken}`);
    expect(firstStatus.status).toBe(200);
    expect(firstStatus.body.isAvailable).toBe(false);
    expect(firstStatus.body.assignment).toBeNull();

    const secondStatus = await request(app)
      .get('/api/availability/status')
      .set('Authorization', `Bearer ${secondToken}`);
    expect(secondStatus.status).toBe(200);
    expect(secondStatus.body.assignment.request_id).toBe('req_multi_cancel');

    const thirdStatus = await request(app)
      .get('/api/availability/status')
      .set('Authorization', `Bearer ${thirdToken}`);
    expect(thirdStatus.status).toBe(200);
    expect(thirdStatus.body.assignment.request_id).toBe('req_multi_cancel');
  });

  test('resolving a multi-responder request removes sibling assignments', async () => {
    const app = createTestApp();

    await seedActiveUser('user_req_multi_resolve', 'req-multi-resolve@example.com');
    await seedHelpRequest('req_multi_resolve', 'user_req_multi_resolve', {
      needType: 'fire_brigade',
      helpTypes: ['fire_brigade'],
      affectedPeopleCount: 1,
    });

    for (const volunteerUserId of ['user_multi_resolve_1', 'user_multi_resolve_2']) {
      await seedActiveUser(volunteerUserId, `${volunteerUserId}@example.com`);
    }

    const firstToken = buildAuthToken('user_multi_resolve_1');
    const secondToken = buildAuthToken('user_multi_resolve_2');

    await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${firstToken}`)
      .send({ isAvailable: true });

    await request(app)
      .post('/api/availability/toggle')
      .set('Authorization', `Bearer ${secondToken}`)
      .send({ isAvailable: true });

    expect(await listAssignedVolunteerIds('req_multi_resolve')).toHaveLength(2);

    const response = await request(app)
      .post('/api/availability/assignments/resolve')
      .set('Authorization', `Bearer ${firstToken}`)
      .send({ requestId: 'req_multi_resolve' });

    expect(response.status).toBe(200);

    const remainingAssignments = await query(
      'SELECT * FROM assignments WHERE request_id = $1 AND is_cancelled = FALSE',
      ['req_multi_resolve'],
    );
    expect(remainingAssignments.rows).toHaveLength(0);
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
