'use strict';

jest.mock('../../../../src/modules/help-requests/service', () => ({
	createMyHelpRequest: jest.fn(),
	listMyHelpRequests: jest.fn(),
	getMyHelpRequest: jest.fn(),
	updateMyHelpRequestStatus: jest.fn(),
}));

jest.mock('../../../../src/modules/help-requests/validators', () => ({
	readUserId: jest.fn(),
	validateCreateHelpRequest: jest.fn(),
	validateHelpRequestStatusUpdate: jest.fn(),
}));

const service = require('../../../../src/modules/help-requests/service');
const validators = require('../../../../src/modules/help-requests/validators');
const {
	createHelpRequest,
	listHelpRequests,
	getHelpRequest,
	patchHelpRequestStatus,
} = require('../../../../src/modules/help-requests/controller');

function buildResponse() {
	const response = {};
	response.status = jest.fn().mockReturnValue(response);
	response.json = jest.fn().mockReturnValue(response);
	return response;
}

describe('help-requests controller', () => {
	describe('createHelpRequest', () => {
		test('returns 401 when user is missing', async () => {
			validators.readUserId.mockReturnValueOnce(null);
			const response = buildResponse();

			await createHelpRequest({ body: {} }, response);

			expect(response.status).toHaveBeenCalledWith(401);
			expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }));
		});

		test('returns 400 when validation fails', async () => {
			validators.readUserId.mockReturnValueOnce('u1');
			validators.validateCreateHelpRequest.mockReturnValueOnce({
				errors: ['`helpTypes` must contain at least one item.'],
				warnings: [],
				value: {},
			});
			const response = buildResponse();

			await createHelpRequest({ body: {} }, response);

			expect(response.status).toHaveBeenCalledWith(400);
			expect(response.json).toHaveBeenCalledWith({
				code: 'VALIDATION_FAILED',
				message: 'Validation failed',
				details: ['`helpTypes` must contain at least one item.'],
			});
		});

		test('returns 201 on success with warnings', async () => {
			validators.readUserId.mockReturnValueOnce('u1');
			validators.validateCreateHelpRequest.mockReturnValueOnce({
				errors: [],
				warnings: [],
				value: {
					helpTypes: ['first_aid'],
					otherHelpText: '',
					affectedPeopleCount: 1,
					riskFlags: [],
					vulnerableGroups: [],
					description: 'Need first aid',
					bloodType: 'A+',
					location: {
						country: 'turkiye',
						city: 'istanbul',
						district: 'besiktas',
						neighborhood: 'levazim',
						extraAddress: '',
					},
					contact: {
						fullName: 'Ayse Yilmaz',
						phone: 5052318546,
						alternativePhone: null,
					},
					consentGiven: true,
					needType: 'first_aid',
					isSavedLocally: false,
				},
			});
			const created = { id: 'req_1', userId: 'u1', helpTypes: ['first_aid'] };
			service.createMyHelpRequest.mockResolvedValueOnce(created);
			const response = buildResponse();

			await createHelpRequest({ body: {} }, response);

			expect(response.status).toHaveBeenCalledWith(201);
			expect(response.json).toHaveBeenCalledWith({
				request: created,
				warnings: [],
			});
		});

		test('returns 400 for INVALID_USER service error', async () => {
			validators.readUserId.mockReturnValueOnce('u1');
			validators.validateCreateHelpRequest.mockReturnValueOnce({
				errors: [],
				warnings: [],
				value: { helpTypes: ['first_aid'] },
			});
			const error = new Error('bad user');
			error.code = 'INVALID_USER';
			service.createMyHelpRequest.mockRejectedValueOnce(error);
			const response = buildResponse();

			await createHelpRequest({ body: {} }, response);

			expect(response.status).toHaveBeenCalledWith(400);
			expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_USER' }));
		});

		test('returns 500 for unexpected service errors', async () => {
			validators.readUserId.mockReturnValueOnce('u1');
			validators.validateCreateHelpRequest.mockReturnValueOnce({
				errors: [],
				warnings: [],
				value: { helpTypes: ['first_aid'] },
			});
			service.createMyHelpRequest.mockRejectedValueOnce(new Error('boom'));
			const response = buildResponse();

			await createHelpRequest({ body: {} }, response);

			expect(response.status).toHaveBeenCalledWith(500);
		});
	});

	describe('listHelpRequests', () => {
		test('returns 401 when user is missing', async () => {
			validators.readUserId.mockReturnValueOnce(null);
			const response = buildResponse();

			await listHelpRequests({}, response);

			expect(response.status).toHaveBeenCalledWith(401);
		});

		test('returns 200 with requests list', async () => {
			validators.readUserId.mockReturnValueOnce('u1');
			const requests = [{ id: 'req_1' }];
			service.listMyHelpRequests.mockResolvedValueOnce(requests);
			const response = buildResponse();

			await listHelpRequests({}, response);

			expect(response.status).toHaveBeenCalledWith(200);
			expect(response.json).toHaveBeenCalledWith({ requests });
		});

		test('returns 500 on service error', async () => {
			validators.readUserId.mockReturnValueOnce('u1');
			service.listMyHelpRequests.mockRejectedValueOnce(new Error('boom'));
			const response = buildResponse();

			await listHelpRequests({}, response);

			expect(response.status).toHaveBeenCalledWith(500);
		});
	});

	describe('getHelpRequest', () => {
		test('returns 401 when user is missing', async () => {
			validators.readUserId.mockReturnValueOnce(null);
			const response = buildResponse();

			await getHelpRequest({}, response);

			expect(response.status).toHaveBeenCalledWith(401);
		});

		test('returns 404 when request not found', async () => {
			validators.readUserId.mockReturnValueOnce('u1');
			service.getMyHelpRequest.mockResolvedValueOnce(null);
			const response = buildResponse();

			await getHelpRequest({ params: { requestId: 'req_1' } }, response);

			expect(response.status).toHaveBeenCalledWith(404);
			expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }));
		});

		test('returns 200 with request on success', async () => {
			validators.readUserId.mockReturnValueOnce('u1');
			const helpRequest = { id: 'req_1', userId: 'u1' };
			service.getMyHelpRequest.mockResolvedValueOnce(helpRequest);
			const response = buildResponse();

			await getHelpRequest({ params: { requestId: 'req_1' } }, response);

			expect(response.status).toHaveBeenCalledWith(200);
			expect(response.json).toHaveBeenCalledWith({ request: helpRequest });
		});

		test('returns 500 on service error', async () => {
			validators.readUserId.mockReturnValueOnce('u1');
			service.getMyHelpRequest.mockRejectedValueOnce(new Error('boom'));
			const response = buildResponse();

			await getHelpRequest({ params: { requestId: 'req_1' } }, response);

			expect(response.status).toHaveBeenCalledWith(500);
		});
	});

	describe('patchHelpRequestStatus', () => {
		test('returns 401 when user is missing', async () => {
			validators.readUserId.mockReturnValueOnce(null);
			const response = buildResponse();

			await patchHelpRequestStatus({ body: {} }, response);

			expect(response.status).toHaveBeenCalledWith(401);
		});

		test('returns 400 when validation fails', async () => {
			validators.readUserId.mockReturnValueOnce('u1');
			validators.validateHelpRequestStatusUpdate.mockReturnValueOnce({
				errors: ['`status` must be one of: SYNCED, RESOLVED.'],
				value: { status: '' },
			});
			const response = buildResponse();

			await patchHelpRequestStatus({ body: {} }, response);

			expect(response.status).toHaveBeenCalledWith(400);
			expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
		});

		test('returns 404 when request not found', async () => {
			validators.readUserId.mockReturnValueOnce('u1');
			validators.validateHelpRequestStatusUpdate.mockReturnValueOnce({
				errors: [],
				value: { status: 'RESOLVED' },
			});
			service.updateMyHelpRequestStatus.mockResolvedValueOnce(null);
			const response = buildResponse();

			await patchHelpRequestStatus({ body: {}, params: { requestId: 'req_1' } }, response);

			expect(response.status).toHaveBeenCalledWith(404);
		});

		test('returns 200 on successful status update', async () => {
			validators.readUserId.mockReturnValueOnce('u1');
			validators.validateHelpRequestStatusUpdate.mockReturnValueOnce({
				errors: [],
				value: { status: 'RESOLVED' },
			});
			const updated = { id: 'req_1', status: 'RESOLVED' };
			service.updateMyHelpRequestStatus.mockResolvedValueOnce(updated);
			const response = buildResponse();

			await patchHelpRequestStatus({ body: {}, params: { requestId: 'req_1' } }, response);

			expect(response.status).toHaveBeenCalledWith(200);
			expect(response.json).toHaveBeenCalledWith({ request: updated });
		});

		test('returns 409 for INVALID_STATUS_TRANSITION', async () => {
			validators.readUserId.mockReturnValueOnce('u1');
			validators.validateHelpRequestStatusUpdate.mockReturnValueOnce({
				errors: [],
				value: { status: 'SYNCED' },
			});
			const error = new Error('A resolved request cannot be moved back to synced.');
			error.code = 'INVALID_STATUS_TRANSITION';
			service.updateMyHelpRequestStatus.mockRejectedValueOnce(error);
			const response = buildResponse();

			await patchHelpRequestStatus({ body: {}, params: { requestId: 'req_1' } }, response);

			expect(response.status).toHaveBeenCalledWith(409);
			expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
				code: 'INVALID_STATUS_TRANSITION',
			}));
		});

		test('returns 500 on unexpected error', async () => {
			validators.readUserId.mockReturnValueOnce('u1');
			validators.validateHelpRequestStatusUpdate.mockReturnValueOnce({
				errors: [],
				value: { status: 'RESOLVED' },
			});
			service.updateMyHelpRequestStatus.mockRejectedValueOnce(new Error('boom'));
			const response = buildResponse();

			await patchHelpRequestStatus({ body: {}, params: { requestId: 'req_1' } }, response);

			expect(response.status).toHaveBeenCalledWith(500);
		});
	});
});
