'use strict';

jest.mock('../../../../src/modules/profiles/repository', () => ({
	findActiveUserById: jest.fn(),
	findProfileByUserId: jest.fn(),
	createProfileByUserId: jest.fn(),
	updateProfileByUserId: jest.fn(),
	upsertPhysicalInfo: jest.fn(),
	upsertHealthInfo: jest.fn(),
	upsertLocationProfile: jest.fn(),
	upsertPrivacySettings: jest.fn(),
	upsertProfession: jest.fn(),
	findProfileBundleByUserId: jest.fn(),
	listExpertiseByProfileId: jest.fn(),
}));

const repository = require('../../../../src/modules/profiles/repository');
const {
	getMyProfile,
	patchMyProfile,
	patchMyPhysical,
	patchMyHealth,
	patchMyLocation,
	patchMyPrivacy,
	patchMyProfession,
} = require('../../../../src/modules/profiles/service');

function makeBundleRow(overrides = {}) {
	return {
		profile_id: 'prf_1',
		user_id: 'u1',
		first_name: 'Ada',
		last_name: 'Lovelace',
		phone_number: null,
		profile_visibility: null,
		health_info_visibility: null,
		location_visibility: null,
		location_sharing_enabled: null,
		medical_conditions: null,
		chronic_diseases: null,
		allergies: null,
		medications: null,
		blood_type: null,
		age: null,
		date_of_birth: null,
		gender: null,
		height: null,
		weight: null,
		address: null,
		city: null,
		country: null,
		latitude: null,
		longitude: null,
		last_updated: null,
		...overrides,
	};
}

describe('profiles service', () => {
	test('getMyProfile returns null when bundle does not exist', async () => {
		repository.findProfileBundleByUserId.mockResolvedValueOnce(null);

		const result = await getMyProfile('u1');

		expect(result).toBeNull();
		expect(repository.listExpertiseByProfileId).not.toHaveBeenCalled();
	});

	test('getMyProfile includes expertise list', async () => {
		repository.findProfileBundleByUserId.mockResolvedValueOnce(makeBundleRow());
		repository.listExpertiseByProfileId.mockResolvedValueOnce([
			{ expertiseId: 'exp_1', profession: 'Doctor', expertiseArea: 'ER', isVerified: false },
		]);

		const result = await getMyProfile('u1');

		expect(result.profile.userId).toBe('u1');
		expect(result.expertise).toHaveLength(1);
		expect(result.expertise[0].profession).toBe('Doctor');
	});

	test('getMyProfile maps date_of_birth to physicalInfo.dateOfBirth', async () => {
		repository.findProfileBundleByUserId.mockResolvedValueOnce(
			makeBundleRow({ date_of_birth: '1998-06-20' }),
		);
		repository.listExpertiseByProfileId.mockResolvedValueOnce([]);

		const result = await getMyProfile('u1');

		expect(result.physicalInfo.dateOfBirth).toBe('1998-06-20');
	});

	test('getMyProfile keeps locationProfile.coordinate null when only one coordinate value exists', async () => {
		repository.findProfileBundleByUserId.mockResolvedValueOnce(
			makeBundleRow({ latitude: 41.0, longitude: null }),
		);
		repository.listExpertiseByProfileId.mockResolvedValueOnce([]);

		const result = await getMyProfile('u1');

		expect(result.locationProfile.latitude).toBe(41.0);
		expect(result.locationProfile.longitude).toBeNull();
		expect(result.locationProfile.coordinate).toBeNull();
	});

	test('getMyProfile includes locationProfile.coordinate when latitude and longitude both exist', async () => {
		repository.findProfileBundleByUserId.mockResolvedValueOnce(
			makeBundleRow({ latitude: 41.0123, longitude: 29.0456 }),
		);
		repository.listExpertiseByProfileId.mockResolvedValueOnce([]);

		const result = await getMyProfile('u1');

		expect(result.locationProfile.coordinate).toEqual(
			expect.objectContaining({
				latitude: 41.0123,
				longitude: 29.0456,
			}),
		);
	});

	test('patchMyProfile creates profile when missing', async () => {
		repository.findActiveUserById.mockResolvedValueOnce({ user_id: 'u1' });
		repository.findProfileByUserId.mockResolvedValueOnce(null);
		repository.createProfileByUserId.mockResolvedValueOnce({ profile_id: 'prf_1' });
		repository.findProfileBundleByUserId.mockResolvedValueOnce(makeBundleRow());
		repository.listExpertiseByProfileId.mockResolvedValueOnce([]);

		await patchMyProfile('u1', { firstName: 'Ada', lastName: 'Lovelace' });

		expect(repository.createProfileByUserId).toHaveBeenCalledWith('u1', { firstName: 'Ada', lastName: 'Lovelace' });
		expect(repository.updateProfileByUserId).not.toHaveBeenCalled();
	});

	test('patchMyProfile updates profile when existing', async () => {
		repository.findActiveUserById.mockResolvedValueOnce({ user_id: 'u1' });
		repository.findProfileByUserId.mockResolvedValueOnce({ profile_id: 'prf_1' });
		repository.updateProfileByUserId.mockResolvedValueOnce({ profile_id: 'prf_1' });
		repository.findProfileBundleByUserId.mockResolvedValueOnce(makeBundleRow());
		repository.listExpertiseByProfileId.mockResolvedValueOnce([]);

		await patchMyProfile('u1', { phoneNumber: '555' });

		expect(repository.updateProfileByUserId).toHaveBeenCalledWith('u1', { phoneNumber: '555' });
	});

	test('patchMyPhysical delegates to repository with provided fields', async () => {
		repository.findActiveUserById.mockResolvedValueOnce({ user_id: 'u1' });
		repository.findProfileByUserId.mockResolvedValueOnce({ profile_id: 'prf_1' });
		repository.findProfileBundleByUserId.mockResolvedValueOnce(makeBundleRow());
		repository.listExpertiseByProfileId.mockResolvedValueOnce([]);

		await patchMyPhysical('u1', { age: 21 }, ['age']);

		expect(repository.upsertPhysicalInfo).toHaveBeenCalledWith('prf_1', { age: 21 }, ['age']);
	});

	test('patchMyHealth delegates to repository with provided fields', async () => {
		repository.findActiveUserById.mockResolvedValueOnce({ user_id: 'u1' });
		repository.findProfileByUserId.mockResolvedValueOnce({ profile_id: 'prf_1' });
		repository.findProfileBundleByUserId.mockResolvedValueOnce(makeBundleRow());
		repository.listExpertiseByProfileId.mockResolvedValueOnce([]);

		await patchMyHealth('u1', { allergies: ['Peanut'] }, ['allergies']);

		expect(repository.upsertHealthInfo).toHaveBeenCalledWith('prf_1', { allergies: ['Peanut'] }, ['allergies']);
	});

	test('patchMyLocation delegates to repository with provided fields', async () => {
		repository.findActiveUserById.mockResolvedValueOnce({ user_id: 'u1' });
		repository.findProfileByUserId.mockResolvedValueOnce({ profile_id: 'prf_1' });
		repository.findProfileBundleByUserId.mockResolvedValueOnce(makeBundleRow());
		repository.listExpertiseByProfileId.mockResolvedValueOnce([]);

		await patchMyLocation('u1', { city: 'Istanbul' }, ['city']);

		expect(repository.upsertLocationProfile).toHaveBeenCalledWith('prf_1', { city: 'Istanbul' }, ['city']);
	});

	test('patchMyPrivacy delegates to repository with provided fields', async () => {
		repository.findActiveUserById.mockResolvedValueOnce({ user_id: 'u1' });
		repository.findProfileByUserId.mockResolvedValueOnce({ profile_id: 'prf_1' });
		repository.findProfileBundleByUserId.mockResolvedValueOnce(makeBundleRow());
		repository.listExpertiseByProfileId.mockResolvedValueOnce([]);

		await patchMyPrivacy('u1', { locationSharingEnabled: true }, ['locationSharingEnabled']);

		expect(repository.upsertPrivacySettings).toHaveBeenCalledWith('prf_1', { locationSharingEnabled: true }, ['locationSharingEnabled']);
	});

	test('patchMyProfession throws PROFILE_NOT_FOUND when base profile is missing', async () => {
		repository.findActiveUserById.mockResolvedValueOnce({ user_id: 'u1' });
		repository.findProfileByUserId.mockResolvedValueOnce(null);

		await expect(patchMyProfession('u1', { profession: 'Doctor' }))
			.rejects
			.toThrow('PROFILE_NOT_FOUND');
	});

	test('patchMyProfession updates expertise and returns refreshed profile', async () => {
		repository.findActiveUserById.mockResolvedValue({ user_id: 'u1' });
		repository.findProfileByUserId.mockResolvedValueOnce({ profile_id: 'prf_1' });
		repository.upsertProfession.mockResolvedValueOnce();
		repository.findProfileBundleByUserId.mockResolvedValueOnce(makeBundleRow());
		repository.listExpertiseByProfileId.mockResolvedValueOnce([
			{ expertiseId: 'exp_1', profession: 'Nurse', expertiseArea: null, isVerified: false },
		]);

		const result = await patchMyProfession('u1', { profession: 'Nurse' });

		expect(repository.upsertProfession).toHaveBeenCalledWith('prf_1', { profession: 'Nurse' });
		expect(result.expertise[0].profession).toBe('Nurse');
	});
});
