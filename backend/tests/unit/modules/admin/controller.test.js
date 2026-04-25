'use strict';

jest.mock('../../../../src/modules/admin/service');

const {
  getAdminEmergencyOverview,
  getAdminEmergencyHistory,
} = require('../../../../src/modules/admin/controller');

const {
  getEmergencyOverviewForAdmin,
  getEmergencyHistoryForAdmin,
} = require('../../../../src/modules/admin/service');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getAdminEmergencyOverview', () => {
  test('200 - success', async () => {
    getEmergencyOverviewForAdmin.mockResolvedValue({
      totals: {
        totalEmergencies: 0,
        activeEmergencies: 0,
        resolvedEmergencies: 0,
        closedEmergencies: 0,
      },
      statusBreakdown: {
        pending: 0,
        inProgress: 0,
        resolved: 0,
        cancelled: 0,
      },
      urgencyBreakdown: {
        low: 0,
        medium: 0,
        high: 0,
      },
      recentActivity: {
        createdLast24Hours: 0,
        createdLast7Days: 0,
        resolvedLast24Hours: 0,
        resolvedLast7Days: 0,
        cancelledLast24Hours: 0,
        cancelledLast7Days: 0,
      },
      regionSummary: [],
    });

    const req = { query: {} };
    const res = mockRes();

    await getAdminEmergencyOverview(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(getEmergencyOverviewForAdmin).toHaveBeenCalledWith({
      includeRegionSummary: false,
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        overview: expect.any(Object),
      }),
    );
  });

  test('200 - passes includeRegionSummary=true when query flag is set', async () => {
    getEmergencyOverviewForAdmin.mockResolvedValue({
      totals: {
        totalEmergencies: 0,
        activeEmergencies: 0,
        resolvedEmergencies: 0,
        closedEmergencies: 0,
      },
      statusBreakdown: {
        pending: 0,
        inProgress: 0,
        resolved: 0,
        cancelled: 0,
      },
      urgencyBreakdown: {
        low: 0,
        medium: 0,
        high: 0,
      },
      recentActivity: {
        createdLast24Hours: 0,
        createdLast7Days: 0,
        resolvedLast24Hours: 0,
        resolvedLast7Days: 0,
        cancelledLast24Hours: 0,
        cancelledLast7Days: 0,
      },
      regionSummary: [],
    });
    const req = { query: { includeRegionSummary: 'true' } };
    const res = mockRes();

    await getAdminEmergencyOverview(req, res);

    expect(getEmergencyOverviewForAdmin).toHaveBeenCalledWith({
      includeRegionSummary: true,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('500 - internal error', async () => {
    getEmergencyOverviewForAdmin.mockRejectedValue(new Error('unexpected'));

    const req = { query: {} };
    const res = mockRes();

    await getAdminEmergencyOverview(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INTERNAL_ERROR',
      }),
    );
  });
});

describe('getAdminEmergencyHistory', () => {
  test('200 - success with default filters', async () => {
    getEmergencyHistoryForAdmin.mockResolvedValue({
      history: [],
      total: 0,
    });

    const req = { query: {} };
    const res = mockRes();

    await getAdminEmergencyHistory(req, res);

    expect(getEmergencyHistoryForAdmin).toHaveBeenCalledWith({
      statuses: null,
      cities: null,
      needTypes: null,
      urgencies: null,
      limit: 50,
      offset: 0,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      history: [],
      total: 0,
      filters: {
        status: [],
        city: [],
        type: [],
        urgency: [],
        limit: 50,
        offset: 0,
      },
    });
  });

  test('200 - parses comma filters', async () => {
    getEmergencyHistoryForAdmin.mockResolvedValue({
      history: [{ requestId: 'r1' }],
      total: 1,
    });

    const req = {
      query: {
        status: 'resolved,cancelled',
        city: 'Ankara, Izmir',
        type: 'water, shelter',
        urgency: 'high,medium',
        limit: '25',
        offset: '10',
      },
    };
    const res = mockRes();

    await getAdminEmergencyHistory(req, res);

    expect(getEmergencyHistoryForAdmin).toHaveBeenCalledWith({
      statuses: ['RESOLVED', 'CANCELLED'],
      cities: ['ankara', 'izmir'],
      needTypes: ['water', 'shelter'],
      urgencies: ['HIGH', 'MEDIUM'],
      limit: 25,
      offset: 10,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('400 - rejects invalid status filter', async () => {
    const req = { query: { status: 'pending' } };
    const res = mockRes();

    await getAdminEmergencyHistory(req, res);

    expect(getEmergencyHistoryForAdmin).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
      }),
    );
  });

  test('400 - rejects invalid limit', async () => {
    const req = { query: { limit: '0' } };
    const res = mockRes();

    await getAdminEmergencyHistory(req, res);

    expect(getEmergencyHistoryForAdmin).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('400 - rejects invalid offset', async () => {
    const req = { query: { offset: '-1' } };
    const res = mockRes();

    await getAdminEmergencyHistory(req, res);

    expect(getEmergencyHistoryForAdmin).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
      }),
    );
  });

  test('400 - rejects invalid urgency', async () => {
    const req = { query: { urgency: 'critical' } };
    const res = mockRes();

    await getAdminEmergencyHistory(req, res);

    expect(getEmergencyHistoryForAdmin).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
      }),
    );
  });

  test('500 - internal error', async () => {
    getEmergencyHistoryForAdmin.mockRejectedValue(new Error('unexpected'));

    const req = { query: {} };
    const res = mockRes();

    await getAdminEmergencyHistory(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INTERNAL_ERROR',
      }),
    );
  });
});
