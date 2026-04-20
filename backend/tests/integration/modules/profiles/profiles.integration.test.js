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

	test('PATCH /api/profiles/me/location returns 400 for invalid administrative countryCode', async () => {
		const app = createApp();
		const userId = 'user_loc_invalid_countrycode_1';
		await seedActiveUser(userId, 'locinvalidcountrycode1@example.com');
		const token = buildAuthToken(userId);
		await createBaseProfile(app, token);

		const response = await request(app)
			.patch('/api/profiles/me/location')
			.set('Authorization', `Bearer ${token}`)
			.send({
				administrative: {
					countryCode: 'TURKEY',
				},
			});

		expect(response.status).toBe(400);
		expect(response.body.code).toBe('VALIDATION_ERROR');
		expect(response.body.message).toBe('administrative.countryCode must be a 2-letter ISO code');
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

	test('PATCH /api/profiles/me/location accepts hybrid payload with administrative and coordinate', async () => {
		const app = createApp();
		const userId = 'user_loc_hybrid_1';
		await seedActiveUser(userId, 'lochybrid1@example.com');
		const token = buildAuthToken(userId);
		await createBaseProfile(app, token);

		const response = await request(app)
			.patch('/api/profiles/me/location')
			.set('Authorization', `Bearer ${token}`)
			.send({
				displayAddress: 'Levazim, Besiktas, Istanbul',
				placeId: 'osm:node:12345',
				administrative: {
					countryCode: 'TR',
					country: 'Turkey',
					city: 'Istanbul',
					district: 'Besiktas',
					neighborhood: 'Levazim',
					extraAddress: 'Bina B',
					postalCode: '34340',
				},
				coordinate: {
					latitude: 41.043,
					longitude: 29.009,
					source: 'MANUAL_MAP_PIN',
					capturedAt: '2026-04-18T11:20:00.000Z',
				},
			});

		expect(response.status).toBe(200);
		expect(response.body.locationProfile.country).toBe('Turkey');
		expect(response.body.locationProfile.city).toBe('Istanbul');
		expect(response.body.locationProfile.latitude).toBeCloseTo(41.043, 6);
		expect(response.body.locationProfile.longitude).toBeCloseTo(29.009, 6);
		expect(response.body.locationProfile.coordinate).toBeTruthy();
		expect(response.body.locationProfile.administrative).toBeTruthy();
		expect(response.body.locationProfile.displayAddress).toBe('Levazim, Besiktas, Istanbul');
		expect(response.body.locationProfile.placeId).toBe('osm:node:12345');
		expect(response.body.locationProfile.administrative.countryCode).toBe('TR');
		expect(response.body.locationProfile.administrative.district).toBe('Besiktas');
		expect(response.body.locationProfile.administrative.neighborhood).toBe('Levazim');
		expect(response.body.locationProfile.administrative.extraAddress).toBe('Bina B');

		const getResponse = await request(app)
			.get('/api/profiles/me')
			.set('Authorization', `Bearer ${token}`);

		expect(getResponse.status).toBe(200);
		expect(getResponse.body.locationProfile.displayAddress).toBe('Levazim, Besiktas, Istanbul');
		expect(getResponse.body.locationProfile.placeId).toBe('osm:node:12345');
		expect(getResponse.body.locationProfile.administrative.countryCode).toBe('TR');
		expect(getResponse.body.locationProfile.administrative.district).toBe('Besiktas');
		expect(getResponse.body.locationProfile.administrative.neighborhood).toBe('Levazim');
	});

	test('PATCH /api/profiles/me/location preserves omitted fields in partial updates', async () => {
		const app = createApp();
		const userId = 'user_loc_partial_1';
		await seedActiveUser(userId, 'locpartial1@example.com');
		const token = buildAuthToken(userId);
		await createBaseProfile(app, token);

		const initialResponse = await request(app)
			.patch('/api/profiles/me/location')
			.set('Authorization', `Bearer ${token}`)
			.send({
				country: 'Turkey',
				city: 'Istanbul',
				displayAddress: 'Levazim, Besiktas, Istanbul',
				placeId: 'osm:node:111',
				administrative: {
					countryCode: 'TR',
					country: 'Turkey',
					city: 'Istanbul',
					district: 'Besiktas',
					neighborhood: 'Levazim',
					extraAddress: 'Bina B',
				},
			});

		expect(initialResponse.status).toBe(200);

		const partialResponse = await request(app)
			.patch('/api/profiles/me/location')
			.set('Authorization', `Bearer ${token}`)
			.send({
				administrative: {
					district: 'Kadikoy',
				},
			});

		expect(partialResponse.status).toBe(200);
		expect(partialResponse.body.locationProfile.country).toBe('Turkey');
		expect(partialResponse.body.locationProfile.city).toBe('Istanbul');
		expect(partialResponse.body.locationProfile.placeId).toBe('osm:node:111');
		expect(partialResponse.body.locationProfile.administrative.district).toBe('Kadikoy');
	});

	test('PATCH /api/profiles/me/location supports explicit null clear semantics', async () => {
		const app = createApp();
		const userId = 'user_loc_clear_1';
		await seedActiveUser(userId, 'locclear1@example.com');
		const token = buildAuthToken(userId);
		await createBaseProfile(app, token);

		const initialResponse = await request(app)
			.patch('/api/profiles/me/location')
			.set('Authorization', `Bearer ${token}`)
			.send({
				country: 'Turkey',
				city: 'Istanbul',
				displayAddress: 'Levazim, Besiktas, Istanbul',
				placeId: 'osm:node:222',
			});

		expect(initialResponse.status).toBe(200);

		const clearResponse = await request(app)
			.patch('/api/profiles/me/location')
			.set('Authorization', `Bearer ${token}`)
			.send({
				country: null,
				city: null,
				displayAddress: null,
				placeId: null,
				administrative: {
					district: null,
					neighborhood: null,
					extraAddress: null,
				},
			});

		expect(clearResponse.status).toBe(200);
		expect(clearResponse.body.locationProfile.country).toBeNull();
		expect(clearResponse.body.locationProfile.city).toBeNull();
		expect(clearResponse.body.locationProfile.address).toBeNull();
		expect(clearResponse.body.locationProfile.displayAddress).toBeNull();
		expect(clearResponse.body.locationProfile.placeId).toBeNull();
		expect(clearResponse.body.locationProfile.administrative.district).toBeNull();
		expect(clearResponse.body.locationProfile.administrative.neighborhood).toBeNull();
		expect(clearResponse.body.locationProfile.administrative.extraAddress).toBeNull();
	});

	test('PATCH /api/profiles/me/location preserves coordinate nullability contract', async () => {
		const app = createApp();
		const userId = 'user_loc_coordinate_1';
		await seedActiveUser(userId, 'loccoordinate1@example.com');
		const token = buildAuthToken(userId);
		await createBaseProfile(app, token);

		const noCoordinateResponse = await request(app)
			.patch('/api/profiles/me/location')
			.set('Authorization', `Bearer ${token}`)
			.send({ city: 'Istanbul' });

		expect(noCoordinateResponse.status).toBe(200);
		expect(noCoordinateResponse.body.locationProfile.coordinate).toBeNull();

		const withCoordinateResponse = await request(app)
			.patch('/api/profiles/me/location')
			.set('Authorization', `Bearer ${token}`)
			.send({
				coordinate: {
					latitude: 41.01,
					longitude: 29.02,
				},
			});

		expect(withCoordinateResponse.status).toBe(200);
		expect(withCoordinateResponse.body.locationProfile.coordinate).toEqual(
			expect.objectContaining({
				latitude: 41.01,
				longitude: 29.02,
			}),
		);

		const clearCoordinateResponse = await request(app)
			.patch('/api/profiles/me/location')
			.set('Authorization', `Bearer ${token}`)
			.send({
				coordinate: {
					latitude: null,
					longitude: null,
				},
			});

		expect(clearCoordinateResponse.status).toBe(200);
		expect(clearCoordinateResponse.body.locationProfile.latitude).toBeNull();
		expect(clearCoordinateResponse.body.locationProfile.longitude).toBeNull();
		expect(clearCoordinateResponse.body.locationProfile.coordinate).toBeNull();
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

	test('PATCH /api/profiles/me/profession clears profession when null is sent', async () => {
		const app = createApp();
		const userId = 'user_prof_3';
		await seedActiveUser(userId, 'prof3@example.com');
		const token = buildAuthToken(userId);
		await createBaseProfile(app, token);

		await request(app)
			.patch('/api/profiles/me/profession')
			.set('Authorization', `Bearer ${token}`)
			.send({ profession: 'Paramedic' });

		const response = await request(app)
			.patch('/api/profiles/me/profession')
			.set('Authorization', `Bearer ${token}`)
			.send({ profession: null });

		expect(response.status).toBe(200);
		expect(response.body.expertise[0].profession).toBeNull();
	});

	test('PUT /api/profiles/me/expertise-areas returns 400 when more than 5 values are sent', async () => {
		const app = createApp();
		const userId = 'user_exp_1';
		await seedActiveUser(userId, 'exp1@example.com');
		const token = buildAuthToken(userId);
		await createBaseProfile(app, token);

		const response = await request(app)
			.put('/api/profiles/me/expertise-areas')
			.set('Authorization', `Bearer ${token}`)
			.send({ expertiseAreas: ['A', 'B', 'C', 'D', 'E', 'F'] });

		expect(response.status).toBe(400);
		expect(response.body.code).toBe('VALIDATION_ERROR');
	});

	test('PATCH /api/profiles/me/profession does not wipe existing expertise areas', async () => {
		const app = createApp();
		const userId = 'user_indep_1';
		await seedActiveUser(userId, 'indep1@example.com');
		const token = buildAuthToken(userId);
		await createBaseProfile(app, token);

		await request(app)
			.put('/api/profiles/me/expertise-areas')
			.set('Authorization', `Bearer ${token}`)
			.send({ expertiseAreas: ['First Aid', 'Logistics'] });

		const response = await request(app)
			.patch('/api/profiles/me/profession')
			.set('Authorization', `Bearer ${token}`)
			.send({ profession: 'Nurse' });

		expect(response.status).toBe(200);
		expect(response.body.expertise[0].profession).toBe('Nurse');
		expect(response.body.expertise[0].expertiseAreas).toEqual(['First Aid', 'Logistics']);
	});

	test('PUT /api/profiles/me/expertise-areas does not wipe existing profession', async () => {
		const app = createApp();
		const userId = 'user_indep_2';
		await seedActiveUser(userId, 'indep2@example.com');
		const token = buildAuthToken(userId);
		await createBaseProfile(app, token);

		await request(app)
			.patch('/api/profiles/me/profession')
			.set('Authorization', `Bearer ${token}`)
			.send({ profession: 'Paramedic' });

		const response = await request(app)
			.put('/api/profiles/me/expertise-areas')
			.set('Authorization', `Bearer ${token}`)
			.send({ expertiseAreas: ['Search and Rescue'] });

		expect(response.status).toBe(200);
		expect(response.body.expertise[0].profession).toBe('Paramedic');
		expect(response.body.expertise[0].expertiseAreas).toEqual(['Search and Rescue']);
	});

	test('PUT /api/profiles/me/expertise-areas returns 200 and stores parsed expertise areas', async () => {
		const app = createApp();
		const userId = 'user_exp_2';
		await seedActiveUser(userId, 'exp2@example.com');
		const token = buildAuthToken(userId);
		await createBaseProfile(app, token);

		const response = await request(app)
			.put('/api/profiles/me/expertise-areas')
			.set('Authorization', `Bearer ${token}`)
			.send({ expertiseAreas: ['First Aid', 'Logistics'] });

		expect(response.status).toBe(200);
		expect(response.body.profile.userId).toBe(userId);
		expect(response.body.expertise[0].expertiseAreas).toEqual(['First Aid', 'Logistics']);
	});
});
