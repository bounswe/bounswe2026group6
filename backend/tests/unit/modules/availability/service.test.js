const {
  setAvailability,
  syncAvailability,
  getMyAssignment,
  cancelMyAssignment,
  resolveMyAssignment,
  getAvailabilityStatus,
  tryToAssignRequest,
} = require('../../../../src/modules/availability/service');
const repository = require('../../../../src/modules/availability/repository');

jest.mock('../../../../src/modules/availability/repository');

describe('Availability Service', () => {
  const userId = 'user_123';
  const volunteer = { volunteer_id: 'vol_123', user_id: userId, is_available: false };
  const assignment = { assignment_id: 'asg_123', volunteer_id: 'vol_123', request_id: 'req_123' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setAvailability', () => {
    it('should create a volunteer if not exists and update availability', async () => {
      repository.findVolunteerByUserId.mockResolvedValue(null);
      repository.createVolunteer.mockResolvedValue(volunteer);
      repository.updateVolunteerAvailability.mockResolvedValue({ ...volunteer, is_available: true });
      repository.getAssignmentByVolunteerId.mockResolvedValue(null);
      repository.findMatchingRequestForVolunteer.mockResolvedValue(null);

      const result = await setAvailability(userId, { isAvailable: true, latitude: 41, longitude: 29 });

      expect(repository.createVolunteer).toHaveBeenCalledWith(userId);
      expect(repository.updateVolunteerAvailability).toHaveBeenCalledWith('vol_123', true, 41, 29);
      expect(repository.createAvailabilityRecord).toHaveBeenCalled();
      expect(result.volunteer.is_available).toBe(true);
    });

    it('should try to match a request if volunteer becomes available', async () => {
      repository.findVolunteerByUserId.mockResolvedValue(volunteer);
      repository.updateVolunteerAvailability.mockResolvedValue({ ...volunteer, is_available: true });
      repository.getAssignmentByVolunteerId.mockResolvedValue(null);
      repository.findMatchingRequestForVolunteer.mockResolvedValue({ request_id: 'req_123' });
      repository.createAssignment.mockResolvedValue(assignment);
      repository.getAssignmentByVolunteerId.mockResolvedValueOnce(null).mockResolvedValueOnce(assignment);

      const result = await setAvailability(userId, { isAvailable: true });

      expect(repository.findMatchingRequestForVolunteer).toHaveBeenCalledWith('vol_123');
      expect(repository.createAssignment).toHaveBeenCalledWith('vol_123', 'req_123');
      expect(repository.updateRequestStatus).toHaveBeenCalledWith('req_123', 'ASSIGNED');
      expect(result.assignment).toEqual(assignment);
    });
  });

  describe('syncAvailability', () => {
    it('should sync multiple records and update to latest status', async () => {
      repository.findVolunteerByUserId.mockResolvedValue(volunteer);
      repository.getAssignmentByVolunteerId.mockResolvedValue(null);
      repository.findMatchingRequestForVolunteer.mockResolvedValue(null);
      
      const records = [
        { isAvailable: true, timestamp: '2023-01-01T10:00:00Z' },
        { isAvailable: false, timestamp: '2023-01-01T11:00:00Z' },
      ];

      await syncAvailability(userId, { records });

      expect(repository.updateVolunteerAvailability).toHaveBeenCalledWith('vol_123', false, null, null);
      expect(repository.createAvailabilityRecord).toHaveBeenCalledTimes(2);
    });

    it('should try to match a request if volunteer is now available', async () => {
      repository.findVolunteerByUserId.mockResolvedValueOnce(volunteer).mockResolvedValueOnce({ ...volunteer, is_available: true });
      repository.getAssignmentByVolunteerId.mockResolvedValue(null);
      repository.findMatchingRequestForVolunteer.mockResolvedValue({ request_id: 'req_123' });
      
      const records = [{ isAvailable: true, timestamp: '2023-01-01T10:00:00Z' }];

      await syncAvailability(userId, { records });

      expect(repository.createAssignment).toHaveBeenCalledWith('vol_123', 'req_123');
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
    it('should cancel assignment and set request back to pending', async () => {
      repository.findVolunteerByUserId.mockResolvedValue(volunteer);
      repository.getAssignmentById.mockResolvedValue(assignment);
      repository.findMatchingRequestForVolunteer.mockResolvedValue(null);

      const result = await cancelMyAssignment(userId, { assignmentId: 'asg_123' });

      expect(repository.cancelAssignment).toHaveBeenCalledWith('asg_123');
      expect(repository.updateRequestStatus).toHaveBeenCalledWith('req_123', 'PENDING');
      expect(result.message).toBe('Assignment cancelled and request put back to pending');
    });

    it('should try to find a NEW assignment after cancelling', async () => {
      repository.findVolunteerByUserId.mockResolvedValue(volunteer);
      repository.getAssignmentById.mockResolvedValue(assignment);
      repository.findMatchingRequestForVolunteer.mockResolvedValue({ request_id: 'req_456' });
      repository.getAssignmentByVolunteerId.mockResolvedValue({ assignment_id: 'asg_456' });

      const result = await cancelMyAssignment(userId, { assignmentId: 'asg_123' });

      expect(repository.createAssignment).toHaveBeenCalledWith('vol_123', 'req_456');
      expect(result.newAssignment).toBeDefined();
    });
  });

  describe('resolveMyAssignment', () => {
    it('should mark request as resolved', async () => {
      repository.findVolunteerByUserId.mockResolvedValue(volunteer);
      repository.getAssignmentByVolunteerId.mockResolvedValue(assignment);
      repository.findMatchingRequestForVolunteer.mockResolvedValue(null);

      const result = await resolveMyAssignment(userId, { requestId: 'req_123' });

      expect(repository.updateRequestStatus).toHaveBeenCalledWith('req_123', 'RESOLVED');
      expect(result.message).toBe('Request marked as resolved');
    });

    it('should try to find a NEW assignment after resolving', async () => {
      repository.findVolunteerByUserId.mockResolvedValue(volunteer);
      repository.getAssignmentByVolunteerId.mockResolvedValueOnce(assignment).mockResolvedValueOnce({ assignment_id: 'asg_456' });
      repository.findMatchingRequestForVolunteer.mockResolvedValue({ request_id: 'req_456' });

      const result = await resolveMyAssignment(userId, { requestId: 'req_123' });

      expect(repository.createAssignment).toHaveBeenCalledWith('vol_123', 'req_456');
      expect(result.newAssignment).toBeDefined();
    });
  });

  describe('getAvailabilityStatus', () => {
    it('should return isAvailable false and nulls if volunteer does not exist', async () => {
      repository.findVolunteerByUserId.mockResolvedValue(null);

      const result = await getAvailabilityStatus(userId);

      expect(result.isAvailable).toBe(false);
      expect(result.volunteer).toBeNull();
      expect(result.assignment).toBeNull();
    });

    it('should return the current status and assignment if volunteer exists', async () => {
      repository.findVolunteerByUserId.mockResolvedValue({ ...volunteer, is_available: true });
      repository.getAssignmentByVolunteerId.mockResolvedValue(assignment);

      const result = await getAvailabilityStatus(userId);

      expect(result.isAvailable).toBe(true);
      expect(result.volunteer.is_available).toBe(true);
      expect(result.assignment).toEqual(assignment);
    });
  });

  describe('tryToAssignRequest', () => {
    it('should assign a volunteer if a match is found', async () => {
      repository.findMatchingVolunteerForRequest.mockResolvedValue(volunteer);
      repository.createAssignment.mockResolvedValue(assignment);

      const result = await tryToAssignRequest('req_123');

      expect(repository.findMatchingVolunteerForRequest).toHaveBeenCalledWith('req_123');
      expect(repository.createAssignment).toHaveBeenCalledWith('vol_123', 'req_123');
      expect(repository.updateRequestStatus).toHaveBeenCalledWith('req_123', 'ASSIGNED');
      expect(result).toBe(true);
    });

    it('should return false if no matching volunteer is found', async () => {
      repository.findMatchingVolunteerForRequest.mockResolvedValue(null);

      const result = await tryToAssignRequest('req_123');

      expect(repository.findMatchingVolunteerForRequest).toHaveBeenCalledWith('req_123');
      expect(repository.createAssignment).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });
});
