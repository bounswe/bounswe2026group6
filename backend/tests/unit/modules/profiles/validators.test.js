'use strict';

const {
	validateProfilePatch,
	validatePhysicalPatch,
	validateHealthPatch,
	validateLocationPatch,
	validatePrivacyPatch,
	validateProfessionPatch,
	validateExpertiseAreasPatch,
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

		test('accepts hybrid payload with administrative and coordinate objects', () => {
			const result = validateLocationPatch({
				displayAddress: 'Levazim, Besiktas, Istanbul',
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
					accuracyMeters: 12.5,
					source: 'MANUAL_MAP_PIN',
					capturedAt: '2026-04-18T11:20:00.000Z',
				},
			});

			expect(result.ok).toBe(true);
			expect(result.data.administrative.city).toBe('Istanbul');
			expect(result.data.coordinate.latitude).toBeCloseTo(41.043, 6);
		});

		test('rejects coordinate object when latitude/longitude are not paired', () => {
			const result = validateLocationPatch({
				coordinate: {
					latitude: 41.043,
				},
			});

			expect(result.ok).toBe(false);
			expect(result.message).toBe('coordinate.latitude and coordinate.longitude must be provided together');
		});

		test('rejects conflicting flat and nested latitude values', () => {
			const result = validateLocationPatch({
				latitude: 41.1,
				longitude: 29.0,
				coordinate: {
					latitude: 41.2,
					longitude: 29.0,
				},
			});

			expect(result.ok).toBe(false);
			expect(result.message).toBe('latitude conflicts with coordinate.latitude');
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
			expect(result.message).toBe('profession must be provided');
		});

		test('trims profession', () => {
			const result = validateProfessionPatch({ profession: '  Doctor  ' });

			expect(result.ok).toBe(true);
			expect(result.data).toEqual({ profession: 'Doctor' });
		});

		test('rejects profession longer than 200 characters', () => {
			const longProfession = 'a'.repeat(201);
			const result = validateProfessionPatch({ profession: longProfession });

			expect(result.ok).toBe(false);
			expect(result.message).toBe('profession must be at most 200 characters');
		});
	});

	describe('validateExpertiseAreasPatch', () => {
		test('accepts up to 5 unique expertise areas', () => {
			const result = validateExpertiseAreasPatch({
				expertiseAreas: [' First Aid ', 'Logistics', 'Search and Rescue'],
			});

			expect(result.ok).toBe(true);
			expect(result.data).toEqual({
				expertiseAreas: ['First Aid', 'Logistics', 'Search and Rescue'],
			});
		});

		test('rejects more than 5 items', () => {
			const result = validateExpertiseAreasPatch({
				expertiseAreas: ['A', 'B', 'C', 'D', 'E', 'F'],
			});

			expect(result.ok).toBe(false);
			expect(result.message).toContain('at most 5');
		});

		test('rejects duplicate values', () => {
			const result = validateExpertiseAreasPatch({
				expertiseAreas: ['First Aid', 'First Aid'],
			});

			expect(result.ok).toBe(false);
			expect(result.message).toContain('duplicates');
		});

		test('rejects item longer than 35 characters', () => {
			const result = validateExpertiseAreasPatch({
				expertiseAreas: ['a'.repeat(36)],
			});

			expect(result.ok).toBe(false);
			expect(result.message).toContain('at most 35 characters');
		});

		test('accepts 5 items that fit within storage limit', () => {
			const result = validateExpertiseAreasPatch({
				expertiseAreas: ['First Aid', 'Logistics', 'Rescue', 'Medical', 'Radio'],
			});

			expect(result.ok).toBe(true);
			expect(result.data.expertiseAreas).toHaveLength(5);
		});

		test('accepts 5 max-length items (boundary: 191 chars serialized fits VARCHAR 200)', () => {
			const result = validateExpertiseAreasPatch({
				expertiseAreas: [
					'a'.repeat(35),
					'b'.repeat(35),
					'c'.repeat(35),
					'd'.repeat(35),
					'e'.repeat(35),
				],
			});

			expect(result.ok).toBe(true);
			expect(result.data.expertiseAreas).toHaveLength(5);
		});
	});
});
