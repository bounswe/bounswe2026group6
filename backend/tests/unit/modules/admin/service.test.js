'use strict';

jest.mock('../../../../src/modules/admin/repository');

const {
  getUsersForAdmin,
  getHelpRequestsForAdmin,
  getAnnouncementsForAdmin,
  getStatsForAdmin,
  getEmergencyOverviewForAdmin,
  getEmergencyHistoryForAdmin,
} = require('../../../../src/modules/admin/service');

const {
  listUsers,
  listHelpRequests,
  listAnnouncements,
  getBasicStats,
  getEmergencyOverview,
  getEmergencyHistory,
} = require('../../../../src/modules/admin/repository');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('admin service', () => {
  test('getUsersForAdmin delegates to repository', async () => {
    listUsers.mockResolvedValue([{ user_id: 'u1' }]);

    const result = await getUsersForAdmin();

    expect(listUsers).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ user_id: 'u1' }]);
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
