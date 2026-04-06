'use strict';

const jwt = require('jsonwebtoken');

jest.mock('../../../../src/modules/help-requests/repository', () => ({
	createHelpRequest: jest.fn(),
	listHelpRequestsByUserId: jest.fn(),
	findHelpRequestById: jest.fn(),
	findHelpRequestByIdForUser: jest.fn(),
	markHelpRequestAsSynced: jest.fn(),
	markHelpRequestAsSyncedByRequestId: jest.fn(),
	markHelpRequestAsResolved: jest.fn(),
	markHelpRequestAsResolvedByRequestId: jest.fn(),
}));

const repository = require('../../../../src/modules/help-requests/repository');
const {
	createMyHelpRequest,
	listMyHelpRequests,
	getMyHelpRequest,
	issueGuestHelpRequestAccessToken,
	getGuestHelpRequest,
	updateMyHelpRequestStatus,
	updateGuestHelpRequestStatus,
} = require('../../../../src/modules/help-requests/service');

describe('help-requests service', () => {
	describe('createMyHelpRequest', () => {
		test('delegates to repository with userId merged into input', async () => {
			const input = {
				helpTypes: ['first_aid', 'fire_brigade'],
				otherHelpText: '',
				affectedPeopleCount: 3,
				riskFlags: ['fire'],
				vulnerableGroups: ['children'],
				description: 'help',
				bloodType: 'A+',
				location: {
					country: 'turkiye',
					city: 'istanbul',
					district: 'besiktas',
					neighborhood: 'levazim',
					extraAddress: 'Bina B',
				},
				contact: {
					fullName: 'Ayse Yilmaz',
					phone: 5052318546,
					alternativePhone: 5321234567,
				},
				consentGiven: true,
			};
			const expected = { id: 'req_1', userId: 'u1', helpTypes: ['first_aid', 'fire_brigade'] };
			repository.createHelpRequest.mockResolvedValueOnce(expected);

			const result = await createMyHelpRequest('u1', input);

			expect(repository.createHelpRequest).toHaveBeenCalledWith({
				helpTypes: ['first_aid', 'fire_brigade'],
				otherHelpText: '',
				affectedPeopleCount: 3,
				riskFlags: ['fire'],
				vulnerableGroups: ['children'],
				description: 'help',
				bloodType: 'A+',
				location: {
					country: 'turkiye',
					city: 'istanbul',
					district: 'besiktas',
					neighborhood: 'levazim',
					extraAddress: 'Bina B',
				},
				contact: {
					fullName: 'Ayse Yilmaz',
					phone: 5052318546,
					alternativePhone: 5321234567,
				},
				consentGiven: true,
				userId: 'u1',
			});
			expect(result).toEqual(expected);
		});

		test('wraps FK violation (23503) as INVALID_USER', async () => {
			const dbError = new Error('FK violation');
			dbError.code = '23503';
			repository.createHelpRequest.mockRejectedValueOnce(dbError);

			await expect(createMyHelpRequest('bad_user', { helpTypes: ['general'] }))
				.rejects
				.toMatchObject({ code: 'INVALID_USER' });
		});

		test('re-throws non-FK errors unchanged', async () => {
			const dbError = new Error('connection lost');
			repository.createHelpRequest.mockRejectedValueOnce(dbError);

			await expect(createMyHelpRequest('u1', { helpTypes: ['general'] }))
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

	describe('guest access token flow', () => {
		test('issues a signed guest access token with requestId', () => {
			const token = issueGuestHelpRequestAccessToken('req_guest_1');
			const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-123');

			expect(typeof token).toBe('string');
			expect(decoded.requestId).toBe('req_guest_1');
			expect(decoded.scope).toBe('help_request_guest_read');
		});

		test('returns request for valid guest token and matching request', async () => {
			const token = issueGuestHelpRequestAccessToken('req_guest_2');
			const requestRow = { id: 'req_guest_2', userId: null, helpTypes: ['first_aid'] };
			repository.findHelpRequestById.mockResolvedValueOnce(requestRow);

			const result = await getGuestHelpRequest('req_guest_2', token);

			expect(repository.findHelpRequestById).toHaveBeenCalledWith('req_guest_2');
			expect(result).toEqual(requestRow);
		});

		test('returns null when guest-token request does not exist', async () => {
			const token = issueGuestHelpRequestAccessToken('req_guest_missing');
			repository.findHelpRequestById.mockResolvedValueOnce(null);

			const result = await getGuestHelpRequest('req_guest_missing', token);

			expect(result).toBeNull();
		});

		test('throws INVALID_GUEST_ACCESS_TOKEN for malformed token', async () => {
			await expect(getGuestHelpRequest('req_guest_3', 'bad-token'))
				.rejects
				.toMatchObject({ code: 'INVALID_GUEST_ACCESS_TOKEN' });
		});

		test('throws FORBIDDEN_GUEST_ACCESS when token requestId does not match url requestId', async () => {
			const token = issueGuestHelpRequestAccessToken('req_guest_other');

			await expect(getGuestHelpRequest('req_guest_4', token))
				.rejects
				.toMatchObject({ code: 'FORBIDDEN_GUEST_ACCESS' });
		});

		test('throws FORBIDDEN_GUEST_ACCESS when token is used for user-owned request', async () => {
			const token = issueGuestHelpRequestAccessToken('req_user_owned');
			repository.findHelpRequestById.mockResolvedValueOnce({
				id: 'req_user_owned',
				userId: 'u1',
			});

			await expect(getGuestHelpRequest('req_user_owned', token))
				.rejects
				.toMatchObject({ code: 'FORBIDDEN_GUEST_ACCESS' });
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

	describe('updateGuestHelpRequestStatus', () => {
		test('returns null when guest request not found', async () => {
			const token = issueGuestHelpRequestAccessToken('req_guest_missing');
			repository.findHelpRequestById.mockResolvedValueOnce(null);

			const result = await updateGuestHelpRequestStatus('req_guest_missing', 'RESOLVED', token);

			expect(result).toBeNull();
		});

		test('marks guest request as synced when current status allows it', async () => {
			const token = issueGuestHelpRequestAccessToken('req_guest_sync');
			repository.findHelpRequestById.mockResolvedValueOnce({
				id: 'req_guest_sync',
				userId: null,
				internalStatus: 'PENDING',
			});
			const updated = { id: 'req_guest_sync', status: 'SYNCED', isSavedLocally: false };
			repository.markHelpRequestAsSyncedByRequestId.mockResolvedValueOnce(updated);

			const result = await updateGuestHelpRequestStatus('req_guest_sync', 'SYNCED', token);

			expect(repository.markHelpRequestAsSyncedByRequestId).toHaveBeenCalledWith('req_guest_sync');
			expect(result).toEqual(updated);
		});

		test('marks guest request as resolved', async () => {
			const token = issueGuestHelpRequestAccessToken('req_guest_resolve');
			repository.findHelpRequestById.mockResolvedValueOnce({
				id: 'req_guest_resolve',
				userId: null,
				internalStatus: 'PENDING',
			});
			const updated = { id: 'req_guest_resolve', status: 'RESOLVED' };
			repository.markHelpRequestAsResolvedByRequestId.mockResolvedValueOnce(updated);

			const result = await updateGuestHelpRequestStatus('req_guest_resolve', 'RESOLVED', token);

			expect(repository.markHelpRequestAsResolvedByRequestId).toHaveBeenCalledWith('req_guest_resolve');
			expect(result).toEqual(updated);
		});

		test('returns current request idempotently when guest request is already RESOLVED', async () => {
			const token = issueGuestHelpRequestAccessToken('req_guest_done');
			const current = {
				id: 'req_guest_done',
				userId: null,
				internalStatus: 'RESOLVED',
			};
			repository.findHelpRequestById.mockResolvedValueOnce(current);

			const result = await updateGuestHelpRequestStatus('req_guest_done', 'RESOLVED', token);

			expect(repository.markHelpRequestAsResolvedByRequestId).not.toHaveBeenCalled();
			expect(result).toEqual(current);
		});

		test('throws INVALID_STATUS_TRANSITION when moving guest RESOLVED request to SYNCED', async () => {
			const token = issueGuestHelpRequestAccessToken('req_guest_locked');
			repository.findHelpRequestById.mockResolvedValueOnce({
				id: 'req_guest_locked',
				userId: null,
				internalStatus: 'RESOLVED',
			});

			await expect(updateGuestHelpRequestStatus('req_guest_locked', 'SYNCED', token))
				.rejects
				.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
		});
	});
});
