'use strict';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const { helpRequestsRouter } = require('../../../../src/modules/help-requests/routes');
const { availabilityRouter } = require('../../../../src/modules/availability/routes');
const { query } = require('../../../../src/db/pool');

function createTestApp() {
	const app = express();
	app.use(express.json());
	app.use('/api/help-requests', helpRequestsRouter);
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

function buildCreatePayload(overrides = {}) {
	return {
		helpTypes: ['first_aid', 'fire_brigade'],
		otherHelpText: '',
		affectedPeopleCount: 3,
		riskFlags: ['fire', 'electric_hazard'],
		vulnerableGroups: ['children', 'pregnant'],
		description: 'Apartment entrance blocked, one person bleeding.',
		bloodType: 'A+',
		location: {
			country: 'turkiye',
			city: 'istanbul',
			district: 'besiktas',
			neighborhood: 'levazim',
			extraAddress: 'Bina B, 3. kat, arka giris',
		},
		contact: {
			fullName: 'Ayse Yilmaz',
			phone: 5052318546,
			alternativePhone: 5321234567,
		},
		consentGiven: true,
		...overrides,
	};
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

async function seedAssignedRequestForVolunteer({ requestId, requesterUserId, volunteerId }) {
	await query(
		`
			INSERT INTO help_requests (
				request_id,
				user_id,
				help_types,
				need_type,
				description,
				status,
				contact_full_name,
				contact_phone
			)
			VALUES ($1, $2, ARRAY['food'], 'food', 'Existing assignment', 'ASSIGNED', 'Busy Person', 5550000000);
		`,
		[requestId, requesterUserId],
	);

	await query(
		`
			INSERT INTO assignments (assignment_id, volunteer_id, request_id, assigned_at, is_cancelled)
			VALUES ($1, $2, $3, CURRENT_TIMESTAMP, FALSE);
		`,
		[`asg_${requestId}`, volunteerId, requestId],
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
}, 15000);

describe('help-requests integration', () => {
	test('POST /api/help-requests creates request as guest without token', async () => {
		const app = createTestApp();

		const response = await request(app)
			.post('/api/help-requests')
			.send(buildCreatePayload());

		expect(response.status).toBe(201);
		expect(response.body.guestAccessToken).toEqual(expect.any(String));
		expect(response.body.request.userId).toBeNull();
		expect(response.body.request.helpTypes).toEqual(['first_aid', 'fire_brigade']);
		expect(response.body.request.contact.fullName).toBe('Ayse Yilmaz');
		expect(response.body.request.status).toBe('SYNCED');
	});

	test('guest-created request is visible in helper assignment endpoints', async () => {
		const app = createTestApp();
		const helperId = 'user_hr_guest_helper';
		await seedActiveUser(helperId, 'guesthelper@example.com');
		const helperToken = buildAuthToken(helperId);

		const createRes = await request(app)
			.post('/api/help-requests')
			.send(buildCreatePayload());

		expect(createRes.status).toBe(201);
		expect(createRes.body.request.userId).toBeNull();

		const toggleRes = await request(app)
			.post('/api/availability/toggle')
			.set('Authorization', `Bearer ${helperToken}`)
			.send({ isAvailable: true });

		expect(toggleRes.status).toBe(200);
		expect(toggleRes.body.assignment).toBeTruthy();
		expect(toggleRes.body.assignment.request_id).toBe(createRes.body.request.id);
		expect(toggleRes.body.assignment.requester_email).toBeNull();

		const assignmentRes = await request(app)
			.get('/api/availability/my-assignment')
			.set('Authorization', `Bearer ${helperToken}`);

		expect(assignmentRes.status).toBe(200);
		expect(assignmentRes.body.assignment).toBeTruthy();
		expect(assignmentRes.body.assignment.request_id).toBe(createRes.body.request.id);
		expect(assignmentRes.body.assignment.requester_email).toBeNull();
	});

	test('POST /api/help-requests creates request with the new payload shape', async () => {
		const app = createTestApp();
		const userId = 'user_hr_1';
		await seedActiveUser(userId, 'hr1@example.com');
		const token = buildAuthToken(userId);

		const payload = buildCreatePayload();
		const response = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${token}`)
			.send(payload);

		expect(response.status).toBe(201);
		expect(response.body.request.userId).toBe(userId);
		expect(response.body.request.helpTypes).toEqual(payload.helpTypes);
		expect(response.body.request.otherHelpText).toBe(payload.otherHelpText);
		expect(response.body.request.affectedPeopleCount).toBe(payload.affectedPeopleCount);
		expect(response.body.request.riskFlags).toEqual(payload.riskFlags);
		expect(response.body.request.vulnerableGroups).toEqual(payload.vulnerableGroups);
		expect(response.body.request.bloodType).toBe(payload.bloodType);
		expect(response.body.request.location).toEqual(payload.location);
		expect(response.body.request.location).not.toHaveProperty('coordinate');
		expect(response.body.request.location).not.toHaveProperty('latitude');
		expect(response.body.request.location).not.toHaveProperty('longitude');
		expect(response.body.request.contact).toEqual(payload.contact);
		expect(response.body.request.consentGiven).toBe(true);
		expect(response.body.request.needType).toBe('first_aid');
		expect(response.body.request.status).toBe('SYNCED');
		expect(response.body.request.isSavedLocally).toBe(false);
		expect(response.body.warnings).toEqual([]);
	});

	test('POST /api/help-requests trims optional string fields and preserves numeric phones', async () => {
		const app = createTestApp();
		const userId = 'user_hr_2';
		await seedActiveUser(userId, 'hr2@example.com');
		const token = buildAuthToken(userId);

		const payload = buildCreatePayload({
			otherHelpText: '  generator needed  ',
			bloodType: '  A+  ',
			location: {
				country: 'turkiye',
				city: 'istanbul',
				district: 'besiktas',
				neighborhood: 'levazim',
				extraAddress: '  Need entry from the back  ',
			},
			contact: {
				fullName: 'Ayse Yilmaz',
				phone: 5052318546,
				alternativePhone: 5321234567,
			},
		});

		const response = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${token}`)
			.send(payload);

		expect(response.status).toBe(201);
		expect(response.body.request.otherHelpText).toBe('generator needed');
		expect(response.body.request.bloodType).toBe('A+');
		expect(response.body.request.location.extraAddress).toBe('Need entry from the back');
		expect(response.body.request.contact.phone).toBe(5052318546);
		expect(response.body.request.contact.alternativePhone).toBe(5321234567);
	});

	test('POST /api/help-requests accepts hybrid location payload with coordinate object', async () => {
		const app = createTestApp();
		const userId = 'user_hr_hybrid_1';
		await seedActiveUser(userId, 'hrhybrid1@example.com');
		const token = buildAuthToken(userId);

		const payload = buildCreatePayload({
			location: {
				country: 'turkiye',
				city: 'istanbul',
				district: 'besiktas',
				neighborhood: 'levazim',
				extraAddress: 'Bina B',
				displayAddress: 'Levazim, Besiktas, Bina B',
				coordinate: {
					latitude: 41.043,
					longitude: 29.009,
					source: 'MANUAL_MAP_PIN',
					capturedAt: '2026-04-18T11:20:00.000Z',
				},
			},
		});

		const response = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${token}`)
			.send(payload);

		expect(response.status).toBe(201);
		expect(response.body.request.location.country).toBe('turkiye');
		expect(response.body.request.location.city).toBe('istanbul');
		expect(response.body.request.location.latitude).toBeCloseTo(41.043, 6);
		expect(response.body.request.location.longitude).toBeCloseTo(29.009, 6);
		expect(response.body.request.location.coordinate).toBeTruthy();
		expect(response.body.request.location).toHaveProperty('coordinate');
		expect(response.body.request.location).toHaveProperty('latitude');
		expect(response.body.request.location).toHaveProperty('longitude');
		expect(response.body.request.location.coordinate.latitude).toBeCloseTo(41.043, 6);
		expect(response.body.request.location.coordinate.longitude).toBeCloseTo(29.009, 6);
		expect(response.body.request.location.coordinate.source).toBeNull();
		expect(response.body.request.location.coordinate.capturedAt).toEqual(expect.any(String));
		expect(response.body.request.location.extraAddress).toBe('Levazim, Besiktas, Bina B');
	});

	test('POST /api/help-requests returns 400 for invalid payload', async () => {
		const app = createTestApp();
		const userId = 'user_hr_3';
		await seedActiveUser(userId, 'hr3@example.com');
		const token = buildAuthToken(userId);

		const response = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${token}`)
			.send(buildCreatePayload({ consentGiven: false }));

		expect(response.status).toBe(400);
		expect(response.body.code).toBe('VALIDATION_FAILED');
	});

	test('POST /api/help-requests returns 400 for invalid contact phone', async () => {
		const app = createTestApp();
		const userId = 'user_hr_3b';
		await seedActiveUser(userId, 'hr3b@example.com');
		const token = buildAuthToken(userId);

		const response = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${token}`)
			.send(buildCreatePayload({
				contact: {
					fullName: 'Ayse Yilmaz',
					phone: 4052318546,
					alternativePhone: 5321234567,
				},
			}));

		expect(response.status).toBe(400);
		expect(response.body.code).toBe('VALIDATION_FAILED');
		expect(response.body.details).toContain('`contact.phone` must be a 10-digit integer starting with 5.');
	});

	test('POST /api/help-requests returns 400 for invalid location', async () => {
		const app = createTestApp();
		const userId = 'user_hr_4';
		await seedActiveUser(userId, 'hr4@example.com');
		const token = buildAuthToken(userId);

		const response = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${token}`)
			.send(buildCreatePayload({
				location: {
					country: 'turkiye',
					city: '',
					district: 'besiktas',
					neighborhood: 'levazim',
					extraAddress: '',
				},
			}));

		expect(response.status).toBe(400);
		expect(response.body.code).toBe('VALIDATION_FAILED');
	});

	test('GET /api/help-requests returns 401 without token', async () => {
		const app = createTestApp();

		const response = await request(app)
			.get('/api/help-requests');

		expect(response.status).toBe(401);
	});

	test('GET /api/help-requests lists only current user requests', async () => {
		const app = createTestApp();
		const userId1 = 'user_hr_5';
		const userId2 = 'user_hr_6';
		await seedActiveUser(userId1, 'hr5@example.com');
		await seedActiveUser(userId2, 'hr6@example.com');
		const token1 = buildAuthToken(userId1);
		const token2 = buildAuthToken(userId2);

		await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${token1}`)
			.send(buildCreatePayload({ helpTypes: ['food'] }));

		await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${token1}`)
			.send(buildCreatePayload({ helpTypes: ['water'] }));

		await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${token2}`)
			.send(buildCreatePayload({ helpTypes: ['shelter'] }));

		const response1 = await request(app)
			.get('/api/help-requests')
			.set('Authorization', `Bearer ${token1}`);

		expect(response1.status).toBe(200);
		expect(response1.body.requests).toHaveLength(2);

		const response2 = await request(app)
			.get('/api/help-requests')
			.set('Authorization', `Bearer ${token2}`);

		expect(response2.status).toBe(200);
		expect(response2.body.requests).toHaveLength(1);
	});

	test('GET /api/help-requests/:requestId returns single request', async () => {
		const app = createTestApp();
		const userId = 'user_hr_7';
		await seedActiveUser(userId, 'hr7@example.com');
		const token = buildAuthToken(userId);

		const createResponse = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${token}`)
			.send(buildCreatePayload({ description: 'broken leg' }));

		const requestId = createResponse.body.request.id;

		const response = await request(app)
			.get(`/api/help-requests/${requestId}`)
			.set('Authorization', `Bearer ${token}`);

		expect(response.status).toBe(200);
		expect(response.body.request.id).toBe(requestId);
		expect(response.body.request.description).toBe('broken leg');
		expect(response.body.request.helpTypes).toEqual(['first_aid', 'fire_brigade']);
	});

	test('GET /api/help-requests/:requestId returns 401 without auth and guest token', async () => {
		const app = createTestApp();

		const createResponse = await request(app)
			.post('/api/help-requests')
			.send(buildCreatePayload());

		const response = await request(app)
			.get(`/api/help-requests/${createResponse.body.request.id}`);

		expect(response.status).toBe(401);
		expect(response.body.code).toBe('UNAUTHORIZED');
	});

	test('GET /api/help-requests/:requestId allows guest access with guest token', async () => {
		const app = createTestApp();

		const createResponse = await request(app)
			.post('/api/help-requests')
			.send(buildCreatePayload({ description: 'guest can read this' }));

		const requestId = createResponse.body.request.id;
		const guestAccessToken = createResponse.body.guestAccessToken;

		expect(guestAccessToken).toEqual(expect.any(String));

		const response = await request(app)
			.get(`/api/help-requests/${requestId}`)
			.set('x-help-request-access-token', guestAccessToken);

		expect(response.status).toBe(200);
		expect(response.body.request.id).toBe(requestId);
		expect(response.body.request.userId).toBeNull();
		expect(response.body.request.description).toBe('guest can read this');
	});

	test('GET /api/help-requests/:requestId returns 403 with mismatched guest token', async () => {
		const app = createTestApp();

		const firstCreate = await request(app)
			.post('/api/help-requests')
			.send(buildCreatePayload({ description: 'first guest request' }));

		const secondCreate = await request(app)
			.post('/api/help-requests')
			.send(buildCreatePayload({ description: 'second guest request' }));

		const response = await request(app)
			.get(`/api/help-requests/${secondCreate.body.request.id}`)
			.set('x-help-request-access-token', firstCreate.body.guestAccessToken);

		expect(response.status).toBe(403);
		expect(response.body.code).toBe('FORBIDDEN');
	});

	test('GET /api/help-requests/:requestId returns 404 for nonexistent request', async () => {
		const app = createTestApp();
		const userId = 'user_hr_8';
		await seedActiveUser(userId, 'hr8@example.com');
		const token = buildAuthToken(userId);

		const response = await request(app)
			.get('/api/help-requests/nonexistent')
			.set('Authorization', `Bearer ${token}`);

		expect(response.status).toBe(404);
	});

	test('GET /api/help-requests/:requestId returns 404 for another user request', async () => {
		const app = createTestApp();
		const userId1 = 'user_hr_9';
		const userId2 = 'user_hr_10';
		await seedActiveUser(userId1, 'hr9@example.com');
		await seedActiveUser(userId2, 'hr10@example.com');
		const token1 = buildAuthToken(userId1);
		const token2 = buildAuthToken(userId2);

		const createResponse = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${token1}`)
			.send(buildCreatePayload({ helpTypes: ['food'] }));

		const requestId = createResponse.body.request.id;

		const response = await request(app)
			.get(`/api/help-requests/${requestId}`)
			.set('Authorization', `Bearer ${token2}`);

		expect(response.status).toBe(404);
	});

	test('PATCH /:id/status allows guest to resolve their own request with guest token', async () => {
		const app = createTestApp();

		const createResponse = await request(app)
			.post('/api/help-requests')
			.send(buildCreatePayload({ description: 'guest will resolve this' }));

		const requestId = createResponse.body.request.id;
		const guestAccessToken = createResponse.body.guestAccessToken;

		const patchResponse = await request(app)
			.patch(`/api/help-requests/${requestId}/status`)
			.set('x-help-request-access-token', guestAccessToken)
			.send({ status: 'RESOLVED' });

		expect(patchResponse.status).toBe(200);
		expect(patchResponse.body.request.status).toBe('RESOLVED');
		expect(patchResponse.body.request.resolvedAt).toBeTruthy();

		const getResponse = await request(app)
			.get(`/api/help-requests/${requestId}`)
			.set('x-help-request-access-token', guestAccessToken);

		expect(getResponse.status).toBe(200);
		expect(getResponse.body.request.status).toBe('RESOLVED');
	});

	test('PATCH /:id/status guest resolve clears active assignments and frees volunteers for future matches', async () => {
		const app = createTestApp();
		const helperOneId = 'user_hr_guest_resolve_helper_1';
		await seedActiveUser(helperOneId, 'guestresolvehelper1@example.com');
		const helperOneToken = buildAuthToken(helperOneId);

		const firstCreate = await request(app)
			.post('/api/help-requests')
			.send(buildCreatePayload({ description: 'guest request that will be resolved' }));

		const firstRequestId = firstCreate.body.request.id;

		const firstToggle = await request(app)
			.post('/api/availability/toggle')
			.set('Authorization', `Bearer ${helperOneToken}`)
			.send({ isAvailable: true });

		expect(firstToggle.status).toBe(200);
		expect(firstToggle.body.assignment.request_id).toBe(firstRequestId);

		const resolveResponse = await request(app)
			.patch(`/api/help-requests/${firstRequestId}/status`)
			.set('x-help-request-access-token', firstCreate.body.guestAccessToken)
			.send({ status: 'RESOLVED' });

		expect(resolveResponse.status).toBe(200);
		expect(resolveResponse.body.request.status).toBe('RESOLVED');

		const staleAssignments = await query(
			`SELECT assignment_id FROM assignments WHERE request_id = $1 AND is_cancelled = FALSE`,
			[firstRequestId],
		);
		expect(staleAssignments.rows).toHaveLength(0);

		const helperOneStatus = await request(app)
			.get('/api/availability/status')
			.set('Authorization', `Bearer ${helperOneToken}`);

		expect(helperOneStatus.status).toBe(200);
		expect(helperOneStatus.body.assignment).toBeNull();

		const secondCreate = await request(app)
			.post('/api/help-requests')
			.send(buildCreatePayload({ description: 'guest request after resolve cleanup' }));

		const secondRequestId = secondCreate.body.request.id;

		const helperOneOff = await request(app)
			.post('/api/availability/toggle')
			.set('Authorization', `Bearer ${helperOneToken}`)
			.send({ isAvailable: false });

		expect(helperOneOff.status).toBe(200);

		const helperOneBackOn = await request(app)
			.post('/api/availability/toggle')
			.set('Authorization', `Bearer ${helperOneToken}`)
			.send({ isAvailable: true });

		expect(helperOneBackOn.status).toBe(200);
		expect(helperOneBackOn.body.assignment).toBeTruthy();
		expect(helperOneBackOn.body.assignment.request_id).toBe(secondRequestId);

		const helperOneAssignmentAfterRetry = await request(app)
			.get('/api/availability/my-assignment')
			.set('Authorization', `Bearer ${helperOneToken}`);

		expect(helperOneAssignmentAfterRetry.status).toBe(200);
		expect(helperOneAssignmentAfterRetry.body.assignment).toBeTruthy();
		expect(helperOneAssignmentAfterRetry.body.assignment.request_id).toBe(secondRequestId);
	});

	test('PATCH /:id/status returns 401 for guest request when token is missing', async () => {
		const app = createTestApp();

		const createResponse = await request(app)
			.post('/api/help-requests')
			.send(buildCreatePayload());

		const response = await request(app)
			.patch(`/api/help-requests/${createResponse.body.request.id}/status`)
			.send({ status: 'RESOLVED' });

		expect(response.status).toBe(401);
		expect(response.body.code).toBe('UNAUTHORIZED');
	});

	test('PATCH /:id/status returns 403 for guest request when token belongs to another request', async () => {
		const app = createTestApp();

		const firstCreate = await request(app)
			.post('/api/help-requests')
			.send(buildCreatePayload({ description: 'guest request one' }));

		const secondCreate = await request(app)
			.post('/api/help-requests')
			.send(buildCreatePayload({ description: 'guest request two' }));

		const response = await request(app)
			.patch(`/api/help-requests/${secondCreate.body.request.id}/status`)
			.set('x-help-request-access-token', firstCreate.body.guestAccessToken)
			.send({ status: 'RESOLVED' });

		expect(response.status).toBe(403);
		expect(response.body.code).toBe('FORBIDDEN');
	});

	test('PATCH /:id/status syncs a locally saved request', async () => {
		const app = createTestApp();
		const userId = 'user_hr_11';
		await seedActiveUser(userId, 'hr11@example.com');
		const token = buildAuthToken(userId);

		const createResponse = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${token}`)
			.send(buildCreatePayload({ helpTypes: ['food'] }));

		const requestId = createResponse.body.request.id;
		expect(createResponse.body.request.status).toBe('SYNCED');

		const response = await request(app)
			.patch(`/api/help-requests/${requestId}/status`)
			.set('Authorization', `Bearer ${token}`)
			.send({ status: 'SYNCED' });

		expect(response.status).toBe(200);
		expect(response.body.request.status).toBe('SYNCED');
		expect(response.body.request.isSavedLocally).toBe(false);
	});

	test('PATCH /:id/status resolves a request', async () => {
		const app = createTestApp();
		const userId = 'user_hr_12';
		await seedActiveUser(userId, 'hr12@example.com');
		const token = buildAuthToken(userId);

		const createResponse = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${token}`)
			.send(buildCreatePayload({ helpTypes: ['food'] }));

		const requestId = createResponse.body.request.id;

		const response = await request(app)
			.patch(`/api/help-requests/${requestId}/status`)
			.set('Authorization', `Bearer ${token}`)
			.send({ status: 'RESOLVED' });

		expect(response.status).toBe(200);
		expect(response.body.request.status).toBe('RESOLVED');
		expect(response.body.request.resolvedAt).toBeTruthy();
	});

	test('PATCH /:id/status requester resolve clears active assignments and frees volunteers for future matches', async () => {
		const app = createTestApp();
		const requesterId = 'user_hr_resolve_cleanup_requester';
		const helperOneId = 'user_hr_resolve_cleanup_helper_1';
		await seedActiveUser(requesterId, 'resolvecleanuprequester@example.com');
		await seedActiveUser(helperOneId, 'resolvecleanuphelper1@example.com');
		const requesterToken = buildAuthToken(requesterId);
		const helperOneToken = buildAuthToken(helperOneId);

		const firstCreate = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${requesterToken}`)
			.send(buildCreatePayload({ description: 'requester request that will be resolved' }));

		const firstRequestId = firstCreate.body.request.id;

		const firstToggle = await request(app)
			.post('/api/availability/toggle')
			.set('Authorization', `Bearer ${helperOneToken}`)
			.send({ isAvailable: true });

		expect(firstToggle.status).toBe(200);
		expect(firstToggle.body.assignment.request_id).toBe(firstRequestId);

		const resolveResponse = await request(app)
			.patch(`/api/help-requests/${firstRequestId}/status`)
			.set('Authorization', `Bearer ${requesterToken}`)
			.send({ status: 'RESOLVED' });

		expect(resolveResponse.status).toBe(200);
		expect(resolveResponse.body.request.status).toBe('RESOLVED');

		const staleAssignments = await query(
			`SELECT assignment_id FROM assignments WHERE request_id = $1 AND is_cancelled = FALSE`,
			[firstRequestId],
		);
		expect(staleAssignments.rows).toHaveLength(0);

		const helperOneStatus = await request(app)
			.get('/api/availability/status')
			.set('Authorization', `Bearer ${helperOneToken}`);

		expect(helperOneStatus.status).toBe(200);
		expect(helperOneStatus.body.assignment).toBeNull();

		const secondCreate = await request(app)
			.post('/api/help-requests')
			.send(buildCreatePayload({ description: 'second request after requester resolve cleanup' }));

		const secondRequestId = secondCreate.body.request.id;

		const helperOneOff = await request(app)
			.post('/api/availability/toggle')
			.set('Authorization', `Bearer ${helperOneToken}`)
			.send({ isAvailable: false });

		expect(helperOneOff.status).toBe(200);

		const helperOneBackOn = await request(app)
			.post('/api/availability/toggle')
			.set('Authorization', `Bearer ${helperOneToken}`)
			.send({ isAvailable: true });

		expect(helperOneBackOn.status).toBe(200);
		expect(helperOneBackOn.body.assignment).toBeTruthy();
		expect(helperOneBackOn.body.assignment.request_id).toBe(secondRequestId);

		const helperOneAssignmentAfterRetry = await request(app)
			.get('/api/availability/my-assignment')
			.set('Authorization', `Bearer ${helperOneToken}`);

		expect(helperOneAssignmentAfterRetry.status).toBe(200);
		expect(helperOneAssignmentAfterRetry.body.assignment).toBeTruthy();
		expect(helperOneAssignmentAfterRetry.body.assignment.request_id).toBe(secondRequestId);
	});

	test('PATCH /:id/status returns 409 when moving RESOLVED back to SYNCED', async () => {
		const app = createTestApp();
		const userId = 'user_hr_13';
		await seedActiveUser(userId, 'hr13@example.com');
		const token = buildAuthToken(userId);

		const createResponse = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${token}`)
			.send(buildCreatePayload({ helpTypes: ['food'] }));

		const requestId = createResponse.body.request.id;

		await request(app)
			.patch(`/api/help-requests/${requestId}/status`)
			.set('Authorization', `Bearer ${token}`)
			.send({ status: 'RESOLVED' });

		const response = await request(app)
			.patch(`/api/help-requests/${requestId}/status`)
			.set('Authorization', `Bearer ${token}`)
			.send({ status: 'SYNCED' });

		expect(response.status).toBe(409);
		expect(response.body.code).toBe('INVALID_STATUS_TRANSITION');
	});

	test('PATCH /:id/status returns 409 when moving CANCELLED to RESOLVED', async () => {
		const app = createTestApp();
		const userId = 'user_hr_cancelled_transition';
		await seedActiveUser(userId, 'cancelledtransition@example.com');
		const token = buildAuthToken(userId);

		const createResponse = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${token}`)
			.send(buildCreatePayload({ helpTypes: ['food'] }));

		const requestId = createResponse.body.request.id;

		await request(app)
			.patch(`/api/help-requests/${requestId}/status`)
			.set('Authorization', `Bearer ${token}`)
			.send({ status: 'CANCELLED' });

		const response = await request(app)
			.patch(`/api/help-requests/${requestId}/status`)
			.set('Authorization', `Bearer ${token}`)
			.send({ status: 'RESOLVED' });

		expect(response.status).toBe(409);
		expect(response.body.code).toBe('INVALID_STATUS_TRANSITION');
	});

	test('PATCH /:id/status returns 409 when moving guest CANCELLED request to RESOLVED', async () => {
		const app = createTestApp();

		const createResponse = await request(app)
			.post('/api/help-requests')
			.send(buildCreatePayload({ description: 'guest request for cancelled transition guard' }));

		const requestId = createResponse.body.request.id;
		const guestAccessToken = createResponse.body.guestAccessToken;

		await request(app)
			.patch(`/api/help-requests/${requestId}/status`)
			.set('x-help-request-access-token', guestAccessToken)
			.send({ status: 'CANCELLED' });

		const response = await request(app)
			.patch(`/api/help-requests/${requestId}/status`)
			.set('x-help-request-access-token', guestAccessToken)
			.send({ status: 'RESOLVED' });

		expect(response.status).toBe(409);
		expect(response.body.code).toBe('INVALID_STATUS_TRANSITION');
	});

	test('PATCH /:id/status returns 400 for invalid status value', async () => {
		const app = createTestApp();
		const userId = 'user_hr_14';
		await seedActiveUser(userId, 'hr14@example.com');
		const token = buildAuthToken(userId);

		const response = await request(app)
			.patch('/api/help-requests/any-id/status')
			.set('Authorization', `Bearer ${token}`)
			.send({ status: 'INVALID' });

		expect(response.status).toBe(400);
		expect(response.body.code).toBe('VALIDATION_FAILED');
	});

	test('PATCH /:id/status returns 404 for nonexistent request', async () => {
		const app = createTestApp();
		const userId = 'user_hr_15';
		await seedActiveUser(userId, 'hr15@example.com');
		const token = buildAuthToken(userId);

		const response = await request(app)
			.patch('/api/help-requests/nonexistent/status')
			.set('Authorization', `Bearer ${token}`)
			.send({ status: 'RESOLVED' });

		expect(response.status).toBe(404);
	});

	test('PATCH /:id/status resolving is idempotent', async () => {
		const app = createTestApp();
		const userId = 'user_hr_16';
		await seedActiveUser(userId, 'hr16@example.com');
		const token = buildAuthToken(userId);

		const createResponse = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${token}`)
			.send(buildCreatePayload({ helpTypes: ['water'] }));

		const requestId = createResponse.body.request.id;

		await request(app)
			.patch(`/api/help-requests/${requestId}/status`)
			.set('Authorization', `Bearer ${token}`)
			.send({ status: 'RESOLVED' });

		const response = await request(app)
			.patch(`/api/help-requests/${requestId}/status`)
			.set('Authorization', `Bearer ${token}`)
			.send({ status: 'RESOLVED' });

		expect(response.status).toBe(200);
		expect(response.body.request.status).toBe('RESOLVED');
	});

	test('assigned helper sees full requester form details', async () => {
		const app = createTestApp();
		const requesterId = 'user_hr_form_1';
		const helperId = 'user_hr_form_2';
		await seedActiveUser(requesterId, 'form1@example.com');
		await seedActiveUser(helperId, 'form2@example.com');
		const requesterToken = buildAuthToken(requesterId);
		const helperToken = buildAuthToken(helperId);

		// Requester creates a rich help request
		const createRes = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${requesterToken}`)
			.send(buildCreatePayload());

		expect(createRes.status).toBe(201);

		// Helper toggles availability to get assigned
		const toggleRes = await request(app)
			.post('/api/availability/toggle')
			.set('Authorization', `Bearer ${helperToken}`)
			.send({ isAvailable: true });

		expect(toggleRes.status).toBe(200);
		expect(toggleRes.body.assignment).toBeTruthy();

		// Helper fetches their assignment — should see full form data
		const assignmentRes = await request(app)
			.get('/api/availability/my-assignment')
			.set('Authorization', `Bearer ${helperToken}`);

		expect(assignmentRes.status).toBe(200);
		const asg = assignmentRes.body.assignment;
		expect(asg.help_types).toEqual(['first_aid', 'fire_brigade']);
		expect(asg.affected_people_count).toBe(3);
		expect(asg.risk_flags).toEqual(['fire', 'electric_hazard']);
		expect(asg.vulnerable_groups).toEqual(['children', 'pregnant']);
		expect(asg.contact_full_name).toBe('Ayse Yilmaz');
		expect(asg.contact_phone).toBe('5052318546');
		expect(asg.request_country).toBe('turkiye');
		expect(asg.request_city).toBe('istanbul');
		expect(asg.request_district).toBe('besiktas');
		expect(asg.request_neighborhood).toBe('levazim');
	});

	test('requester sees assigned helper contact details', async () => {
		const app = createTestApp();
		const requesterId = 'user_hr_helper_1';
		const helperId = 'user_hr_helper_2';
		await seedActiveUser(requesterId, 'helper1@example.com');
		await seedActiveUser(helperId, 'helper2@example.com');
		const requesterToken = buildAuthToken(requesterId);
		const helperToken = buildAuthToken(helperId);

		// Create helper's profile with name, phone, and expertise
		await query(
			`INSERT INTO user_profiles (profile_id, user_id, first_name, last_name, phone_number)
			 VALUES ('prf_helper_1', $1, 'Mehmet', 'Kaya', '5301234567')`,
			[helperId],
		);
		await query(
			`INSERT INTO expertise (expertise_id, profile_id, profession, expertise_area, is_verified)
			 VALUES ('exp_helper_1', 'prf_helper_1', 'Doctor', 'First Aid', FALSE)`,
		);

		// Requester creates a help request
		const createRes = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${requesterToken}`)
			.send(buildCreatePayload());

		expect(createRes.status).toBe(201);
		const requestId = createRes.body.request.id;

		// Initially, no helper assigned
		expect(createRes.body.request.helper).toBeNull();
		expect(createRes.body.request.helpers).toEqual([]);

		// Helper toggles availability → gets assigned
		const toggleRes = await request(app)
			.post('/api/availability/toggle')
			.set('Authorization', `Bearer ${helperToken}`)
			.send({ isAvailable: true });

		expect(toggleRes.status).toBe(200);
		expect(toggleRes.body.assignment).toBeTruthy();

		// Requester fetches their request — should now see helper details
		const getRes = await request(app)
			.get(`/api/help-requests/${requestId}`)
			.set('Authorization', `Bearer ${requesterToken}`);

		expect(getRes.status).toBe(200);
		expect(getRes.body.request.helper).toBeTruthy();
		expect(getRes.body.request.helpers).toHaveLength(1);
		expect(getRes.body.request.helpers[0].firstName).toBe('Mehmet');
		expect(getRes.body.request.helper.firstName).toBe('Mehmet');
		expect(getRes.body.request.helper.lastName).toBe('Kaya');
		expect(getRes.body.request.helper.phone).toBe(5301234567);
		expect(getRes.body.request.helper.expertise).toBe('First Aid');
	});

	test('request list does not duplicate when helper has multiple expertise rows', async () => {
		const app = createTestApp();
		const requesterId = 'user_hr_dedupe_1';
		const helperId = 'user_hr_dedupe_2';
		await seedActiveUser(requesterId, 'dedupe1@example.com');
		await seedActiveUser(helperId, 'dedupe2@example.com');
		const requesterToken = buildAuthToken(requesterId);
		const helperToken = buildAuthToken(helperId);

		await query(
			`INSERT INTO user_profiles (profile_id, user_id, first_name, last_name, phone_number)
			 VALUES ('prf_dedupe_1', $1, 'Selim', 'Aydin', '5305551111')`,
			[helperId],
		);

		await query(
			`INSERT INTO expertise (expertise_id, profile_id, profession, expertise_area, is_verified)
			 VALUES ('exp_dedupe_1', 'prf_dedupe_1', 'Volunteer', 'Logistics', FALSE)`,
		);

		await query(
			`INSERT INTO expertise (expertise_id, profile_id, profession, expertise_area, is_verified)
			 VALUES ('exp_dedupe_2', 'prf_dedupe_1', 'Volunteer', 'Medical', TRUE)`,
		);

		const createRes = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${requesterToken}`)
			.send(buildCreatePayload());

		const requestId = createRes.body.request.id;

		const toggleRes = await request(app)
			.post('/api/availability/toggle')
			.set('Authorization', `Bearer ${helperToken}`)
			.send({ isAvailable: true });

		expect(toggleRes.status).toBe(200);
		expect(toggleRes.body.assignment).toBeTruthy();

		const listRes = await request(app)
			.get('/api/help-requests')
			.set('Authorization', `Bearer ${requesterToken}`);

		expect(listRes.status).toBe(200);
		expect(listRes.body.requests).toHaveLength(1);
		expect(listRes.body.requests[0].id).toBe(requestId);
		expect(listRes.body.requests[0].helper).toBeTruthy();
		expect(listRes.body.requests[0].helpers).toHaveLength(1);
		expect(listRes.body.requests[0].helper.expertise).toBe('Medical');
	});

	test('request reads expose deterministic ordered helpers while preserving single-helper compatibility', async () => {
		const app = createTestApp();
		const requesterId = 'user_hr_multi_helper_requester';
		const firstHelperId = 'user_hr_multi_helper_first';
		const secondHelperId = 'user_hr_multi_helper_second';

		await seedActiveUser(requesterId, 'multi-helper-requester@example.com');
		await seedActiveUser(firstHelperId, 'multi-helper-first@example.com');
		await seedActiveUser(secondHelperId, 'multi-helper-second@example.com');

		const requesterToken = buildAuthToken(requesterId);

		await query(
			`INSERT INTO user_profiles (profile_id, user_id, first_name, last_name, phone_number)
			 VALUES ('prf_multi_helper_first', $1, 'Ece', 'Demir', '5301111111')`,
			[firstHelperId],
		);
		await query(
			`INSERT INTO user_profiles (profile_id, user_id, first_name, last_name, phone_number)
			 VALUES ('prf_multi_helper_second', $1, 'Kerem', 'Sahin', '5302222222')`,
			[secondHelperId],
		);
		await query(
			`INSERT INTO expertise (expertise_id, profile_id, profession, expertise_area, is_verified)
			 VALUES ('exp_multi_helper_first', 'prf_multi_helper_first', 'Volunteer', 'Search and Rescue', FALSE)`,
		);
		await query(
			`INSERT INTO expertise (expertise_id, profile_id, profession, expertise_area, is_verified)
			 VALUES ('exp_multi_helper_second', 'prf_multi_helper_second', 'Volunteer', 'First Aid', FALSE)`,
		);

		const createRes = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${requesterToken}`)
			.send(buildCreatePayload({ helpTypes: ['fire_brigade'], needType: 'fire_brigade' }));

		const requestId = createRes.body.request.id;

		await seedVolunteer({ volunteerId: 'vol_multi_helper_first', userId: firstHelperId });
		await seedVolunteer({ volunteerId: 'vol_multi_helper_second', userId: secondHelperId });

		await query(
			`UPDATE help_requests SET status = 'ASSIGNED' WHERE request_id = $1`,
			[requestId],
		);

		await query(
			`INSERT INTO assignments (assignment_id, volunteer_id, request_id, assigned_at, is_cancelled)
			 VALUES
			   ('asg_multi_helper_first', 'vol_multi_helper_first', $1, '2026-04-23T08:00:00.000Z', FALSE),
			   ('asg_multi_helper_second', 'vol_multi_helper_second', $1, '2026-04-23T08:05:00.000Z', FALSE)`,
			[requestId],
		);

		const detailRes = await request(app)
			.get(`/api/help-requests/${requestId}`)
			.set('Authorization', `Bearer ${requesterToken}`);

		expect(detailRes.status).toBe(200);
		expect(detailRes.body.request.status).toBe('MATCHED');
		expect(detailRes.body.request.helper).toBeTruthy();
		expect(detailRes.body.request.helpers).toHaveLength(2);
		expect(detailRes.body.request.helper.firstName).toBe('Ece');
		expect(detailRes.body.request.helper.phone).toBe(5301111111);
		expect(detailRes.body.request.helpers[0].firstName).toBe('Ece');
		expect(detailRes.body.request.helpers[0].phone).toBe(5301111111);
		expect(detailRes.body.request.helpers[1].firstName).toBe('Kerem');
		expect(detailRes.body.request.helpers[1].phone).toBe(5302222222);

		const listRes = await request(app)
			.get('/api/help-requests')
			.set('Authorization', `Bearer ${requesterToken}`);

		expect(listRes.status).toBe(200);
		expect(listRes.body.requests).toHaveLength(1);
		expect(listRes.body.requests[0].id).toBe(requestId);
		expect(listRes.body.requests[0].helpers).toHaveLength(2);
		expect(listRes.body.requests[0].helper.firstName).toBe('Ece');
		expect(listRes.body.requests[0].helpers[1].firstName).toBe('Kerem');
	});

	test('request reads keep blank helper entries out of legacy helper compatibility field', async () => {
		const app = createTestApp();
		const requesterId = 'user_hr_blank_helper_requester';
		const blankHelperId = 'user_hr_blank_helper_responder';

		await seedActiveUser(requesterId, 'blank-helper-requester@example.com');
		await seedActiveUser(blankHelperId, 'blank-helper-responder@example.com');

		const requesterToken = buildAuthToken(requesterId);

		await query(
			`INSERT INTO user_profiles (profile_id, user_id, first_name, last_name, phone_number)
			 VALUES ('prf_blank_helper', $1, '   ', '', NULL)`,
			[blankHelperId],
		);
		await query(
			`INSERT INTO expertise (expertise_id, profile_id, profession, expertise_area, is_verified)
			 VALUES ('exp_blank_helper', 'prf_blank_helper', '   ', '', FALSE)`,
		);

		const createRes = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${requesterToken}`)
			.send(buildCreatePayload({ helpTypes: ['food'], needType: 'food' }));

		const requestId = createRes.body.request.id;

		await seedVolunteer({ volunteerId: 'vol_blank_helper', userId: blankHelperId });

		await query(
			`UPDATE help_requests SET status = 'ASSIGNED' WHERE request_id = $1`,
			[requestId],
		);

		await query(
			`INSERT INTO assignments (assignment_id, volunteer_id, request_id, assigned_at, is_cancelled)
			 VALUES ('asg_blank_helper', 'vol_blank_helper', $1, '2026-04-23T08:00:00.000Z', FALSE)`,
			[requestId],
		);

		const detailRes = await request(app)
			.get(`/api/help-requests/${requestId}`)
			.set('Authorization', `Bearer ${requesterToken}`);

		expect(detailRes.status).toBe(200);
		expect(detailRes.body.request.status).toBe('MATCHED');
		expect(detailRes.body.request.helpers).toHaveLength(1);
		expect(detailRes.body.request.helpers[0]).toEqual({
			firstName: null,
			lastName: null,
			phone: null,
			profession: null,
			expertise: null,
		});
		expect(detailRes.body.request.helper).toBeNull();

		const listRes = await request(app)
			.get('/api/help-requests')
			.set('Authorization', `Bearer ${requesterToken}`);

		expect(listRes.status).toBe(200);
		expect(listRes.body.requests).toHaveLength(1);
		expect(listRes.body.requests[0].helpers).toHaveLength(1);
		expect(listRes.body.requests[0].helper).toBeNull();
	});

	test('help request without assignment has null helper', async () => {
		const app = createTestApp();
		const requesterId = 'user_hr_nohelper';
		await seedActiveUser(requesterId, 'nohelper@example.com');
		const requesterToken = buildAuthToken(requesterId);

		const createRes = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${requesterToken}`)
			.send(buildCreatePayload());

		const requestId = createRes.body.request.id;

		const getRes = await request(app)
			.get(`/api/help-requests/${requestId}`)
			.set('Authorization', `Bearer ${requesterToken}`);

		expect(getRes.status).toBe(200);
		expect(getRes.body.request.helper).toBeNull();
		expect(getRes.body.request.helpers).toEqual([]);
	});

	test('POST /api/help-requests auto-assigns to already available volunteer', async () => {
		const app = createTestApp();
		const helperId = 'user_auto_1';
		const requesterId = 'user_auto_2';
		await seedActiveUser(helperId, 'auto1@example.com');
		await seedActiveUser(requesterId, 'auto2@example.com');
		const helperToken = buildAuthToken(helperId);
		const requesterToken = buildAuthToken(requesterId);

		// 1. Volunteer becomes available FIRST
		const toggleRes = await request(app)
			.post('/api/availability/toggle')
			.set('Authorization', `Bearer ${helperToken}`)
			.send({ isAvailable: true });

		expect(toggleRes.status).toBe(200);
		expect(toggleRes.body.assignment).toBeNull(); // No requests yet

		// 2. Requester creates a request
		const createRes = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${requesterToken}`)
			.send(buildCreatePayload({ needType: 'first_aid' }));

		expect(createRes.status).toBe(201);
		// It should be MATCHED (which corresponds to internal status ASSIGNED)
		expect(createRes.body.request.status).toBe('MATCHED');

		// 3. Verify helper has the assignment
		const statusRes = await request(app)
			.get('/api/availability/status')
			.set('Authorization', `Bearer ${helperToken}`);

		expect(statusRes.status).toBe(200);
		expect(statusRes.body.assignment).toBeTruthy();
		expect(statusRes.body.assignment.request_id).toBe(createRes.body.request.id);
	});

	test('POST /api/help-requests prefers a first-aid-capable volunteer for first-aid-only requests', async () => {
		const app = createTestApp();
		const medicalHelperId = 'user_medical_helper';
		const generalHelperId = 'user_general_helper';
		const requesterId = 'user_request_first_aid';

		await seedActiveUser(medicalHelperId, 'medicalhelper@example.com');
		await seedActiveUser(generalHelperId, 'generalhelper@example.com');
		await seedActiveUser(requesterId, 'requestfirstaid@example.com');
		await seedVolunteer({
			volunteerId: 'vol_medical_helper',
			userId: medicalHelperId,
			latitude: 41.043,
			longitude: 29.009,
			locationUpdatedAt: '2026-04-23T08:00:00.000Z',
		});
		await seedVolunteer({
			volunteerId: 'vol_general_helper',
			userId: generalHelperId,
			latitude: 41.0431,
			longitude: 29.0091,
			locationUpdatedAt: '2026-04-23T08:10:00.000Z',
		});
		await seedVolunteerProfile(medicalHelperId, '["First Aid","Logistics"]');

		const response = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${buildAuthToken(requesterId)}`)
			.send(buildCreatePayload({
				helpTypes: ['first_aid'],
				location: {
					country: 'turkiye',
					city: 'istanbul',
					district: 'besiktas',
					neighborhood: 'levazim',
					extraAddress: 'Bina B',
					latitude: 41.043,
					longitude: 29.009,
				},
			}));

		expect(response.status).toBe(201);
		expect(response.body.request.status).toBe('MATCHED');

		const medicalStatus = await request(app)
			.get('/api/availability/status')
			.set('Authorization', `Bearer ${buildAuthToken(medicalHelperId)}`);
		const generalStatus = await request(app)
			.get('/api/availability/status')
			.set('Authorization', `Bearer ${buildAuthToken(generalHelperId)}`);

		expect(medicalStatus.body.assignment).toBeTruthy();
		expect(medicalStatus.body.assignment.request_id).toBe(response.body.request.id);
		expect(generalStatus.body.assignment).toBeNull();
	});

	test('POST /api/help-requests falls back to a general volunteer for first-aid-only requests when no medical volunteer is available', async () => {
		const app = createTestApp();
		const helperId = 'user_general_only_helper';
		const requesterId = 'user_request_general_only';

		await seedActiveUser(helperId, 'generalonly@example.com');
		await seedActiveUser(requesterId, 'requestgeneralonly@example.com');
		await seedVolunteer({
			volunteerId: 'vol_general_only_helper',
			userId: helperId,
			latitude: 41.043,
			longitude: 29.009,
		});

		const response = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${buildAuthToken(requesterId)}`)
			.send(buildCreatePayload({
				helpTypes: ['first_aid'],
				location: {
					country: 'turkiye',
					city: 'istanbul',
					district: 'besiktas',
					neighborhood: 'levazim',
					extraAddress: 'Bina B',
					latitude: 41.043,
					longitude: 29.009,
				},
			}));

		expect(response.status).toBe(201);
		expect(response.body.request.status).toBe('MATCHED');

		const helperStatus = await request(app)
			.get('/api/availability/status')
			.set('Authorization', `Bearer ${buildAuthToken(helperId)}`);

		expect(helperStatus.body.assignment).toBeTruthy();
		expect(helperStatus.body.assignment.request_id).toBe(response.body.request.id);
	});

	test('POST /api/help-requests prefers a medical volunteer for combined first-aid and SAR requests', async () => {
		const app = createTestApp();
		const medicalHelperId = 'user_medical_combo';
		const generalHelperId = 'user_general_combo';
		const requesterId = 'user_request_combo';

		await seedActiveUser(medicalHelperId, 'medicalcombo@example.com');
		await seedActiveUser(generalHelperId, 'generalcombo@example.com');
		await seedActiveUser(requesterId, 'requestcombo@example.com');
		await seedVolunteer({ volunteerId: 'vol_medical_combo', userId: medicalHelperId });
		await seedVolunteer({ volunteerId: 'vol_general_combo', userId: generalHelperId });
		await seedVolunteerProfile(medicalHelperId, 'Medical');

		const response = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${buildAuthToken(requesterId)}`)
			.send(buildCreatePayload({ helpTypes: ['first_aid', 'fire_brigade'] }));

		expect(response.status).toBe(201);
		expect(response.body.request.status).toBe('MATCHED');

		const medicalStatus = await request(app)
			.get('/api/availability/status')
			.set('Authorization', `Bearer ${buildAuthToken(medicalHelperId)}`);

		expect(medicalStatus.body.assignment).toBeTruthy();
		expect(medicalStatus.body.assignment.request_id).toBe(response.body.request.id);
	});

	test('POST /api/help-requests falls back deterministically for combined first-aid and SAR requests when coordinates are missing', async () => {
		const app = createTestApp();
		const firstHelperId = 'user_combo_fallback_a';
		const secondHelperId = 'user_combo_fallback_b';
		const requesterId = 'user_request_combo_fallback';

		await seedActiveUser(firstHelperId, 'combofallbacka@example.com');
		await seedActiveUser(secondHelperId, 'combofallbackb@example.com');
		await seedActiveUser(requesterId, 'requestcombofallback@example.com');
		await seedVolunteer({
			volunteerId: 'vol_combo_fallback_a',
			userId: firstHelperId,
			locationUpdatedAt: '2026-04-23T08:00:00.000Z',
		});
		await seedVolunteer({
			volunteerId: 'vol_combo_fallback_b',
			userId: secondHelperId,
			locationUpdatedAt: '2026-04-23T08:00:00.000Z',
		});

		const response = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${buildAuthToken(requesterId)}`)
			.send(buildCreatePayload({
				helpTypes: ['first_aid', 'fire_brigade'],
				location: {
					country: 'turkiye',
					city: 'istanbul',
					district: 'besiktas',
					neighborhood: 'levazim',
					extraAddress: 'Bina B, 3. kat, arka giris',
				},
			}));

		expect(response.status).toBe(201);
		expect(response.body.request.status).toBe('MATCHED');

		const firstStatus = await request(app)
			.get('/api/availability/status')
			.set('Authorization', `Bearer ${buildAuthToken(firstHelperId)}`);

		expect(firstStatus.body.assignment).toBeTruthy();
		expect(firstStatus.body.assignment.request_id).toBe(response.body.request.id);
	});

	test('POST /api/help-requests ignores already assigned volunteers and enforces the 1 km cutoff', async () => {
		const app = createTestApp();
		const busyHelperId = 'user_busy_helper';
		const nearHelperId = 'user_near_helper';
		const farHelperId = 'user_far_helper';
		const requesterId = 'user_request_cutoff';
		const busyRequesterId = 'user_request_busy_existing';

		await seedActiveUser(busyHelperId, 'busyhelper@example.com');
		await seedActiveUser(nearHelperId, 'nearhelper@example.com');
		await seedActiveUser(farHelperId, 'farhelper@example.com');
		await seedActiveUser(requesterId, 'requestcutoff@example.com');
		await seedActiveUser(busyRequesterId, 'busyexisting@example.com');

		await seedVolunteer({
			volunteerId: 'vol_busy_helper',
			userId: busyHelperId,
			latitude: 41.043,
			longitude: 29.009,
		});
		await seedVolunteer({
			volunteerId: 'vol_near_helper',
			userId: nearHelperId,
			latitude: 41.0432,
			longitude: 29.0092,
		});
		await seedVolunteer({
			volunteerId: 'vol_far_helper',
			userId: farHelperId,
			latitude: 41.06,
			longitude: 29.06,
		});
		await seedVolunteerProfile(busyHelperId, 'First Aid');
		await seedAssignedRequestForVolunteer({
			requestId: 'req_existing_busy',
			requesterUserId: busyRequesterId,
			volunteerId: 'vol_busy_helper',
		});

		const response = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${buildAuthToken(requesterId)}`)
			.send(buildCreatePayload({
				helpTypes: ['first_aid'],
				location: {
					country: 'turkiye',
					city: 'istanbul',
					district: 'besiktas',
					neighborhood: 'levazim',
					extraAddress: 'Bina B',
					latitude: 41.043,
					longitude: 29.009,
				},
			}));

		expect(response.status).toBe(201);
		expect(response.body.request.status).toBe('MATCHED');

		const nearStatus = await request(app)
			.get('/api/availability/status')
			.set('Authorization', `Bearer ${buildAuthToken(nearHelperId)}`);
		const farStatus = await request(app)
			.get('/api/availability/status')
			.set('Authorization', `Bearer ${buildAuthToken(farHelperId)}`);

		expect(nearStatus.body.assignment).toBeTruthy();
		expect(nearStatus.body.assignment.request_id).toBe(response.body.request.id);
		expect(farStatus.body.assignment).toBeNull();
	});
});
