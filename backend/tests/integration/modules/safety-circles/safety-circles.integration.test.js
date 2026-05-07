'use strict';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const { safetyCirclesRouter } = require('../../../../src/modules/safety-circles/routes');
const { safetyStatusRouter } = require('../../../../src/modules/safety-status/routes');
const { query } = require('../../../../src/db/pool');

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/safety-circles', safetyCirclesRouter);
  app.use('/api/safety-status', safetyStatusRouter);
  return app;
}

function buildAuthToken(userId, overrides = {}) {
  return jwt.sign(
    {
      userId,
      email: `${userId}@example.com`,
      isAdmin: false,
      adminRole: null,
      ...overrides,
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

async function seedProfile(userId, options = {}) {
  const profileId = `prf_${userId}`;
  await query(
    `
      INSERT INTO user_profiles (profile_id, user_id, first_name, last_name, phone_number)
      VALUES ($1, $2, $3, $4, '5301234567');
    `,
    [profileId, userId, options.firstName || 'Circle', options.lastName || 'User'],
  );

  await query(
    `
      INSERT INTO privacy_settings (
        settings_id,
        profile_id,
        profile_visibility,
        health_info_visibility,
        location_visibility,
        location_sharing_enabled
      )
      VALUES ($1, $2, $3, 'PRIVATE', $4, $5);
    `,
    [
      `priv_${userId}`,
      profileId,
      options.profileVisibility || 'PRIVATE',
      options.locationVisibility || 'PRIVATE',
      Boolean(options.locationSharingEnabled),
    ],
  );
}

beforeEach(async () => {
  await query(`
    TRUNCATE TABLE
      safety_circle_invites,
      safety_circle_members,
      safety_circles,
      user_safety_statuses,
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

describe('safety-circles integration', () => {
  test('user can create a circle and sees an empty accepted member list besides owner', async () => {
    const app = createTestApp();
    const ownerId = 'circle_owner';
    await seedActiveUser(ownerId);
    await seedProfile(ownerId, { firstName: 'Circle', lastName: 'Owner' });

    const createResponse = await request(app)
      .post('/api/safety-circles')
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`)
      .send({ name: 'My Family' });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.circle).toMatchObject({
      name: 'My Family',
      ownerUserId: ownerId,
      memberCount: 1,
    });

    const circleId = createResponse.body.circle.circleId;
    const detailResponse = await request(app)
      .get(`/api/safety-circles/${circleId}`)
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.members).toEqual([
      expect.objectContaining({
        userId: ownerId,
        displayName: 'Circle Owner',
        role: 'owner',
        status: 'unknown',
        lastCheckedInAt: null,
      }),
    ]);
    expect(detailResponse.body.currentUserRole).toBe('owner');
  });

  test('invitee can accept an invite and both members see latest safety statuses', async () => {
    const app = createTestApp();
    const ownerId = 'circle_owner_accept';
    const inviteeId = 'circle_invitee_accept';
    await seedActiveUser(ownerId);
    await seedActiveUser(inviteeId, 'invitee@example.com');
    await seedProfile(ownerId, { firstName: 'First', lastName: 'User' });
    await seedProfile(inviteeId, {
      firstName: 'Second',
      lastName: 'User',
      locationVisibility: 'EMERGENCY_ONLY',
      locationSharingEnabled: true,
    });

    const circleResponse = await request(app)
      .post('/api/safety-circles')
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`)
      .send({ name: 'My Family' })
      .expect(201);
    const circleId = circleResponse.body.circle.circleId;

    const inviteResponse = await request(app)
      .post(`/api/safety-circles/${circleId}/invites`)
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`)
      .send({ inviteeEmail: 'invitee@example.com' })
      .expect(201);

    await request(app)
      .post(`/api/safety-circles/invites/${inviteResponse.body.invite.inviteId}/respond`)
      .set('Authorization', `Bearer ${buildAuthToken(inviteeId)}`)
      .send({ decision: 'accept' })
      .expect(200);

    await request(app)
      .patch(`/api/safety-circles/${circleId}/check-in`)
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`)
      .send({ status: 'safe', note: 'With family' })
      .expect(200);

    await request(app)
      .patch(`/api/safety-circles/${circleId}/check-in`)
      .set('Authorization', `Bearer ${buildAuthToken(inviteeId)}`)
      .send({
        status: 'not_safe',
        shareLocationConsent: true,
        location: {
          latitude: 41.043,
          longitude: 29.009,
          accuracyMeters: 12,
          source: 'GPS',
          capturedAt: '2026-05-02T12:00:00.000Z',
        },
      })
      .expect(200);

    const detailResponse = await request(app)
      .get(`/api/safety-circles/${circleId}`)
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`)
      .expect(200);

    const byUserId = Object.fromEntries(detailResponse.body.members.map((member) => [member.userId, member]));
    expect(byUserId[ownerId]).toMatchObject({
      displayName: 'First User',
      status: 'safe',
      note: 'With family',
    });
    expect(byUserId[ownerId].lastCheckedInAt).toBeTruthy();
    expect(byUserId[inviteeId]).toMatchObject({
      displayName: 'Second User',
      emergencyContact: {
        phoneNumber: '5301234567',
      },
      status: 'not_safe',
      location: {
        latitude: 41.043,
        longitude: 29.009,
      },
    });
  });

  test('invitee can reject and is not visible as an accepted member', async () => {
    const app = createTestApp();
    const ownerId = 'circle_owner_reject';
    const inviteeId = 'circle_invitee_reject';
    await seedActiveUser(ownerId);
    await seedActiveUser(inviteeId);

    const circleResponse = await request(app)
      .post('/api/safety-circles')
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`)
      .send({ name: 'Neighbors' })
      .expect(201);

    const inviteResponse = await request(app)
      .post(`/api/safety-circles/${circleResponse.body.circle.circleId}/invites`)
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`)
      .send({ inviteeUserId: inviteeId })
      .expect(201);

    await request(app)
      .post(`/api/safety-circles/invites/${inviteResponse.body.invite.inviteId}/respond`)
      .set('Authorization', `Bearer ${buildAuthToken(inviteeId)}`)
      .send({ decision: 'reject' })
      .expect(200);

    const detailResponse = await request(app)
      .get(`/api/safety-circles/${circleResponse.body.circle.circleId}`)
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`)
      .expect(200);

    expect(detailResponse.body.members.map((member) => member.userId)).not.toContain(inviteeId);
  });

  test('unauthorized users cannot view private circle information', async () => {
    const app = createTestApp();
    const ownerId = 'circle_owner_private';
    const strangerId = 'circle_stranger';
    await seedActiveUser(ownerId);
    await seedActiveUser(strangerId);

    const circleResponse = await request(app)
      .post('/api/safety-circles')
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`)
      .send({ name: 'Private Circle' })
      .expect(201);

    const response = await request(app)
      .get(`/api/safety-circles/${circleResponse.body.circle.circleId}`)
      .set('Authorization', `Bearer ${buildAuthToken(strangerId)}`);

    expect(response.status).toBe(404);
  });

  test('circle members make private safety statuses visible without exposing private locations', async () => {
    const app = createTestApp();
    const ownerId = 'circle_owner_visible';
    const memberId = 'circle_member_visible';
    const strangerId = 'circle_stranger_visible';
    await seedActiveUser(ownerId);
    await seedActiveUser(memberId);
    await seedActiveUser(strangerId);
    await seedProfile(memberId, {
      firstName: 'Private',
      lastName: 'Member',
      profileVisibility: 'PRIVATE',
      locationVisibility: 'PRIVATE',
      locationSharingEnabled: true,
    });

    const circleResponse = await request(app)
      .post('/api/safety-circles')
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`)
      .send({ name: 'Trusted' })
      .expect(201);
    const circleId = circleResponse.body.circle.circleId;

    const inviteResponse = await request(app)
      .post(`/api/safety-circles/${circleId}/invites`)
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`)
      .send({ inviteeUserId: memberId })
      .expect(201);

    await request(app)
      .post(`/api/safety-circles/invites/${inviteResponse.body.invite.inviteId}/respond`)
      .set('Authorization', `Bearer ${buildAuthToken(memberId)}`)
      .send({ decision: 'accept' })
      .expect(200);

    await request(app)
      .patch('/api/safety-status/me')
      .set('Authorization', `Bearer ${buildAuthToken(memberId)}`)
      .send({
        status: 'not_safe',
        shareLocationConsent: true,
        location: { latitude: 41.04, longitude: 29.01 },
      })
      .expect(200);

    const ownerVisible = await request(app)
      .get('/api/safety-status/visible')
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`)
      .expect(200);
    const ownerByUserId = Object.fromEntries(ownerVisible.body.safetyStatuses.map((item) => [item.userId, item]));
    expect(ownerByUserId[memberId]).toMatchObject({
      displayName: 'Private Member',
      status: 'not_safe',
      location: null,
    });

    const strangerVisible = await request(app)
      .get('/api/safety-status/visible')
      .set('Authorization', `Bearer ${buildAuthToken(strangerId)}`)
      .expect(200);
    const strangerUserIds = strangerVisible.body.safetyStatuses.map((item) => item.userId);
    expect(strangerUserIds).not.toContain(memberId);
  });

  test('member can leave a circle but owner cannot leave as the last authority', async () => {
    const app = createTestApp();
    const ownerId = 'circle_owner_leave';
    const memberId = 'circle_member_leave';
    await seedActiveUser(ownerId);
    await seedActiveUser(memberId);

    const circleResponse = await request(app)
      .post('/api/safety-circles')
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`)
      .send({ name: 'Leave Test' })
      .expect(201);
    const circleId = circleResponse.body.circle.circleId;

    const inviteResponse = await request(app)
      .post(`/api/safety-circles/${circleId}/invites`)
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`)
      .send({ inviteeUserId: memberId })
      .expect(201);

    await request(app)
      .post(`/api/safety-circles/invites/${inviteResponse.body.invite.inviteId}/respond`)
      .set('Authorization', `Bearer ${buildAuthToken(memberId)}`)
      .send({ decision: 'accept' })
      .expect(200);

    await request(app)
      .delete(`/api/safety-circles/${circleId}/members/me`)
      .set('Authorization', `Bearer ${buildAuthToken(memberId)}`)
      .expect(200);

    const ownerLeaveResponse = await request(app)
      .delete(`/api/safety-circles/${circleId}/members/me`)
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`);

    expect(ownerLeaveResponse.status).toBe(409);
  });

  test('owner can transfer ownership to an accepted member', async () => {
    const app = createTestApp();
    const ownerId = 'circle_owner_transfer';
    const memberId = 'circle_member_transfer';
    await seedActiveUser(ownerId);
    await seedActiveUser(memberId);

    const circleResponse = await request(app)
      .post('/api/safety-circles')
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`)
      .send({ name: 'Transfer Test' })
      .expect(201);
    const circleId = circleResponse.body.circle.circleId;

    const inviteResponse = await request(app)
      .post(`/api/safety-circles/${circleId}/invites`)
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`)
      .send({ inviteeUserId: memberId })
      .expect(201);

    await request(app)
      .post(`/api/safety-circles/invites/${inviteResponse.body.invite.inviteId}/respond`)
      .set('Authorization', `Bearer ${buildAuthToken(memberId)}`)
      .send({ decision: 'accept' })
      .expect(200);

    const transferResponse = await request(app)
      .patch(`/api/safety-circles/${circleId}/owner`)
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`)
      .send({ nextOwnerUserId: memberId })
      .expect(200);

    expect(transferResponse.body.circle.ownerUserId).toBe(memberId);
    expect(transferResponse.body.currentUserRole).toBe('member');
    const roles = Object.fromEntries(transferResponse.body.members.map((member) => [member.userId, member.role]));
    expect(roles[ownerId]).toBe('member');
    expect(roles[memberId]).toBe('owner');

    await request(app)
      .delete(`/api/safety-circles/${circleId}/members/me`)
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`)
      .expect(200);
  });

  test('ownership transfer rejects non-owners, self-transfer, and non-members', async () => {
    const app = createTestApp();
    const ownerId = 'circle_owner_transfer_reject';
    const memberId = 'circle_member_transfer_reject';
    const strangerId = 'circle_stranger_transfer_reject';
    await seedActiveUser(ownerId);
    await seedActiveUser(memberId);
    await seedActiveUser(strangerId);

    const circleResponse = await request(app)
      .post('/api/safety-circles')
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`)
      .send({ name: 'Rejected Transfer Test' })
      .expect(201);
    const circleId = circleResponse.body.circle.circleId;

    const inviteResponse = await request(app)
      .post(`/api/safety-circles/${circleId}/invites`)
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`)
      .send({ inviteeUserId: memberId })
      .expect(201);

    await request(app)
      .post(`/api/safety-circles/invites/${inviteResponse.body.invite.inviteId}/respond`)
      .set('Authorization', `Bearer ${buildAuthToken(memberId)}`)
      .send({ decision: 'accept' })
      .expect(200);

    await request(app)
      .patch(`/api/safety-circles/${circleId}/owner`)
      .set('Authorization', `Bearer ${buildAuthToken(memberId)}`)
      .send({ nextOwnerUserId: ownerId })
      .expect(403);

    await request(app)
      .patch(`/api/safety-circles/${circleId}/owner`)
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`)
      .send({ nextOwnerUserId: ownerId })
      .expect(409);

    await request(app)
      .patch(`/api/safety-circles/${circleId}/owner`)
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`)
      .send({ nextOwnerUserId: strangerId })
      .expect(409);
  });

  test('only the owner can delete a circle', async () => {
    const app = createTestApp();
    const ownerId = 'circle_owner_delete';
    const memberId = 'circle_member_delete';
    await seedActiveUser(ownerId);
    await seedActiveUser(memberId);

    const circleResponse = await request(app)
      .post('/api/safety-circles')
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`)
      .send({ name: 'Delete Test' })
      .expect(201);
    const circleId = circleResponse.body.circle.circleId;

    const inviteResponse = await request(app)
      .post(`/api/safety-circles/${circleId}/invites`)
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`)
      .send({ inviteeUserId: memberId })
      .expect(201);

    await request(app)
      .post(`/api/safety-circles/invites/${inviteResponse.body.invite.inviteId}/respond`)
      .set('Authorization', `Bearer ${buildAuthToken(memberId)}`)
      .send({ decision: 'accept' })
      .expect(200);

    await request(app)
      .delete(`/api/safety-circles/${circleId}`)
      .set('Authorization', `Bearer ${buildAuthToken(memberId)}`)
      .expect(403);

    await request(app)
      .delete(`/api/safety-circles/${circleId}`)
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`)
      .expect(200);

    await request(app)
      .get(`/api/safety-circles/${circleId}`)
      .set('Authorization', `Bearer ${buildAuthToken(ownerId)}`)
      .expect(404);
  });
});
