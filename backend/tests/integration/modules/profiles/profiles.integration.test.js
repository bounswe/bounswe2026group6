'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../../../src/modules/auth/routes', () => ({
	authRouter: require('express').Router(),
}));

jest.mock('../../../../src/modules/help-requests/routes', () => ({
	helpRequestsRouter: require('express').Router(),
}));

jest.mock('../../../../src/modules/availability/routes', () => ({
	availabilityRouter: require('express').Router(),
}));

const { query } = require('../../../../src/db/pool');
const { createApp } = require('../../../../src/app');

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

async function createBaseProfile(app, token) {
	const response = await request(app)
		.patch('/api/profiles/me')
		.set('Authorization', `Bearer ${token}`)
		.send({ firstName: 'Ada', lastName: 'Lovelace' });

	expect(response.status).toBe(200);
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

describe('profiles integration', () => {
	test('GET /api/profiles/me returns 401 without token', async () => {
		const app = createApp();

		const response = await request(app)
			.get('/api/profiles/me');

		expect(response.status).toBe(401);
	});

	test('PATCH /api/profiles/me creates profile', async () => {
		const app = createApp();
		const userId = 'user_profile_1';
		await seedActiveUser(userId, 'profile1@example.com');
		const token = buildAuthToken(userId);

		const response = await request(app)
			.patch('/api/profiles/me')
			.set('Authorization', `Bearer ${token}`)
			.send({ firstName: 'Ada', lastName: 'Lovelace' });

		expect(response.status).toBe(200);
		expect(response.body.profile.userId).toBe(userId);
		expect(response.body.profile.firstName).toBe('Ada');
	});

	test('PATCH /api/profiles/me/physical returns 200 with valid payload', async () => {
		const app = createApp();
		const userId = 'user_phys_1';
		await seedActiveUser(userId, 'phys1@example.com');
		const token = buildAuthToken(userId);
		await createBaseProfile(app, token);

		const response = await request(app)
			.patch('/api/profiles/me/physical')
			.set('Authorization', `Bearer ${token}`)
			.send({ age: 22 });

		expect(response.status).toBe(200);
		expect(response.body.physicalInfo.age).toBe(22);
	});

	test('PATCH /api/profiles/me/health returns 200 with valid payload', async () => {
		const app = createApp();
		const userId = 'user_health_1';
		await seedActiveUser(userId, 'health1@example.com');
		const token = buildAuthToken(userId);
		await createBaseProfile(app, token);

		const response = await request(app)
			.patch('/api/profiles/me/health')
			.set('Authorization', `Bearer ${token}`)
			.send({ allergies: ['Peanut'] });

		expect(response.status).toBe(200);
		expect(response.body.healthInfo.allergies).toEqual(['Peanut']);
	});

	test('PATCH /api/profiles/me/location returns 400 for invalid coordinate payload', async () => {
		const app = createApp();
		const userId = 'user_loc_1';
		await seedActiveUser(userId, 'loc1@example.com');
		const token = buildAuthToken(userId);
		await createBaseProfile(app, token);

		const response = await request(app)
			.patch('/api/profiles/me/location')
			.set('Authorization', `Bearer ${token}`)
			.send({ latitude: 41.0 });

		expect(response.status).toBe(400);
		expect(response.body.code).toBe('VALIDATION_ERROR');
	});

	test('PATCH /api/profiles/me/location returns 200 for valid payload', async () => {
		const app = createApp();
		const userId = 'user_loc_2';
		await seedActiveUser(userId, 'loc2@example.com');
		const token = buildAuthToken(userId);
		await createBaseProfile(app, token);

		const response = await request(app)
			.patch('/api/profiles/me/location')
			.set('Authorization', `Bearer ${token}`)
			.send({ city: 'Istanbul' });

		expect(response.status).toBe(200);
		expect(response.body.locationProfile.city).toBe('Istanbul');
	});

	test('PATCH /api/profiles/me/privacy returns 200 with valid payload', async () => {
		const app = createApp();
		const userId = 'user_priv_1';
		await seedActiveUser(userId, 'priv1@example.com');
		const token = buildAuthToken(userId);
		await createBaseProfile(app, token);

		const response = await request(app)
			.patch('/api/profiles/me/privacy')
			.set('Authorization', `Bearer ${token}`)
			.send({ profileVisibility: 'PUBLIC' });

		expect(response.status).toBe(200);
		expect(response.body.privacySettings.profileVisibility).toBe('PUBLIC');
	});

	test('PATCH /api/profiles/me/profession returns 401 without token', async () => {
		const app = createApp();

		const response = await request(app)
			.patch('/api/profiles/me/profession')
			.send({ profession: 'Doctor' });

		expect(response.status).toBe(401);
		expect(response.body.code).toBe('UNAUTHORIZED');
	});

	test('PATCH /api/profiles/me/profession returns 400 for invalid payload', async () => {
		const app = createApp();
		const userId = 'user_prof_1';
		await seedActiveUser(userId, 'prof1@example.com');
		const token = buildAuthToken(userId);
		await createBaseProfile(app, token);

		const response = await request(app)
			.patch('/api/profiles/me/profession')
			.set('Authorization', `Bearer ${token}`)
			.send({});

		expect(response.status).toBe(400);
		expect(response.body.code).toBe('VALIDATION_ERROR');
	});

	test('PATCH /api/profiles/me/profession returns 200 and profile payload on success', async () => {
		const app = createApp();
		const userId = 'user_prof_2';
		await seedActiveUser(userId, 'prof2@example.com');
		const token = buildAuthToken(userId);
		await createBaseProfile(app, token);

		const response = await request(app)
			.patch('/api/profiles/me/profession')
			.set('Authorization', `Bearer ${token}`)
			.send({ profession: 'Doctor' });

		expect(response.status).toBe(200);
		expect(response.body.profile.userId).toBe(userId);
		expect(response.body.expertise[0].profession).toBe('Doctor');
	});
});
