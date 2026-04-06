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
		expect(listRes.body.requests[0].helper.expertise).toBe('Medical');
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
	});
});
