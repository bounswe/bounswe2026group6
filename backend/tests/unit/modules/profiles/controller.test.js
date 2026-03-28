'use strict';

jest.mock('../../../../src/modules/profiles/service', () => ({
	getMyProfile: jest.fn(),
	hasProfile: jest.fn(),
	patchMyProfile: jest.fn(),
	patchMyPhysical: jest.fn(),
	patchMyHealth: jest.fn(),
	patchMyLocation: jest.fn(),
	patchMyPrivacy: jest.fn(),
	patchMyProfession: jest.fn(),
}));

jest.mock('../../../../src/modules/profiles/validators', () => ({
	readUserId: jest.fn(),
	validateProfilePatch: jest.fn(),
	validatePhysicalPatch: jest.fn(),
	validateHealthPatch: jest.fn(),
	validateLocationPatch: jest.fn(),
	validatePrivacyPatch: jest.fn(),
	validateProfessionPatch: jest.fn(),
}));

const service = require('../../../../src/modules/profiles/service');
const validators = require('../../../../src/modules/profiles/validators');
const {
	getMe,
	patchMe,
	patchPhysical,
	patchHealth,
	patchLocation,
	patchPrivacy,
	patchProfession,
} = require('../../../../src/modules/profiles/controller');

function buildResponse() {
	const response = {};
	response.status = jest.fn().mockReturnValue(response);
	response.json = jest.fn().mockReturnValue(response);
	return response;
}

describe('profiles controller', () => {
	test('getMe returns 404 when profile does not exist', async () => {
		validators.readUserId.mockReturnValueOnce('u1');
		service.getMyProfile.mockResolvedValueOnce(null);
		const response = buildResponse();

		await getMe({}, response);

		expect(response.status).toHaveBeenCalledWith(404);
		expect(response.json).toHaveBeenCalledWith({ code: 'NOT_FOUND', message: 'Profile not found' });
	});

	test('patchMe returns 200 when payload is valid', async () => {
		validators.readUserId.mockReturnValueOnce('u1');
		service.hasProfile.mockResolvedValueOnce(true);
		validators.validateProfilePatch.mockReturnValueOnce({ ok: true, data: { firstName: 'Ada' } });
		service.patchMyProfile.mockResolvedValueOnce({ profile: { userId: 'u1' } });
		const response = buildResponse();

		await patchMe({ body: { firstName: 'Ada' } }, response);

		expect(service.patchMyProfile).toHaveBeenCalledWith('u1', { firstName: 'Ada' });
		expect(response.status).toHaveBeenCalledWith(200);
	});

	test('patchMe returns 400 for invalid payload', async () => {
		validators.readUserId.mockReturnValueOnce('u1');
		service.hasProfile.mockResolvedValueOnce(false);
		validators.validateProfilePatch.mockReturnValueOnce({
			ok: false,
			code: 'VALIDATION_ERROR',
			message: 'firstName and lastName are required to create profile',
		});
		const response = buildResponse();

		await patchMe({ body: {} }, response);

		expect(response.status).toHaveBeenCalledWith(400);
	});

	test('patchPhysical returns 200 on success', async () => {
		validators.readUserId.mockReturnValueOnce('u1');
		validators.validatePhysicalPatch.mockReturnValueOnce({ ok: true, data: { age: 20 } });
		service.patchMyPhysical.mockResolvedValueOnce({ profile: { userId: 'u1' } });
		const response = buildResponse();

		await patchPhysical({ body: { age: 20 } }, response);

		expect(service.patchMyPhysical).toHaveBeenCalledWith('u1', { age: 20 }, ['age']);
		expect(response.status).toHaveBeenCalledWith(200);
	});

	test('patchHealth returns 200 on success', async () => {
		validators.readUserId.mockReturnValueOnce('u1');
		validators.validateHealthPatch.mockReturnValueOnce({ ok: true, data: { allergies: ['Peanut'] } });
		service.patchMyHealth.mockResolvedValueOnce({ profile: { userId: 'u1' } });
		const response = buildResponse();

		await patchHealth({ body: { allergies: ['Peanut'] } }, response);

		expect(service.patchMyHealth).toHaveBeenCalledWith('u1', { allergies: ['Peanut'] }, ['allergies']);
		expect(response.status).toHaveBeenCalledWith(200);
	});

	test('patchLocation returns 400 for invalid location payload', async () => {
		validators.readUserId.mockReturnValueOnce('u1');
		validators.validateLocationPatch.mockReturnValueOnce({
			ok: false,
			code: 'VALIDATION_ERROR',
			message: 'latitude and longitude must be provided together',
		});
		const response = buildResponse();

		await patchLocation({ body: { latitude: 41 } }, response);

		expect(response.status).toHaveBeenCalledWith(400);
	});

	test('patchPrivacy returns 200 on success', async () => {
		validators.readUserId.mockReturnValueOnce('u1');
		validators.validatePrivacyPatch.mockReturnValueOnce({ ok: true, data: { locationSharingEnabled: true } });
		service.patchMyPrivacy.mockResolvedValueOnce({ profile: { userId: 'u1' } });
		const response = buildResponse();

		await patchPrivacy({ body: { locationSharingEnabled: true } }, response);

		expect(service.patchMyPrivacy).toHaveBeenCalledWith('u1', { locationSharingEnabled: true }, ['locationSharingEnabled']);
		expect(response.status).toHaveBeenCalledWith(200);
	});

	test('patchProfession returns 401 when user is missing', async () => {
		validators.readUserId.mockReturnValueOnce(null);
		const response = buildResponse();

		await patchProfession({}, response);

		expect(response.status).toHaveBeenCalledWith(401);
		expect(response.json).toHaveBeenCalledWith({ code: 'UNAUTHORIZED', message: 'Authentication required' });
	});

	test('patchProfession returns 400 for validation error', async () => {
		validators.readUserId.mockReturnValueOnce('u1');
		validators.validateProfessionPatch.mockReturnValueOnce({
			ok: false,
			code: 'VALIDATION_ERROR',
			message: 'profession must be a non-empty string',
		});
		const response = buildResponse();

		await patchProfession({ body: {} }, response);

		expect(response.status).toHaveBeenCalledWith(400);
		expect(response.json).toHaveBeenCalledWith({ code: 'VALIDATION_ERROR', message: 'profession must be a non-empty string' });
	});

	test('patchProfession returns 200 with profile response on success', async () => {
		validators.readUserId.mockReturnValueOnce('u1');
		validators.validateProfessionPatch.mockReturnValueOnce({ ok: true, data: { profession: 'Doctor' } });
		service.patchMyProfession.mockResolvedValueOnce({ profile: { userId: 'u1' }, expertise: [] });
		const response = buildResponse();

		await patchProfession({ body: { profession: 'Doctor' } }, response);

		expect(service.patchMyProfession).toHaveBeenCalledWith('u1', { profession: 'Doctor' });
		expect(response.status).toHaveBeenCalledWith(200);
	});

	test('patchProfession maps PROFILE_NOT_FOUND to 404', async () => {
		validators.readUserId.mockReturnValueOnce('u1');
		validators.validateProfessionPatch.mockReturnValueOnce({ ok: true, data: { profession: 'Doctor' } });
		service.patchMyProfession.mockRejectedValueOnce(new Error('PROFILE_NOT_FOUND'));
		const response = buildResponse();

		await patchProfession({ body: { profession: 'Doctor' } }, response);

		expect(response.status).toHaveBeenCalledWith(404);
		expect(response.json).toHaveBeenCalledWith({
			code: 'NOT_FOUND',
			message: 'Profile not found. Create base profile first via PATCH /api/profiles/me',
		});
	});
});
