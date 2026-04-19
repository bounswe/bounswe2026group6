'use strict';

const {
	readUserId,
	validateCreateHelpRequest,
	validateHelpRequestStatusUpdate,
} = require('../../../../src/modules/help-requests/validators');

describe('help-requests validators', () => {
	describe('readUserId', () => {
		test('returns userId from request.user', () => {
			const result = readUserId({ user: { userId: 'u1' } });

			expect(result).toBe('u1');
		});

		test('returns null when request.user is missing', () => {
			const result = readUserId({});

			expect(result).toBeNull();
		});

		test('returns null when request.user.userId is missing', () => {
			const result = readUserId({ user: {} });

			expect(result).toBeNull();
		});

		test('returns x-user-id header in development mode', () => {
			const original = process.env.NODE_ENV;
			process.env.NODE_ENV = 'development';

			const result = readUserId({ user: null, headers: { 'x-user-id': 'dev_user' } });

			expect(result).toBe('dev_user');
			process.env.NODE_ENV = original;
		});

		test('ignores x-user-id header outside development mode', () => {
			const original = process.env.NODE_ENV;
			process.env.NODE_ENV = 'test';

			const result = readUserId({ headers: { 'x-user-id': 'dev_user' } });

			expect(result).toBeNull();
			process.env.NODE_ENV = original;
		});

		test('ignores empty x-user-id header in development mode', () => {
			const original = process.env.NODE_ENV;
			process.env.NODE_ENV = 'development';

			const result = readUserId({ headers: { 'x-user-id': '   ' } });

			expect(result).toBeNull();
			process.env.NODE_ENV = original;
		});

		test('trims x-user-id header in development mode', () => {
			const original = process.env.NODE_ENV;
			process.env.NODE_ENV = 'development';

			const result = readUserId({ headers: { 'x-user-id': '  u1  ' } });

			expect(result).toBe('u1');
			process.env.NODE_ENV = original;
		});
	});

	describe('validateCreateHelpRequest', () => {
		function buildPayload() {
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
			};
		}

		test('accepts the new help-request payload shape', () => {
			const { errors, warnings, value } = validateCreateHelpRequest(buildPayload());

			expect(errors).toHaveLength(0);
			expect(warnings).toEqual([]);
			expect(value.helpTypes).toEqual(['first_aid', 'fire_brigade']);
			expect(value.needType).toBe('first_aid');
			expect(value.affectedPeopleCount).toBe(3);
			expect(value.location.city).toBe('istanbul');
			expect(value.contact.fullName).toBe('Ayse Yilmaz');
			expect(value.consentGiven).toBe(true);
			expect(value.isSavedLocally).toBe(false);
		});

		test('rejects missing required fields', () => {
			const { errors } = validateCreateHelpRequest({});

			expect(errors).toEqual(expect.arrayContaining([
				expect.stringContaining('`helpTypes` is required'),
				expect.stringContaining('`affectedPeopleCount`'),
				expect.stringContaining('`description` is required'),
				expect.stringContaining('`location` is required'),
				expect.stringContaining('`contact` is required'),
				expect.stringContaining('`consentGiven`'),
			]));
		});

		test('rejects empty helpTypes', () => {
			const payload = buildPayload();
			payload.helpTypes = [];

			const { errors } = validateCreateHelpRequest(payload);

			expect(errors).toContain('`helpTypes` must contain at least one item.');
		});

		test('rejects non-array helpTypes', () => {
			const payload = buildPayload();
			payload.helpTypes = 'first_aid';

			const { errors } = validateCreateHelpRequest(payload);

			expect(errors).toContain('`helpTypes` must be an array of strings.');
		});

		test('rejects non-positive affectedPeopleCount', () => {
			const payload = buildPayload();
			payload.affectedPeopleCount = 0;

			const { errors } = validateCreateHelpRequest(payload);

			expect(errors).toContain('`affectedPeopleCount` must be an integer greater than or equal to 1.');
		});

		test('trims optional strings while preserving numeric phones', () => {
			const payload = buildPayload();
			payload.otherHelpText = '  extra detail  ';
			payload.bloodType = '  A+  ';
			payload.location.extraAddress = '  back door  ';

			const { value } = validateCreateHelpRequest(payload);

			expect(value.otherHelpText).toBe('extra detail');
			expect(value.bloodType).toBe('A+');
			expect(value.location.extraAddress).toBe('back door');
			expect(value.contact.alternativePhone).toBe(5321234567);
		});

		test('rejects invalid location fields', () => {
			const payload = buildPayload();
			payload.location.city = '   ';

			const { errors } = validateCreateHelpRequest(payload);

			expect(errors).toContain('`location.city` is required.');
		});

		test('accepts hybrid location coordinate object', () => {
			const payload = buildPayload();
			payload.location.coordinate = {
				latitude: 41.043,
				longitude: 29.009,
				source: 'MANUAL_MAP_PIN',
				capturedAt: '2026-04-18T11:20:00.000Z',
			};

			const { errors, value } = validateCreateHelpRequest(payload);

			expect(errors).toHaveLength(0);
			expect(value.location.coordinate).toBeTruthy();
			expect(value.location.coordinate.latitude).toBeCloseTo(41.043, 6);
			expect(value.location.coordinate.longitude).toBeCloseTo(29.009, 6);
		});

		test('rejects hybrid location coordinate when longitude is missing', () => {
			const payload = buildPayload();
			payload.location.coordinate = {
				latitude: 41.043,
			};

			const { errors } = validateCreateHelpRequest(payload);

			expect(errors).toContain('`location.coordinate.latitude` and `location.coordinate.longitude` must be provided together.');
		});

		test('rejects conflicting flat and nested coordinate values', () => {
			const payload = buildPayload();
			payload.location.latitude = 41.043;
			payload.location.longitude = 29.009;
			payload.location.coordinate = {
				latitude: 41.111,
				longitude: 29.009,
				source: 'MANUAL_MAP_PIN',
			};

			const { errors } = validateCreateHelpRequest(payload);

			expect(errors).toContain('`location.latitude` conflicts with `location.coordinate.latitude`.');
		});

		test('rejects invalid contact fields', () => {
			const payload = buildPayload();
			payload.contact.phone = 4052318546;

			const { errors } = validateCreateHelpRequest(payload);

			expect(errors).toContain('`contact.phone` must be a 10-digit integer starting with 5.');
		});

		test('rejects invalid alternative phone fields', () => {
			const payload = buildPayload();
			payload.contact.alternativePhone = 532123456;

			const { errors } = validateCreateHelpRequest(payload);

			expect(errors).toContain('`contact.alternativePhone` must be a 10-digit integer starting with 5.');
		});

		test('rejects consentGiven when false', () => {
			const payload = buildPayload();
			payload.consentGiven = false;

			const { errors } = validateCreateHelpRequest(payload);

			expect(errors).toContain('`consentGiven` must be true.');
		});
	});

	describe('validateHelpRequestStatusUpdate', () => {
		test('accepts SYNCED', () => {
			const { errors, value } = validateHelpRequestStatusUpdate({ status: 'SYNCED' });

			expect(errors).toHaveLength(0);
			expect(value.status).toBe('SYNCED');
		});

		test('accepts RESOLVED', () => {
			const { errors, value } = validateHelpRequestStatusUpdate({ status: 'RESOLVED' });

			expect(errors).toHaveLength(0);
			expect(value.status).toBe('RESOLVED');
		});

		test('accepts CANCELLED', () => {
			const { errors, value } = validateHelpRequestStatusUpdate({ status: 'CANCELLED' });

			expect(errors).toHaveLength(0);
			expect(value.status).toBe('CANCELLED');
		});

		test('normalizes lowercase and trims whitespace', () => {
			const { errors, value } = validateHelpRequestStatusUpdate({ status: '  resolved  ' });

			expect(errors).toHaveLength(0);
			expect(value.status).toBe('RESOLVED');
		});

		test('rejects unsupported status value', () => {
			const { errors } = validateHelpRequestStatusUpdate({ status: 'FOO' });

			expect(errors.length).toBeGreaterThan(0);
			expect(errors[0]).toContain('SYNCED, RESOLVED, CANCELLED');
		});

		test('rejects missing status', () => {
			const { errors } = validateHelpRequestStatusUpdate({});

			expect(errors.length).toBeGreaterThan(0);
		});

		test('rejects non-string status', () => {
			const { errors } = validateHelpRequestStatusUpdate({ status: 123 });

			expect(errors.length).toBeGreaterThan(0);
		});
	});
});
