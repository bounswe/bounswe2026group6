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
		test('defaults needType to general when missing', () => {
			const { errors, warnings, value } = validateCreateHelpRequest({});

			expect(errors).toHaveLength(0);
			expect(value.needType).toBe('general');
			expect(warnings).toContainEqual(expect.stringContaining('defaulting to'));
		});

		test('accepts provided needType', () => {
			const { errors, value } = validateCreateHelpRequest({ needType: 'medical' });

			expect(errors).toHaveLength(0);
			expect(value.needType).toBe('medical');
		});

		test('trims needType', () => {
			const { value } = validateCreateHelpRequest({ needType: '  fire  ' });

			expect(value.needType).toBe('fire');
		});

		test('rejects needType longer than 200 characters', () => {
			const { errors } = validateCreateHelpRequest({ needType: 'a'.repeat(201) });

			expect(errors.length).toBeGreaterThan(0);
			expect(errors[0]).toContain('200 characters');
		});

		test('trims and accepts description', () => {
			const { value } = validateCreateHelpRequest({ description: '  help me  ' });

			expect(value.description).toBe('help me');
		});

		test('sets description to null for empty string', () => {
			const { value } = validateCreateHelpRequest({ description: '   ' });

			expect(value.description).toBeNull();
		});

		test('sets description to null when not a string', () => {
			const { value } = validateCreateHelpRequest({ description: 123 });

			expect(value.description).toBeNull();
		});

		test('defaults isSavedLocally to false', () => {
			const { value } = validateCreateHelpRequest({});

			expect(value.isSavedLocally).toBe(false);
		});

		test('accepts boolean isSavedLocally', () => {
			const { value } = validateCreateHelpRequest({ isSavedLocally: true });

			expect(value.isSavedLocally).toBe(true);
		});

		test('defaults isSavedLocally to false for non-boolean', () => {
			const { value } = validateCreateHelpRequest({ isSavedLocally: 'yes' });

			expect(value.isSavedLocally).toBe(false);
		});

		test('warns when location is not provided', () => {
			const { warnings, value } = validateCreateHelpRequest({});

			expect(value.location).toBeNull();
			expect(warnings).toContainEqual(expect.stringContaining('Location was not provided'));
		});

		test('rejects non-object location', () => {
			const { errors } = validateCreateHelpRequest({ location: 'here' });

			expect(errors).toContainEqual(expect.stringContaining('must be an object'));
		});

		test('rejects array location', () => {
			const { errors } = validateCreateHelpRequest({ location: [1, 2] });

			expect(errors).toContainEqual(expect.stringContaining('must be an object'));
		});

		test('rejects latitude out of range', () => {
			const { errors } = validateCreateHelpRequest({
				location: { latitude: 91, longitude: 28 },
			});

			expect(errors).toContainEqual(expect.stringContaining('latitude'));
		});

		test('rejects longitude out of range', () => {
			const { errors } = validateCreateHelpRequest({
				location: { latitude: 41, longitude: 181 },
			});

			expect(errors).toContainEqual(expect.stringContaining('longitude'));
		});

		test('rejects non-numeric latitude', () => {
			const { errors } = validateCreateHelpRequest({
				location: { latitude: 'north', longitude: 28 },
			});

			expect(errors).toContainEqual(expect.stringContaining('latitude'));
		});

		test('accepts valid location with defaults for booleans', () => {
			const { errors, value } = validateCreateHelpRequest({
				location: { latitude: 41.0, longitude: 28.9 },
			});

			expect(errors).toHaveLength(0);
			expect(value.location).toEqual({
				latitude: 41.0,
				longitude: 28.9,
				isGpsLocation: false,
				isLastKnown: false,
			});
		});

		test('accepts location with explicit boolean flags', () => {
			const { errors, value } = validateCreateHelpRequest({
				location: { latitude: 41.0, longitude: 28.9, isGpsLocation: true, isLastKnown: true },
			});

			expect(errors).toHaveLength(0);
			expect(value.location.isGpsLocation).toBe(true);
			expect(value.location.isLastKnown).toBe(true);
		});

		test('sets location to null when coordinate errors exist', () => {
			const { value } = validateCreateHelpRequest({
				location: { latitude: 999, longitude: 28 },
			});

			expect(value.location).toBeNull();
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

		test('normalizes lowercase and trims whitespace', () => {
			const { errors, value } = validateHelpRequestStatusUpdate({ status: '  resolved  ' });

			expect(errors).toHaveLength(0);
			expect(value.status).toBe('RESOLVED');
		});

		test('rejects unsupported status value', () => {
			const { errors } = validateHelpRequestStatusUpdate({ status: 'CANCELLED' });

			expect(errors.length).toBeGreaterThan(0);
			expect(errors[0]).toContain('SYNCED, RESOLVED');
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
