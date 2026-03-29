'use strict';

jest.mock('../../../../src/modules/help-requests/repository', () => ({
	createHelpRequest: jest.fn(),
	listHelpRequestsByUserId: jest.fn(),
	findHelpRequestByIdForUser: jest.fn(),
	markHelpRequestAsSynced: jest.fn(),
	markHelpRequestAsResolved: jest.fn(),
}));

const repository = require('../../../../src/modules/help-requests/repository');
const {
	createMyHelpRequest,
	listMyHelpRequests,
	getMyHelpRequest,
	updateMyHelpRequestStatus,
} = require('../../../../src/modules/help-requests/service');

describe('help-requests service', () => {
	describe('createMyHelpRequest', () => {
		test('delegates to repository with userId merged into input', async () => {
			const input = { needType: 'medical', description: 'help' };
			const expected = { id: 'req_1', userId: 'u1', needType: 'medical' };
			repository.createHelpRequest.mockResolvedValueOnce(expected);

			const result = await createMyHelpRequest('u1', input);

			expect(repository.createHelpRequest).toHaveBeenCalledWith({
				needType: 'medical',
				description: 'help',
				userId: 'u1',
			});
			expect(result).toEqual(expected);
		});

		test('wraps FK violation (23503) as INVALID_USER', async () => {
			const dbError = new Error('FK violation');
			dbError.code = '23503';
			repository.createHelpRequest.mockRejectedValueOnce(dbError);

			await expect(createMyHelpRequest('bad_user', { needType: 'general' }))
				.rejects
				.toMatchObject({ code: 'INVALID_USER' });
		});

		test('re-throws non-FK errors unchanged', async () => {
			const dbError = new Error('connection lost');
			repository.createHelpRequest.mockRejectedValueOnce(dbError);

			await expect(createMyHelpRequest('u1', { needType: 'general' }))
				.rejects
				.toThrow('connection lost');
		});
	});

	describe('listMyHelpRequests', () => {
		test('delegates to repository', async () => {
			const requests = [{ id: 'req_1' }, { id: 'req_2' }];
			repository.listHelpRequestsByUserId.mockResolvedValueOnce(requests);

			const result = await listMyHelpRequests('u1');

			expect(repository.listHelpRequestsByUserId).toHaveBeenCalledWith('u1');
			expect(result).toEqual(requests);
		});
	});

	describe('getMyHelpRequest', () => {
		test('delegates to repository', async () => {
			const req = { id: 'req_1', userId: 'u1' };
			repository.findHelpRequestByIdForUser.mockResolvedValueOnce(req);

			const result = await getMyHelpRequest('u1', 'req_1');

			expect(repository.findHelpRequestByIdForUser).toHaveBeenCalledWith('u1', 'req_1');
			expect(result).toEqual(req);
		});

		test('returns null when not found', async () => {
			repository.findHelpRequestByIdForUser.mockResolvedValueOnce(null);

			const result = await getMyHelpRequest('u1', 'nonexistent');

			expect(result).toBeNull();
		});
	});

	describe('updateMyHelpRequestStatus', () => {
		test('returns null when request not found', async () => {
			repository.findHelpRequestByIdForUser.mockResolvedValueOnce(null);

			const result = await updateMyHelpRequestStatus('u1', 'req_1', 'SYNCED');

			expect(result).toBeNull();
		});

		test('marks as synced when current status allows it', async () => {
			const current = { id: 'req_1', internalStatus: 'PENDING' };
			const updated = { id: 'req_1', internalStatus: 'PENDING', isSavedLocally: false, status: 'SYNCED' };
			repository.findHelpRequestByIdForUser.mockResolvedValueOnce(current);
			repository.markHelpRequestAsSynced.mockResolvedValueOnce(updated);

			const result = await updateMyHelpRequestStatus('u1', 'req_1', 'SYNCED');

			expect(repository.markHelpRequestAsSynced).toHaveBeenCalledWith('u1', 'req_1');
			expect(result).toEqual(updated);
		});

		test('throws INVALID_STATUS_TRANSITION when moving RESOLVED to SYNCED', async () => {
			const current = { id: 'req_1', internalStatus: 'RESOLVED' };
			repository.findHelpRequestByIdForUser.mockResolvedValueOnce(current);

			await expect(updateMyHelpRequestStatus('u1', 'req_1', 'SYNCED'))
				.rejects
				.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
		});

		test('marks as resolved when current status is not RESOLVED', async () => {
			const current = { id: 'req_1', internalStatus: 'PENDING' };
			const updated = { id: 'req_1', internalStatus: 'RESOLVED' };
			repository.findHelpRequestByIdForUser.mockResolvedValueOnce(current);
			repository.markHelpRequestAsResolved.mockResolvedValueOnce(updated);

			const result = await updateMyHelpRequestStatus('u1', 'req_1', 'RESOLVED');

			expect(repository.markHelpRequestAsResolved).toHaveBeenCalledWith('u1', 'req_1');
			expect(result).toEqual(updated);
		});

		test('returns current request idempotently when already RESOLVED', async () => {
			const current = { id: 'req_1', internalStatus: 'RESOLVED' };
			repository.findHelpRequestByIdForUser.mockResolvedValueOnce(current);

			const result = await updateMyHelpRequestStatus('u1', 'req_1', 'RESOLVED');

			expect(repository.markHelpRequestAsResolved).not.toHaveBeenCalled();
			expect(result).toEqual(current);
		});

		test('throws INVALID_STATUS_TRANSITION for unsupported target status', async () => {
			const current = { id: 'req_1', internalStatus: 'PENDING' };
			repository.findHelpRequestByIdForUser.mockResolvedValueOnce(current);

			await expect(updateMyHelpRequestStatus('u1', 'req_1', 'CANCELLED'))
				.rejects
				.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
		});
	});
});
