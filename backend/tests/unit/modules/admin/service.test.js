'use strict';

jest.mock('../../../../src/modules/admin/repository');
jest.mock('../../../../src/modules/help-requests/repository', () => ({
  listHelpRequestsByUserId: jest.fn(),
  markHelpRequestAsCancelled: jest.fn(),
}));
jest.mock('../../../../src/modules/availability/service', () => ({
  cancelAssignmentByRequestId: jest.fn(),
  cancelAssignmentsForBannedVolunteer: jest.fn(),
  tryToAssignRequest: jest.fn(),
}));
jest.mock('../../../../src/db/pool', () => ({
  pool: {
    connect: jest.fn(),
  },
}));

const {
  getUsersForAdmin,
  banUserForAdmin,
  getHelpRequestsForAdmin,
  getAnnouncementsForAdmin,
  getStatsForAdmin,
  getEmergencyOverviewForAdmin,
  getEmergencyHistoryForAdmin,
} = require('../../../../src/modules/admin/service');

const {
  listUsers,
  banUserById,
  findBanTargetByUserId,
  unbanUserById,
  listHelpRequests,
  listAnnouncements,
  getBasicStats,
  getEmergencyOverview,
  getEmergencyHistory,
} = require('../../../../src/modules/admin/repository');
const {
  listHelpRequestsByUserId,
  markHelpRequestAsCancelled,
} = require('../../../../src/modules/help-requests/repository');
const {
  cancelAssignmentByRequestId,
  cancelAssignmentsForBannedVolunteer,
  tryToAssignRequest,
} = require('../../../../src/modules/availability/service');
const { pool } = require('../../../../src/db/pool');

let mockClient;

beforeEach(() => {
  jest.clearAllMocks();
  mockClient = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  };
  pool.connect.mockResolvedValue(mockClient);
});

describe('admin service', () => {
  test('getUsersForAdmin delegates to repository', async () => {
    listUsers.mockResolvedValue({
      users: [
        {
          user_id: 'u1',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          is_email_verified: true,
          is_banned: false,
          ban_reason: null,
          banned_at: null,
          created_at: '2026-05-01T10:00:00.000Z',
          admin_id: null,
          admin_role: null,
        },
      ],
      total: 1,
    });

    const result = await getUsersForAdmin();

    expect(listUsers).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      users: [
        {
          userId: 'u1',
          username: 'John Doe',
          email: 'john@example.com',
          isEmailVerified: true,
          isBanned: false,
          banReason: null,
          bannedAt: null,
          createdAt: '2026-05-01T10:00:00.000Z',
          isAdmin: false,
          adminRole: null,
        },
      ],
      total: 1,
    });
  });

  test('banUserForAdmin bans user and applies requester/volunteer cleanup', async () => {
    findBanTargetByUserId.mockResolvedValue({ user_id: 'u1', is_admin: false });
    banUserById.mockResolvedValue({
      user_id: 'u1',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      is_email_verified: true,
      is_banned: true,
      ban_reason: 'Abuse',
      banned_at: '2026-05-01T11:00:00.000Z',
      created_at: '2026-05-01T10:00:00.000Z',
      admin_id: null,
      admin_role: null,
    });
    listHelpRequestsByUserId.mockResolvedValue([
      { id: 'req-open-1', internalStatus: 'PENDING' },
      { id: 'req-open-2', internalStatus: 'ASSIGNED' },
      { id: 'req-closed', internalStatus: 'RESOLVED' },
    ]);
    markHelpRequestAsCancelled.mockResolvedValue({});
    cancelAssignmentByRequestId.mockResolvedValue();
    cancelAssignmentsForBannedVolunteer.mockResolvedValue({
      affectedRequestId: 'req-open-1',
    });
    tryToAssignRequest.mockResolvedValue(true);

    const result = await banUserForAdmin({ userId: 'u1', reason: 'Abuse' });

    expect(pool.connect).toHaveBeenCalledTimes(1);
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(findBanTargetByUserId).toHaveBeenCalledWith('u1', mockClient);
    expect(banUserById).toHaveBeenCalledWith('u1', 'Abuse', mockClient);
    expect(listHelpRequestsByUserId).toHaveBeenCalledWith('u1', mockClient);
    expect(markHelpRequestAsCancelled).toHaveBeenCalledTimes(2);
    expect(markHelpRequestAsCancelled).toHaveBeenNthCalledWith(1, 'u1', 'req-open-1', mockClient);
    expect(markHelpRequestAsCancelled).toHaveBeenNthCalledWith(2, 'u1', 'req-open-2', mockClient);
    expect(cancelAssignmentByRequestId).toHaveBeenCalledTimes(2);
    expect(cancelAssignmentByRequestId).toHaveBeenNthCalledWith(1, 'req-open-1', {
      db: mockClient,
      notify: false,
      runMatching: false,
    });
    expect(cancelAssignmentByRequestId).toHaveBeenNthCalledWith(2, 'req-open-2', {
      db: mockClient,
      notify: false,
      runMatching: false,
    });
    expect(cancelAssignmentsForBannedVolunteer).toHaveBeenCalledWith('u1', {
      db: mockClient,
      notify: false,
      runMatching: false,
    });
    expect(tryToAssignRequest).toHaveBeenCalledWith('req-open-1');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        userId: 'u1',
        isBanned: true,
        banReason: 'Abuse',
      }),
    );
  });

  test('banUserForAdmin returns null for missing user without side effects', async () => {
    findBanTargetByUserId.mockResolvedValue(null);

    const result = await banUserForAdmin({ userId: 'missing', reason: null });

    expect(result).toBeNull();
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(banUserById).not.toHaveBeenCalled();
    expect(listHelpRequestsByUserId).not.toHaveBeenCalled();
    expect(markHelpRequestAsCancelled).not.toHaveBeenCalled();
    expect(cancelAssignmentByRequestId).not.toHaveBeenCalled();
    expect(cancelAssignmentsForBannedVolunteer).not.toHaveBeenCalled();
  });

  test('banUserForAdmin blocks self-ban attempts', async () => {
    await expect(
      banUserForAdmin({ actorUserId: 'admin_1', userId: 'admin_1', reason: 'self' }),
    ).rejects.toMatchObject({ code: 'SELF_BAN_FORBIDDEN' });

    expect(pool.connect).not.toHaveBeenCalled();
    expect(findBanTargetByUserId).not.toHaveBeenCalled();
    expect(banUserById).not.toHaveBeenCalled();
  });

  test('banUserForAdmin blocks admin targets', async () => {
    findBanTargetByUserId.mockResolvedValue({ user_id: 'admin_2', is_admin: true });

    await expect(
      banUserForAdmin({ actorUserId: 'admin_1', userId: 'admin_2', reason: 'nope' }),
    ).rejects.toMatchObject({ code: 'ADMIN_BAN_FORBIDDEN' });

    expect(findBanTargetByUserId).toHaveBeenCalledWith('admin_2', mockClient);
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(banUserById).not.toHaveBeenCalled();
    expect(listHelpRequestsByUserId).not.toHaveBeenCalled();
    expect(markHelpRequestAsCancelled).not.toHaveBeenCalled();
    expect(cancelAssignmentByRequestId).not.toHaveBeenCalled();
    expect(cancelAssignmentsForBannedVolunteer).not.toHaveBeenCalled();
  });

  test('banUserForAdmin rolls back transaction when cleanup fails', async () => {
    findBanTargetByUserId.mockResolvedValue({ user_id: 'u1', is_admin: false });
    banUserById.mockResolvedValue({
      user_id: 'u1',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      is_email_verified: true,
      is_banned: true,
      ban_reason: 'Abuse',
      banned_at: '2026-05-01T11:00:00.000Z',
      created_at: '2026-05-01T10:00:00.000Z',
      admin_id: null,
      admin_role: null,
    });
    listHelpRequestsByUserId.mockResolvedValue([]);
    cancelAssignmentsForBannedVolunteer.mockRejectedValue(new Error('cleanup failed'));

    await expect(
      banUserForAdmin({ userId: 'u1', reason: 'Abuse' }),
    ).rejects.toThrow('cleanup failed');

    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(unbanUserById).not.toHaveBeenCalled();
  });

  test('getHelpRequestsForAdmin delegates to repository', async () => {
    listHelpRequests.mockResolvedValue([{ request_id: 'r1' }]);

    const result = await getHelpRequestsForAdmin();

    expect(listHelpRequests).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ request_id: 'r1' }]);
  });

  test('getAnnouncementsForAdmin delegates to repository', async () => {
    listAnnouncements.mockResolvedValue([{ announcement_id: 'a1' }]);

    const result = await getAnnouncementsForAdmin();

    expect(listAnnouncements).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ announcement_id: 'a1' }]);
  });

  test('getStatsForAdmin delegates to repository', async () => {
    getBasicStats.mockResolvedValue({ totalUsers: 1 });

    const result = await getStatsForAdmin();

    expect(getBasicStats).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ totalUsers: 1 });
  });

  test('getEmergencyOverviewForAdmin delegates to repository', async () => {
    getEmergencyOverview.mockResolvedValue({ totals: { totalEmergencies: 3 } });

    const result = await getEmergencyOverviewForAdmin({ includeRegionSummary: true });

    expect(getEmergencyOverview).toHaveBeenCalledTimes(1);
    expect(getEmergencyOverview).toHaveBeenCalledWith({ includeRegionSummary: true });
    expect(result).toEqual({ totals: { totalEmergencies: 3 } });
  });

  test('getEmergencyHistoryForAdmin delegates to repository', async () => {
    getEmergencyHistory.mockResolvedValue({ history: [], total: 0 });

    const result = await getEmergencyHistoryForAdmin({
      statuses: ['RESOLVED'],
      cities: ['ankara'],
      needTypes: ['water'],
      urgencies: ['HIGH'],
      limit: 20,
    });

    expect(getEmergencyHistory).toHaveBeenCalledTimes(1);
    expect(getEmergencyHistory).toHaveBeenCalledWith({
      statuses: ['RESOLVED'],
      cities: ['ankara'],
      needTypes: ['water'],
      urgencies: ['HIGH'],
      limit: 20,
    });
    expect(result).toEqual({ history: [], total: 0 });
  });
});
