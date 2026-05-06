// tests/integration/modules/auth/auth.integration.test.js
'use strict';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { query } = require('../../../../src/db/pool');

// ─── Mock uuid (ESM uyumsuzluğu) ─────────────────────────────────────────────
jest.mock('uuid', () => ({
  v4: () => require('crypto').randomBytes(16).toString('hex'),
}));

// ─── Mock mailer ──────────────────────────────────────────────────────────────
jest.mock('../../../../src/config/mailer', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

// ─── Mock rate limiter (test sırasında 429 almamak için) ─────────────────────
jest.mock('express-rate-limit', () => () => (_req, _res, next) => next());

const { authRouter } = require('../../../../src/modules/auth/routes');

// ─── App factory ─────────────────────────────────────────────────────────────
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

// ─── Test verisi ──────────────────────────────────────────────────────────────
const validUser = {
  email: 'integtest@test.com',
  password: '12345678',
  acceptedTerms: true,
};

// ─── DB temizliği ─────────────────────────────────────────────────────────────
beforeEach(async () => {
  await query(`
    TRUNCATE TABLE
      safety_circle_invites,
      safety_circle_members,
      safety_circles,
      user_operational_locations,
      user_safety_statuses,
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

// ─── POST /api/auth/signup ────────────────────────────────────────────────────

describe('POST /api/auth/signup', () => {
  test('201 - creates user successfully', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/auth/signup').send(validUser);
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(validUser.email);
  });

  test('400 - missing email', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/auth/signup').send({
      password: '12345678',
      acceptedTerms: true,
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('400 - invalid email format', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/auth/signup').send({
      email: 'notanemail',
      password: '12345678',
      acceptedTerms: true,
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('400 - password too short', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/auth/signup').send({
      email: 'integtest@test.com',
      password: '123',
      acceptedTerms: true,
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('400 - acceptedTerms false', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/auth/signup').send({
      email: 'integtest@test.com',
      password: '12345678',
      acceptedTerms: false,
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('409 - email already exists', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);
    const res = await request(app).post('/api/auth/signup').send(validUser);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_ALREADY_EXISTS');
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  test('401 - email not verified', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);

    const res = await request(app).post('/api/auth/login').send({
      email: validUser.email,
      password: validUser.password,
    });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  test('401 - wrong password', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);
    await query(`UPDATE users SET is_email_verified = TRUE WHERE email = $1`, [validUser.email]);

    const res = await request(app).post('/api/auth/login').send({
      email: validUser.email,
      password: 'wrongpassword',
    });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  test('401 - user not found', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/auth/login').send({
      email: 'nonexistent@test.com',
      password: '12345678',
    });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  test('200 - login successful', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);
    await query(`UPDATE users SET is_email_verified = TRUE WHERE email = $1`, [validUser.email]);

    const res = await request(app).post('/api/auth/login').send({
      email: validUser.email,
      password: validUser.password,
    });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  test('403 - banned user cannot log in', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);
    await query(
      `UPDATE users SET is_email_verified = TRUE, is_banned = TRUE WHERE email = $1`,
      [validUser.email],
    );

    const res = await request(app).post('/api/auth/login').send({
      email: validUser.email,
      password: validUser.password,
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('USER_BANNED');
  });

  test('200 - previously banned user can log in after unban', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);
    await query(
      `UPDATE users SET is_email_verified = TRUE, is_banned = TRUE WHERE email = $1`,
      [validUser.email],
    );

    const blocked = await request(app).post('/api/auth/login').send({
      email: validUser.email,
      password: validUser.password,
    });
    expect(blocked.status).toBe(403);

    await query(`UPDATE users SET is_banned = FALSE, ban_reason = NULL, banned_at = NULL WHERE email = $1`, [
      validUser.email,
    ]);

    const restored = await request(app).post('/api/auth/login').send({
      email: validUser.email,
      password: validUser.password,
    });
    expect(restored.status).toBe(200);
    expect(restored.body.accessToken).toBeDefined();
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  test('401 - no token', async () => {
    const app = createTestApp();
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('200 - returns current user', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);
    await query(`UPDATE users SET is_email_verified = TRUE WHERE email = $1`, [validUser.email]);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: validUser.email,
      password: validUser.password,
    });
    const token = loginRes.body.accessToken;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(validUser.email);
  });

  test('403 - active token is rejected after user gets banned', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);
    await query(`UPDATE users SET is_email_verified = TRUE WHERE email = $1`, [validUser.email]);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: validUser.email,
      password: validUser.password,
    });
    const token = loginRes.body.accessToken;

    await query(`UPDATE users SET is_banned = TRUE, ban_reason = 'Abuse', banned_at = NOW() WHERE email = $1`, [
      validUser.email,
    ]);

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(403);
    expect(meRes.body.code).toBe('USER_BANNED');
  });
});

// ─── DELETE /api/auth/me ─────────────────────────────────────────────────────

describe('DELETE /api/auth/me', () => {
  test('401 - no token', async () => {
    const app = createTestApp();
    const res = await request(app).delete('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('200 - soft-deletes account data and cancels active work', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);
    await query(`UPDATE users SET is_email_verified = TRUE WHERE email = $1`, [validUser.email]);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: validUser.email,
      password: validUser.password,
    });
    const token = loginRes.body.accessToken;

    const userRow = await query(`SELECT user_id FROM users WHERE email = $1`, [validUser.email]);
    const userId = userRow.rows[0].user_id;
    const otherUserId = 'other-delete-test-user';
    const otherVolunteerUserId = 'other-delete-test-volunteer-user';
    const profileId = 'profile-delete-test';
    const volunteerId = 'volunteer-delete-test';
    const otherVolunteerId = 'other-volunteer-delete-test';
    const ownedRequestId = 'owned-delete-test-request';
    const assignedRequestId = 'assigned-delete-test-request';

    await query(
      `INSERT INTO users (user_id, email, password_hash, is_email_verified, accepted_terms)
       VALUES ($1, $2, $3, TRUE, TRUE)`,
      [otherUserId, 'other-delete-test@example.com', 'hashed-password'],
    );
    await query(
      `INSERT INTO users (user_id, email, password_hash, is_email_verified, accepted_terms)
       VALUES ($1, $2, $3, TRUE, TRUE)`,
      [otherVolunteerUserId, 'other-volunteer-delete-test@example.com', 'hashed-password'],
    );

    await query(
      `INSERT INTO user_profiles (profile_id, user_id, first_name, last_name, phone_number)
       VALUES ($1, $2, 'Jane', 'Requester', '5550000000')`,
      [profileId, userId],
    );
    await query(
      `INSERT INTO physical_info (physical_id, profile_id, age, date_of_birth, gender, height, weight)
       VALUES ('physical-delete-test', $1, 30, '1996-01-01', 'female', 170, 60)`,
      [profileId],
    );
    await query(
      `INSERT INTO health_info (health_id, profile_id, medical_conditions, chronic_diseases, allergies, medications, blood_type)
       VALUES ('health-delete-test', $1, ARRAY['asthma'], ARRAY['diabetes'], ARRAY['pollen'], ARRAY['med'], 'A+')`,
      [profileId],
    );
    await query(
      `INSERT INTO location_profiles (
         location_profile_id, profile_id, address, city, country, latitude, longitude,
         display_address, country_code, district, neighborhood, extra_address, postal_code,
         place_id, coordinate_accuracy_meters, coordinate_source, coordinate_captured_at
       )
       VALUES (
         'location-profile-delete-test', $1, 'Home address', 'Istanbul', 'Turkey', 41.01, 29.01,
         'Home display', 'TR', 'Kadikoy', 'Moda', 'Street 1', '34000',
         'place-delete-test', 12, 'profile_form', CURRENT_TIMESTAMP
       )`,
      [profileId],
    );
    await query(
      `INSERT INTO privacy_settings (settings_id, profile_id, profile_visibility, health_info_visibility, location_visibility, location_sharing_enabled)
       VALUES ('privacy-delete-test', $1, 'PUBLIC', 'PUBLIC', 'PUBLIC', TRUE)`,
      [profileId],
    );
    await query(
      `INSERT INTO expertise (expertise_id, profile_id, profession, expertise_area, is_verified)
       VALUES ('expertise-delete-test', $1, 'Doctor', 'First Aid', TRUE)`,
      [profileId],
    );
    await query(
      `INSERT INTO volunteers (
         volunteer_id, user_id, is_available, skills, need_types, last_known_latitude,
         last_known_longitude, location_updated_at, available_until, availability_confirmed_at,
         last_location_accuracy_meters, last_location_source
       )
       VALUES ($1, $2, TRUE, ARRAY['first_aid'], ARRAY['medical'], 41.02, 29.02,
         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 hour', CURRENT_TIMESTAMP, 8, 'device')`,
      [volunteerId, userId],
    );
    await query(
      `INSERT INTO volunteers (
         volunteer_id, user_id, is_available, skills, need_types, last_known_latitude,
         last_known_longitude, location_updated_at, available_until, availability_confirmed_at,
         last_location_accuracy_meters, last_location_source
       )
       VALUES ($1, $2, TRUE, ARRAY['shelter'], ARRAY['shelter'], 41.025, 29.025,
         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 hour', CURRENT_TIMESTAMP, 8, 'device')`,
      [otherVolunteerId, otherVolunteerUserId],
    );
    await query(
      `INSERT INTO help_requests (
         request_id, user_id, help_types, other_help_text, affected_people_count, risk_flags,
         vulnerable_groups, need_type, description, blood_type, contact_full_name,
         contact_phone, contact_alternative_phone, consent_given, status
       )
       VALUES ($1, $2, ARRAY['medical'], 'needs oxygen', 1, ARRAY['injury'],
         ARRAY['elderly'], 'medical', 'personal details', 'A+', 'Jane Requester',
         5000000000, 5000000001, TRUE, 'ASSIGNED')`,
      [ownedRequestId, userId],
    );
    await query(
      `INSERT INTO request_locations (
         location_id, request_id, country, city, district, neighborhood, extra_address,
         latitude, longitude, is_gps_location, is_last_known
       )
       VALUES ('owned-location-delete-test', $1, 'Turkey', 'Istanbul', 'Kadikoy', 'Moda',
         'Street 1', 41.01, 29.01, TRUE, TRUE)`,
      [ownedRequestId],
    );
    await query(
      `INSERT INTO help_requests (
         request_id, user_id, help_types, affected_people_count, need_type,
         contact_full_name, contact_phone, consent_given, status
       )
       VALUES ($1, $2, ARRAY['shelter'], 1, 'shelter', 'Other User', 5000000002, TRUE, 'ASSIGNED')`,
      [assignedRequestId, otherUserId],
    );
    await query(
      `INSERT INTO request_locations (location_id, request_id, country, city, district)
       VALUES ('assigned-location-delete-test', $1, 'Turkey', 'Istanbul', 'Besiktas')`,
      [assignedRequestId],
    );
    await query(
      `INSERT INTO assignments (assignment_id, volunteer_id, request_id)
       VALUES ('assignment-delete-test', $1, $2)`,
      [volunteerId, assignedRequestId],
    );
    await query(
      `INSERT INTO assignments (assignment_id, volunteer_id, request_id)
       VALUES ('assignment-other-volunteer-delete-test', $1, $2)`,
      [otherVolunteerId, assignedRequestId],
    );
    await query(
      `INSERT INTO user_safety_statuses (
         user_id, status, status_note, share_location_consent, latitude, longitude,
         location_accuracy_meters, location_source, location_captured_at
       )
       VALUES ($1, 'safe', 'At home', TRUE, 41.03, 29.03, 10, 'device', CURRENT_TIMESTAMP)`,
      [userId],
    );
    await query(
      `INSERT INTO user_operational_locations (user_id, latitude, longitude, accuracy_meters, source, captured_at)
       VALUES ($1, 41.04, 29.04, 10, 'device', CURRENT_TIMESTAMP)`,
      [userId],
    );

    const res = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      deleted: true,
      cancelledRequestCount: 1,
      cancelledAssignmentRequestCount: 1,
      availabilityCancelled: true,
    }));

    const deletedUser = await query(
      `SELECT is_deleted, email, password_hash, is_email_verified, accepted_terms
       FROM users WHERE user_id = $1`,
      [userId],
    );
    expect(deletedUser.rows[0]).toEqual(expect.objectContaining({
      is_deleted: true,
      password_hash: 'deleted-account-disabled',
      is_email_verified: false,
      accepted_terms: false,
    }));
    expect(deletedUser.rows[0].email).not.toBe(validUser.email);
    expect(deletedUser.rows[0].email).toMatch(/^deleted\+[a-f0-9]{32}@deleted\.invalid$/);

    const deletedProfile = await query(
      `SELECT first_name, last_name, phone_number FROM user_profiles WHERE user_id = $1`,
      [userId],
    );
    expect(deletedProfile.rows[0]).toEqual({
      first_name: null,
      last_name: null,
      phone_number: null,
    });

    const deletedLocationProfile = await query(
      `SELECT address, city, country, latitude, longitude, display_address, place_id
       FROM location_profiles WHERE profile_id = $1`,
      [profileId],
    );
    expect(deletedLocationProfile.rows[0]).toEqual(expect.objectContaining({
      address: null,
      city: null,
      country: null,
      latitude: null,
      longitude: null,
      display_address: null,
      place_id: null,
    }));

    const deletedOwnedRequest = await query(
      `SELECT user_id, status, contact_full_name, contact_phone, consent_given, description
       FROM help_requests WHERE request_id = $1`,
      [ownedRequestId],
    );
    expect(deletedOwnedRequest.rows[0]).toEqual(expect.objectContaining({
      user_id: null,
      status: 'CANCELLED',
      contact_full_name: null,
      contact_phone: null,
      consent_given: false,
      description: null,
    }));

    const deletedRequestLocation = await query(
      `SELECT country, city, district, latitude, longitude, is_gps_location, is_last_known
       FROM request_locations WHERE request_id = $1`,
      [ownedRequestId],
    );
    expect(deletedRequestLocation.rows[0]).toEqual(expect.objectContaining({
      country: null,
      city: null,
      district: null,
      latitude: null,
      longitude: null,
      is_gps_location: false,
      is_last_known: false,
    }));

    const volunteer = await query(
      `SELECT is_available, last_known_latitude, last_known_longitude, available_until
       FROM volunteers WHERE volunteer_id = $1`,
      [volunteerId],
    );
    expect(volunteer.rows[0]).toEqual(expect.objectContaining({
      is_available: false,
      last_known_latitude: null,
      last_known_longitude: null,
      available_until: null,
    }));

    const deletedVolunteerAssignment = await query(
      `SELECT is_cancelled FROM assignments WHERE assignment_id = 'assignment-delete-test'`,
    );
    expect(deletedVolunteerAssignment.rows[0].is_cancelled).toBe(true);

    const activeAssignments = await query(
      `SELECT COUNT(*)::int AS count FROM assignments WHERE volunteer_id = $1 AND is_cancelled = FALSE`,
      [volunteerId],
    );
    expect(activeAssignments.rows[0].count).toBe(0);

    const remainingVolunteerAssignment = await query(
      `SELECT is_cancelled FROM assignments WHERE assignment_id = 'assignment-other-volunteer-delete-test'`,
    );
    expect(remainingVolunteerAssignment.rows[0].is_cancelled).toBe(false);

    const activeAssignmentsForRequest = await query(
      `SELECT COUNT(*)::int AS count FROM assignments WHERE request_id = $1 AND is_cancelled = FALSE`,
      [assignedRequestId],
    );
    expect(activeAssignmentsForRequest.rows[0].count).toBe(1);

    const assignedRequest = await query(
      `SELECT status FROM help_requests WHERE request_id = $1`,
      [assignedRequestId],
    );
    expect(assignedRequest.rows[0].status).toBe('ASSIGNED');

    const availabilityRecord = await query(
      `SELECT COUNT(*)::int AS count FROM availability_records
       WHERE volunteer_id = $1 AND is_available = FALSE`,
      [volunteerId],
    );
    expect(availabilityRecord.rows[0].count).toBeGreaterThan(0);

    const operationalLocations = await query(
      `SELECT COUNT(*)::int AS count FROM user_operational_locations WHERE user_id = $1`,
      [userId],
    );
    expect(operationalLocations.rows[0].count).toBe(0);

    const oldTokenRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(oldTokenRes.status).toBe(401);
  });
});

// ─── GET /api/auth/verify-email ──────────────────────────────────────────────

describe('GET /api/auth/verify-email', () => {
  test('400 - missing token', async () => {
    const app = createTestApp();
    const res = await request(app).get('/api/auth/verify-email');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('400 - invalid token', async () => {
    const app = createTestApp();
    const res = await request(app)
      .get('/api/auth/verify-email')
      .query({ token: 'invalidtoken' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_VERIFICATION_TOKEN');
  });

  test('200 - email verified successfully', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);

    const userRow = await query(`SELECT user_id FROM users WHERE email = $1`, [validUser.email]);
    const userId = userRow.rows[0].user_id;

    const token = jwt.sign(
      { type: 'email-verification', userId, email: validUser.email },
      process.env.JWT_SECRET || 'dev-secret-123',
      { expiresIn: '1d' }
    );

    const res = await request(app)
      .get('/api/auth/verify-email')
      .query({ token });
    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
  });

  test('403 - banned user cannot get access token via verify-email', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);

    const userRow = await query(`SELECT user_id FROM users WHERE email = $1`, [validUser.email]);
    const userId = userRow.rows[0].user_id;

    await query(
      `UPDATE users SET is_banned = TRUE, ban_reason = 'Abuse', banned_at = NOW() WHERE user_id = $1`,
      [userId],
    );

    const token = jwt.sign(
      { type: 'email-verification', userId, email: validUser.email },
      process.env.JWT_SECRET || 'dev-secret-123',
      { expiresIn: '1d' }
    );

    const res = await request(app)
      .get('/api/auth/verify-email')
      .query({ token });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('USER_BANNED');
    expect(res.body.accessToken).toBeUndefined();
  });
});

// ─── POST /api/auth/resend-verification ──────────────────────────────────────

describe('POST /api/auth/resend-verification', () => {
  test('400 - missing email', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/auth/resend-verification').send({});
    expect(res.status).toBe(400);
  });

  test('400 - user not found', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/auth/resend-verification')
      .send({ email: 'nonexistent@test.com' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('USER_NOT_FOUND');
  });

  test('400 - already verified', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);
    await query(`UPDATE users SET is_email_verified = TRUE WHERE email = $1`, [validUser.email]);

    const res = await request(app)
      .post('/api/auth/resend-verification')
      .send({ email: validUser.email });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EMAIL_ALREADY_VERIFIED');
  });

  test('200 - resend successful', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);

    const res = await request(app)
      .post('/api/auth/resend-verification')
      .send({ email: validUser.email });
    expect(res.status).toBe(200);
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  test('401 - no token', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });

  test('200 - logout successful', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);
    await query(`UPDATE users SET is_email_verified = TRUE WHERE email = $1`, [validUser.email]);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: validUser.email,
      password: validUser.password,
    });
    const token = loginRes.body.accessToken;

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
  });
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
  test('400 - missing email', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });

  test('404 - user not found', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nonexistent@test.com' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('USER_NOT_FOUND');
  });

  test('200 - reset email sent', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: validUser.email });
    expect(res.status).toBe(200);
  });
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────

describe('POST /api/auth/reset-password', () => {
  test('400 - missing token', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ newPassword: '12345678' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('400 - invalid token', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'invalidtoken', newPassword: '12345678' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_RESET_TOKEN');
  });

  test('400 - password too short', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'sometoken', newPassword: '123' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('200 - password reset successful', async () => {
    const app = createTestApp();
    await request(app).post('/api/auth/signup').send(validUser);

    const userRow = await query(`SELECT user_id FROM users WHERE email = $1`, [validUser.email]);
    const userId = userRow.rows[0].user_id;

    const token = jwt.sign(
      { type: 'password-reset', userId, email: validUser.email },
      process.env.JWT_SECRET || 'dev-secret-123',
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'newpassword123' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
  });
});
