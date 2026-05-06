const {
  setAvailability,
  syncAvailability,
  getMyAssignment,
  cancelMyAssignment,
  resolveMyAssignment,
  getAvailabilityStatus,
  tryToAssignRequest,
  cancelAssignmentByRequestId,
} = require('../../../../src/modules/availability/service');
const repository = require('../../../../src/modules/availability/repository');
const { createNotification } = require('../../../../src/modules/notifications/service');

jest.mock('../../../../src/modules/availability/repository');
jest.mock('../../../../src/modules/notifications/service', () => ({
  createNotification: jest.fn().mockResolvedValue({ id: 'notif_1' }),
}));

describe('Availability Service', () => {
  const userId = 'user_123';
  const volunteer = { volunteer_id: 'vol_123', user_id: userId, is_available: false };
  const assignment = { assignment_id: 'asg_123', volunteer_id: 'vol_123', request_id: 'req_123' };

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findAvailableVolunteersForMatching.mockResolvedValue([]);
    repository.findActiveAssignmentsByRequestId.mockResolvedValue([]);
    repository.findMatchingVolunteerForRequest.mockResolvedValue(null);
    repository.markRequestAssignedIfPending.mockResolvedValue(null);
    repository.syncRequestStatusPreservingInProgress.mockResolvedValue(null);
    repository.findRequestOwnerByRequestId.mockResolvedValue({ request_id: 'req_123', user_id: 'owner_123' });
  });

  describe('setAvailability', () => {
    it('should create a volunteer if not exists and update availability', async () => {
      repository.findVolunteerByUserId.mockResolvedValue(null);
      repository.createVolunteer.mockResolvedValue(volunteer);
      repository.updateVolunteerAvailability.mockResolvedValue({ ...volunteer, is_available: true });
      repository.getAssignmentByVolunteerId.mockResolvedValue(null);

      const result = await setAvailability(userId, { isAvailable: true, latitude: 41, longitude: 29 });

      expect(repository.createVolunteer).toHaveBeenCalledWith(userId);
      expect(repository.updateVolunteerAvailability).toHaveBeenCalledWith(
        'vol_123',
        true,
        41,
        29,
        expect.objectContaining({ availabilityTtlMinutes: expect.any(Number) }),
      );
      expect(repository.createAvailabilityRecord).toHaveBeenCalled();
      expect(result.volunteer.is_available).toBe(true);
    });

    it('should try to match a request if volunteer becomes available', async () => {
      repository.findVolunteerByUserId.mockResolvedValue(volunteer);
      repository.updateVolunteerAvailability.mockResolvedValue({ ...volunteer, is_available: true });
      repository.findAvailableVolunteersForMatching.mockResolvedValue([{ ...volunteer, is_available: true }]);
      repository.getAssignmentByVolunteerId.mockResolvedValue(null);
      repository.findMatchingRequestForVolunteer.mockResolvedValue({ request_id: 'req_123' });
      repository.createAssignment.mockResolvedValue(assignment);
      repository.getAssignmentByVolunteerId.mockResolvedValueOnce(null).mockResolvedValueOnce(assignment);

      const result = await setAvailability(userId, { isAvailable: true, latitude: 41, longitude: 29 });

      expect(repository.findMatchingRequestForVolunteer).toHaveBeenCalledWith('vol_123');
      expect(repository.createAssignment).toHaveBeenCalledWith('vol_123', 'req_123');
      expect(repository.markRequestAssignedIfPending).toHaveBeenCalledWith('req_123');
      expect(result.assignment).toEqual(assignment);
    });

    it('should skip request status updates when guarded assignment creation returns null', async () => {
      repository.findVolunteerByUserId.mockResolvedValue(volunteer);
      repository.updateVolunteerAvailability.mockResolvedValue({ ...volunteer, is_available: true });
      repository.findAvailableVolunteersForMatching.mockResolvedValue([{ ...volunteer, is_available: true }]);
      repository.getAssignmentByVolunteerId.mockResolvedValue(null);
      repository.findMatchingRequestForVolunteer.mockResolvedValue({ request_id: 'req_123' });
      repository.createAssignment.mockResolvedValue(null);

      const result = await setAvailability(userId, { isAvailable: true, latitude: 41, longitude: 29 });

      expect(repository.createAssignment).toHaveBeenCalledWith('vol_123', 'req_123');
      expect(repository.markRequestAssignedIfPending).not.toHaveBeenCalled();
      expect(result.assignment).toBeNull();
    });

    it('should cancel assignment if volunteer becomes unavailable', async () => {
      repository.findVolunteerByUserId.mockResolvedValue(volunteer);
      repository.updateVolunteerAvailability.mockResolvedValue({ ...volunteer, is_available: false });
      repository.getAssignmentByVolunteerId.mockResolvedValue(assignment);
      repository.findActiveAssignmentsByRequestId.mockResolvedValue([]);

      const result = await setAvailability(userId, { isAvailable: false });

      expect(repository.cancelAssignment).toHaveBeenCalledWith('asg_123');
      expect(repository.syncRequestStatusPreservingInProgress).toHaveBeenCalledWith('req_123');
      expect(result.volunteer.is_available).toBe(false);
    });
  });

  describe('syncAvailability', () => {
    it('should sync multiple records and update to latest status', async () => {
      repository.findVolunteerByUserId.mockResolvedValue(volunteer);
      repository.getAssignmentByVolunteerId.mockResolvedValue(null);
      
      const records = [
        { isAvailable: true, timestamp: '2023-01-01T10:00:00Z' },
        { isAvailable: false, timestamp: '2023-01-01T11:00:00Z' },
      ];

      await syncAvailability(userId, { records });

      expect(repository.updateVolunteerAvailability).toHaveBeenCalledWith('vol_123', false, undefined, undefined, {});
      expect(repository.createAvailabilityRecord).toHaveBeenCalledTimes(2);
    });

    it('should try to match a request if volunteer is now available', async () => {
      repository.findVolunteerByUserId.mockResolvedValueOnce(volunteer).mockResolvedValueOnce({ ...volunteer, is_available: true });
      repository.findAvailableVolunteersForMatching.mockResolvedValue([{ ...volunteer, is_available: true }]);
      repository.getAssignmentByVolunteerId.mockResolvedValue(null);
      repository.findMatchingRequestForVolunteer.mockResolvedValue({ request_id: 'req_123' });
      
      const records = [{ isAvailable: true, timestamp: '2023-01-01T10:00:00Z', latitude: 41, longitude: 29 }];

      await syncAvailability(userId, { records });

      expect(repository.createAssignment).toHaveBeenCalledWith('vol_123', 'req_123');
    });

    it('should cancel assignment if volunteer is now unavailable', async () => {
      repository.findVolunteerByUserId
        .mockResolvedValueOnce(volunteer)
        .mockResolvedValueOnce({ ...volunteer, is_available: false });
      repository.getAssignmentByVolunteerId.mockResolvedValue(assignment);
      repository.findActiveAssignmentsByRequestId.mockResolvedValue([]);
      
      const records = [{ isAvailable: false, timestamp: '2023-01-01T10:00:00Z' }];

      const result = await syncAvailability(userId, { records });

      expect(repository.cancelAssignment).toHaveBeenCalledWith('asg_123');
      expect(repository.syncRequestStatusPreservingInProgress).toHaveBeenCalledWith('req_123');
      expect(result.assignment).toBeNull();
    });
  });

  describe('getMyAssignment', () => {
    it('should return the current assignment', async () => {
      repository.findVolunteerByUserId.mockResolvedValue(volunteer);
      repository.getAssignmentByVolunteerId.mockResolvedValue(assignment);

      const result = await getMyAssignment(userId);

      expect(result.assignment).toEqual(assignment);
    });

    it('should throw NOT_FOUND if volunteer does not exist', async () => {
      repository.findVolunteerByUserId.mockResolvedValue(null);

      await expect(getMyAssignment(userId)).rejects.toThrow('Volunteer record not found');
    });
  });

  describe('cancelMyAssignment', () => {
    it('should cancel assignment, resync request status and set volunteer unavailable', async () => {
      repository.findVolunteerByUserId.mockResolvedValue(volunteer);
      repository.getAssignmentById.mockResolvedValue(assignment);
      repository.findActiveAssignmentsByRequestId.mockResolvedValue([]);

      const result = await cancelMyAssignment(userId, { assignmentId: 'asg_123' });

      expect(repository.cancelAssignment).toHaveBeenCalledWith('asg_123');
      expect(repository.syncRequestStatusPreservingInProgress).toHaveBeenCalledWith('req_123');
      expect(repository.updateVolunteerAvailability).toHaveBeenCalledWith('vol_123', false);
      expect(result.message).toContain('Assignment cancelled, you are now unavailable');
    });

    it('should try to auto-assign the request to someone else after volunteer cancels', async () => {
      repository.findVolunteerByUserId.mockResolvedValue(volunteer);
      repository.getAssignmentById.mockResolvedValue(assignment);
      repository.findActiveAssignmentsByRequestId.mockResolvedValue([]);
      repository.findAvailableVolunteersForMatching.mockResolvedValue([{ volunteer_id: 'vol_456', user_id: 'user_456' }]);
      repository.findMatchingRequestForVolunteer.mockResolvedValue({ request_id: 'req_123' });

      await cancelMyAssignment(userId, { assignmentId: 'asg_123' });

      expect(repository.createAssignment).toHaveBeenCalledWith('vol_456', 'req_123');
    });
  });

  describe('cancelAssignmentByRequestId', () => {
    it('should cancel all active assignments for the request', async () => {
      repository.findActiveAssignmentsByRequestId.mockResolvedValue([
        assignment,
        { assignment_id: 'asg_456', volunteer_id: 'vol_456', request_id: 'req_123' },
      ]);
      repository.findAvailableVolunteersForMatching.mockResolvedValue([{ volunteer_id: 'vol_789', user_id: 'user_789' }]);
      repository.findMatchingRequestForVolunteer.mockResolvedValue({ request_id: 'req_456' });

      await cancelAssignmentByRequestId('req_123');

      expect(repository.cancelAssignment).toHaveBeenCalledWith('asg_123');
      expect(repository.cancelAssignment).toHaveBeenCalledWith('asg_456');
      expect(repository.createAssignment).toHaveBeenCalledWith('vol_789', 'req_456');
    });

    it('should do nothing if no assignment is found', async () => {
      repository.findActiveAssignmentsByRequestId.mockResolvedValue([]);

      await cancelAssignmentByRequestId('req_123');

      expect(repository.cancelAssignment).not.toHaveBeenCalled();
    });
  });

  describe('resolveMyAssignment', () => {
    it('should only clear the resolver assignment and resync the request', async () => {
      repository.findVolunteerByUserId.mockResolvedValue(volunteer);
      repository.getAssignmentByVolunteerId.mockResolvedValue(assignment);

      const result = await resolveMyAssignment(userId, { requestId: 'req_123' });

      expect(repository.cancelAssignment).toHaveBeenCalledWith('asg_123');
      expect(repository.syncRequestStatusPreservingInProgress).toHaveBeenCalledWith('req_123');
      expect(repository.updateVolunteerAvailability).toHaveBeenCalledWith('vol_123', false);
      expect(result.message).toBe('Assignment resolved for this volunteer, you are now unavailable, and matching has been refreshed');
      expect(result.newAssignment).toBeNull();
    });

    it('should not create a new assignment for the resolver after resolving', async () => {
      repository.findVolunteerByUserId.mockResolvedValue(volunteer);
      repository.getAssignmentByVolunteerId.mockResolvedValue(assignment);

      const result = await resolveMyAssignment(userId, { requestId: 'req_123' });

      expect(repository.cancelAssignment).toHaveBeenCalledWith('asg_123');
      expect(repository.createAssignment).not.toHaveBeenCalledWith('vol_123', 'req_123');
      expect(result.newAssignment).toBeNull();
    });
  });

  describe('getAvailabilityStatus', () => {
    it('should return isAvailable false and nulls if volunteer does not exist', async () => {
      repository.findVolunteerByUserId.mockResolvedValue(null);

      const result = await getAvailabilityStatus(userId);

      expect(result.isAvailable).toBe(false);
      expect(result.isAssignable).toBe(false);
      expect(result.pauseReason).toBe('NONE');
      expect(result.volunteer).toBeNull();
      expect(result.assignment).toBeNull();
    });

    it('should return the current status and assignment if volunteer exists', async () => {
      repository.findVolunteerByUserId.mockResolvedValue({
        ...volunteer,
        is_available: true,
        last_known_latitude: 41,
        last_known_longitude: 29,
        location_updated_at: new Date(),
        available_until: new Date(Date.now() + 60 * 60 * 1000),
      });
      repository.getAssignmentByVolunteerId.mockResolvedValue(assignment);

      const result = await getAvailabilityStatus(userId);

      expect(result.isAvailable).toBe(true);
      expect(result.isAssignable).toBe(true);
      expect(result.pauseReason).toBe('NONE');
      expect(result.volunteer.is_available).toBe(true);
      expect(result.assignment).toEqual(assignment);
    });

    it('should expose pause reason when available volunteer location is missing', async () => {
      repository.findVolunteerByUserId.mockResolvedValue({
        ...volunteer,
        is_available: true,
        last_known_latitude: null,
        last_known_longitude: null,
        location_updated_at: new Date(),
        available_until: new Date(Date.now() + 60 * 60 * 1000),
      });
      repository.getAssignmentByVolunteerId.mockResolvedValue(null);

      const result = await getAvailabilityStatus(userId);

      expect(result.isAvailable).toBe(true);
      expect(result.isAssignable).toBe(false);
      expect(result.pauseReason).toBe('LOCATION_MISSING');
    });
  });

  describe('tryToAssignRequest', () => {
    it('assigns only volunteers selected for the target request', async () => {
      repository.findMatchingVolunteerForRequest
        .mockResolvedValueOnce({ volunteer_id: 'vol_specialist' })
        .mockResolvedValueOnce(null);
      repository.createAssignment.mockResolvedValue({
        assignment_id: 'asg_123',
        volunteer_id: 'vol_specialist',
        request_id: 'req_123',
      });
      repository.findActiveAssignmentsByRequestId.mockResolvedValue([
        {
          assignment_id: 'asg_123',
          volunteer_id: 'vol_specialist',
          request_id: 'req_123',
        },
      ]);

      const result = await tryToAssignRequest('req_123');

      expect(repository.findMatchingVolunteerForRequest).toHaveBeenNthCalledWith(1, 'req_123');
      expect(repository.createAssignment).toHaveBeenCalledWith('vol_specialist', 'req_123');
      expect(result).toBe(true);
    });

    it('keeps assigning the target request while it still has eligible volunteers', async () => {
      repository.findMatchingVolunteerForRequest
        .mockResolvedValueOnce({ volunteer_id: 'vol_123' })
        .mockResolvedValueOnce({ volunteer_id: 'vol_456' })
        .mockResolvedValueOnce(null);
      repository.createAssignment
        .mockResolvedValueOnce(assignment)
        .mockResolvedValueOnce({ assignment_id: 'asg_456', volunteer_id: 'vol_456', request_id: 'req_123' });
      repository.findActiveAssignmentsByRequestId.mockResolvedValue([
        assignment,
        { assignment_id: 'asg_456', volunteer_id: 'vol_456', request_id: 'req_123' },
      ]);

      const result = await tryToAssignRequest('req_123');

      expect(repository.createAssignment).toHaveBeenCalledWith('vol_123', 'req_123');
      expect(repository.createAssignment).toHaveBeenCalledWith('vol_456', 'req_123');
      expect(repository.markRequestAssignedIfPending).toHaveBeenCalledWith('req_123');
      expect(result).toBe(true);
    });

    it('creates notifications for both helper and request owner on assignment', async () => {
      repository.findRequestOwnerByRequestId.mockResolvedValue({ request_id: 'req_123', user_id: 'owner_123' });
      repository.findMatchingVolunteerForRequest
        .mockResolvedValueOnce({ volunteer_id: 'vol_123', user_id: 'helper_123' })
        .mockResolvedValueOnce(null);
      repository.createAssignment.mockResolvedValueOnce(assignment);
      repository.findActiveAssignmentsByRequestId.mockResolvedValue([assignment]);

      await tryToAssignRequest('req_123');

      expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
        recipientUserId: 'owner_123',
        type: 'HELP_REQUEST_STATUS_CHANGED',
        entity: { type: 'HELP_REQUEST', id: 'req_123' },
      }));
      expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
        recipientUserId: 'helper_123',
        type: 'TASK_ASSIGNED',
        entity: { type: 'HELP_REQUEST', id: 'req_123' },
      }));
    });

    it('stops cleanly when guarded assignment creation returns null', async () => {
      repository.findMatchingVolunteerForRequest.mockResolvedValue({ volunteer_id: 'vol_123' });
      repository.createAssignment.mockResolvedValue(null);
      repository.findActiveAssignmentsByRequestId.mockResolvedValue([]);

      const result = await tryToAssignRequest('req_123');

      expect(repository.markRequestAssignedIfPending).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should return false if the target request still has no active assignments after the cycle', async () => {
      repository.findActiveAssignmentsByRequestId.mockResolvedValue([]);

      const result = await tryToAssignRequest('req_123');

      expect(repository.createAssignment).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });
});
