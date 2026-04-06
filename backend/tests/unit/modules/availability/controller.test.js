const {
  handleSetAvailability,
  handleSyncAvailability,
  handleGetMyAssignment,
  handleCancelAssignment,
  handleResolveAssignment,
  handleGetAvailabilityStatus,
} = require('../../../../src/modules/availability/controller');
const service = require('../../../../src/modules/availability/service');

jest.mock('../../../../src/modules/availability/service');

describe('Availability Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { userId: 'user_123' },
      body: {},
      params: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  describe('handleSetAvailability', () => {
    it('should return 200 on success', async () => {
      req.body = { isAvailable: true };
      service.setAvailability.mockResolvedValue({ success: true });

      await handleSetAvailability(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should return 400 on validation error', async () => {
      req.body = {}; // isAvailable missing

      await handleSetAvailability(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    });
  });

  describe('handleGetMyAssignment', () => {
    it('should return 200 on success', async () => {
      service.getMyAssignment.mockResolvedValue({ assignment: {} });

      await handleGetMyAssignment(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 if not found', async () => {
      const error = new Error('Not found');
      error.code = 'NOT_FOUND';
      service.getMyAssignment.mockRejectedValue(error);

      await handleGetMyAssignment(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('handleCancelAssignment', () => {
    it('should return 200 on success', async () => {
      req.params.assignmentId = 'asg_123';
      service.cancelMyAssignment.mockResolvedValue({ success: true });

      await handleCancelAssignment(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 if assignmentId is missing', async () => {
      req.params = {};

      await handleCancelAssignment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('handleResolveAssignment', () => {
    it('should return 200 on success', async () => {
      req.body = { requestId: 'req_123' };
      service.resolveMyAssignment.mockResolvedValue({ success: true });

      await handleResolveAssignment(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('handleGetAvailabilityStatus', () => {
    it('should return 200 and the result from service', async () => {
      const mockResult = { isAvailable: true, volunteer: {}, assignment: null };
      service.getAvailabilityStatus.mockResolvedValue(mockResult);

      await handleGetAvailabilityStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should return 500 on service error', async () => {
      service.getAvailabilityStatus.mockRejectedValue(new Error('Unexpected error'));

      await handleGetAvailabilityStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INTERNAL_ERROR' }));
    });
  });
});
