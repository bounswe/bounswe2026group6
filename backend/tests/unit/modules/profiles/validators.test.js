'use strict';

const {
	validateProfilePatch,
	validatePhysicalPatch,
	validateHealthPatch,
	validateLocationPatch,
	validatePrivacyPatch,
	validateProfessionPatch,
} = require('../../../../src/modules/profiles/validators');

describe('profiles validators', () => {
	describe('validateProfilePatch', () => {
		test('accepts valid profile patch', () => {
			const result = validateProfilePatch({ firstName: 'Ada', lastName: 'Lovelace' }, { requireNames: true });

			expect(result.ok).toBe(true);
			expect(result.data).toEqual({ firstName: 'Ada', lastName: 'Lovelace' });
		});

		test('requires firstName and lastName when creating profile', () => {
			const result = validateProfilePatch({ firstName: 'Ada' }, { requireNames: true });

			expect(result.ok).toBe(false);
			expect(result.message).toContain('firstName and lastName are required');
		});
	});

	describe('validatePhysicalPatch', () => {
		test('accepts valid physical payload', () => {
			const result = validatePhysicalPatch({ age: 28, height: 171, weight: 66 });

			expect(result.ok).toBe(true);
		});

		test('rejects negative age', () => {
			const result = validatePhysicalPatch({ age: -1 });

			expect(result.ok).toBe(false);
			expect(result.message).toBe('age must be a number >= 0');
		});
	});

	describe('validateHealthPatch', () => {
		test('accepts valid health payload', () => {
			const result = validateHealthPatch({ allergies: ['Peanut'], bloodType: 'A+' });

			expect(result.ok).toBe(true);
		});

		test('rejects non-string items in list fields', () => {
			const result = validateHealthPatch({ medications: ['MedA', 12] });

			expect(result.ok).toBe(false);
			expect(result.message).toBe('medications must be an array of strings');
		});
	});

	describe('validateLocationPatch', () => {
		test('rejects payload without latitude/longitude pair', () => {
			const result = validateLocationPatch({ latitude: 41.01 });

			expect(result.ok).toBe(false);
			expect(result.message).toBe('latitude and longitude must be provided together');
		});

		test('accepts partial string-only location update', () => {
			const result = validateLocationPatch({ city: 'Istanbul' });

			expect(result.ok).toBe(true);
			expect(result.data).toEqual({ city: 'Istanbul' });
		});

		test('accepts full coordinates in valid ranges', () => {
			const result = validateLocationPatch({ latitude: 41.0082, longitude: 28.9784 });

			expect(result.ok).toBe(true);
			expect(result.data).toEqual({ latitude: 41.0082, longitude: 28.9784 });
		});
	});

	describe('validatePrivacyPatch', () => {
		test('accepts valid privacy payload', () => {
			const result = validatePrivacyPatch({ profileVisibility: 'PUBLIC', locationSharingEnabled: true });

			expect(result.ok).toBe(true);
		});

		test('rejects invalid visibility value', () => {
			const result = validatePrivacyPatch({ profileVisibility: 'FRIENDS_ONLY' });

			expect(result.ok).toBe(false);
			expect(result.message).toContain('must be one of PUBLIC, EMERGENCY_ONLY, PRIVATE');
		});
	});

	describe('validateProfessionPatch', () => {
		test('rejects empty payload', () => {
			const result = validateProfessionPatch({});

			expect(result.ok).toBe(false);
			expect(result.message).toContain('At least one profession field');
		});

		test('trims profession and accepts optional expertiseArea', () => {
			const result = validateProfessionPatch({ profession: '  Doctor  ', expertiseArea: ' ER ' });

			expect(result.ok).toBe(true);
			expect(result.data).toEqual({ profession: 'Doctor', expertiseArea: 'ER' });
		});

		test('rejects profession longer than 200 characters', () => {
			const longProfession = 'a'.repeat(201);
			const result = validateProfessionPatch({ profession: longProfession });

			expect(result.ok).toBe(false);
			expect(result.message).toBe('profession must be at most 200 characters');
		});
	});
});
