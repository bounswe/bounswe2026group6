'use strict';

jest.mock('../../../../src/modules/notifications/service', () => ({
  createNotification: jest.fn().mockResolvedValue({ id: 'notif_1' }),
}));

jest.mock('../../../../src/modules/notifications/repository', () => ({
  listAvailabilityReminderCandidates: jest.fn(),
  listAvailabilityPausedNotificationCandidates: jest.fn(),
  expireStalePendingHelpRequests: jest.fn(),
}));

const { createNotification } = require('../../../../src/modules/notifications/service');
const {
  listAvailabilityReminderCandidates,
  listAvailabilityPausedNotificationCandidates,
  expireStalePendingHelpRequests,
} = require('../../../../src/modules/notifications/repository');
const { runNotificationJobsOnce } = require('../../../../src/modules/notifications/jobs');

describe('notification jobs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listAvailabilityReminderCandidates.mockResolvedValue([]);
    listAvailabilityPausedNotificationCandidates.mockResolvedValue([]);
    expireStalePendingHelpRequests.mockResolvedValue([]);
  });

  test('does not create hourly availability reminder notifications', async () => {
    listAvailabilityReminderCandidates.mockResolvedValue(['user_a', 'user_b']);

    await runNotificationJobsOnce();

    expect(listAvailabilityReminderCandidates).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });

  test('creates one paused availability notification for pause candidates', async () => {
    listAvailabilityPausedNotificationCandidates.mockResolvedValue([
      {
        userId: 'user_a',
        pauseReason: 'LOCATION_STALE',
        pauseEventKey: 'LOCATION_STALE:2026-05-06T10:00:00.000Z',
      },
    ]);

    await runNotificationJobsOnce();

    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      recipientUserId: 'user_a',
      type: 'VOLUNTEER_AVAILABILITY_PAUSED',
      title: 'Volunteer availability paused',
      data: expect.objectContaining({
        kind: 'availability_paused',
        pauseReason: 'LOCATION_STALE',
        pauseEventKey: 'LOCATION_STALE:2026-05-06T10:00:00.000Z',
      }),
    }));
  });

  test('expires stale requests and notifies owners', async () => {
    expireStalePendingHelpRequests.mockResolvedValue([
      { request_id: 'req_1', user_id: 'owner_1' },
      { request_id: 'req_2', user_id: null },
    ]);

    await runNotificationJobsOnce();

    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      recipientUserId: 'owner_1',
      type: 'HELP_REQUEST_STATUS_CHANGED',
      entity: { type: 'HELP_REQUEST', id: 'req_1' },
      data: expect.objectContaining({ reason: 'ttl_expired' }),
    }));
  });
});
