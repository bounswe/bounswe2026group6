'use strict';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const { helpRequestsRouter } = require('../../../../src/modules/help-requests/routes');
const { query } = require('../../../../src/db/pool');

function createTestApp() {
	const app = express();
	app.use(express.json());
	app.use('/api/help-requests', helpRequestsRouter);
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
	test('POST /api/help-requests returns 401 without token', async () => {
		const app = createTestApp();

		const response = await request(app)
			.post('/api/help-requests')
			.send({ needType: 'medical' });

		expect(response.status).toBe(401);
	});

	test('POST /api/help-requests creates request with default needType', async () => {
		const app = createTestApp();
		const userId = 'user_hr_1';
		await seedActiveUser(userId, 'hr1@example.com');
		const token = buildAuthToken(userId);

		const response = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${token}`)
			.send({});

		expect(response.status).toBe(201);
		expect(response.body.request.userId).toBe(userId);
		expect(response.body.request.needType).toBe('general');
		expect(response.body.request.status).toBe('SYNCED');
		expect(response.body.request.isSavedLocally).toBe(false);
		expect(response.body.warnings).toEqual(
			expect.arrayContaining([expect.stringContaining('defaulting to')]),
		);
	});

	test('POST /api/help-requests creates request with location', async () => {
		const app = createTestApp();
		const userId = 'user_hr_2';
		await seedActiveUser(userId, 'hr2@example.com');
		const token = buildAuthToken(userId);

		const response = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${token}`)
			.send({
				needType: 'medical',
				description: 'Need first aid',
				location: { latitude: 41.0, longitude: 28.9, isGpsLocation: true },
			});

		expect(response.status).toBe(201);
		expect(response.body.request.needType).toBe('medical');
		expect(response.body.request.description).toBe('Need first aid');
		expect(response.body.request.location).toBeTruthy();
		expect(response.body.request.location.latitude).toBe(41.0);
		expect(response.body.request.location.longitude).toBe(28.9);
		expect(response.body.request.location.isGpsLocation).toBe(true);
	});

	test('POST /api/help-requests creates locally saved request with PENDING_SYNC status', async () => {
		const app = createTestApp();
		const userId = 'user_hr_3';
		await seedActiveUser(userId, 'hr3@example.com');
		const token = buildAuthToken(userId);

		const response = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${token}`)
			.send({ needType: 'shelter', isSavedLocally: true });

		expect(response.status).toBe(201);
		expect(response.body.request.isSavedLocally).toBe(true);
		expect(response.body.request.status).toBe('PENDING_SYNC');
	});

	test('POST /api/help-requests returns 400 for invalid location', async () => {
		const app = createTestApp();
		const userId = 'user_hr_4';
		await seedActiveUser(userId, 'hr4@example.com');
		const token = buildAuthToken(userId);

		const response = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${token}`)
			.send({ location: { latitude: 999, longitude: 28 } });

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
			.send({ needType: 'food' });

		await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${token1}`)
			.send({ needType: 'water' });

		await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${token2}`)
			.send({ needType: 'shelter' });

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
			.send({ needType: 'medical', description: 'broken leg' });

		const requestId = createResponse.body.request.id;

		const response = await request(app)
			.get(`/api/help-requests/${requestId}`)
			.set('Authorization', `Bearer ${token}`);

		expect(response.status).toBe(200);
		expect(response.body.request.id).toBe(requestId);
		expect(response.body.request.description).toBe('broken leg');
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
			.send({ needType: 'food' });

		const requestId = createResponse.body.request.id;

		const response = await request(app)
			.get(`/api/help-requests/${requestId}`)
			.set('Authorization', `Bearer ${token2}`);

		expect(response.status).toBe(404);
	});

	test('PATCH /:id/status syncs a locally saved request', async () => {
		const app = createTestApp();
		const userId = 'user_hr_11';
		await seedActiveUser(userId, 'hr11@example.com');
		const token = buildAuthToken(userId);

		const createResponse = await request(app)
			.post('/api/help-requests')
			.set('Authorization', `Bearer ${token}`)
			.send({ needType: 'food', isSavedLocally: true });

		const requestId = createResponse.body.request.id;
		expect(createResponse.body.request.status).toBe('PENDING_SYNC');

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
			.send({ needType: 'food' });

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
			.send({ needType: 'food' });

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
			.send({ needType: 'water' });

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
});
