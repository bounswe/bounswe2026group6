'use strict';

jest.mock('../../../../src/modules/safety-status/repository', () => ({
  findSafetyStatusByUserId: jest.fn(),
  upsertSafetyStatus: jest.fn(),
  listVisibleSafetyStatuses: jest.fn(),
}));

jest.mock('../../../../src/modules/safety-circles/repository', () => ({
  listCirclesForUser: jest.fn(),
  listCircleMembers: jest.fn(),
}));

jest.mock('../../../../src/modules/notifications/service', () => ({
  createNotification: jest.fn().mockResolvedValue({ id: 'notif_1' }),
}));

const safetyStatusRepository = require('../../../../src/modules/safety-status/repository');
const safetyCircleRepository = require('../../../../src/modules/safety-circles/repository');
const { createNotification } = require('../../../../src/modules/notifications/service');
const { patchMySafetyStatus } = require('../../../../src/modules/safety-status/service');

describe('safety-status service notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    safetyCircleRepository.listCirclesForUser.mockResolvedValue([]);
    safetyCircleRepository.listCircleMembers.mockResolvedValue([]);
  });

  test('notifies safety circle members when safety status is updated directly', async () => {
    safetyStatusRepository.upsertSafetyStatus.mockResolvedValueOnce({ status: 'not_safe' });
    safetyCircleRepository.listCirclesForUser.mockResolvedValueOnce([
      { circleId: 'circle_1' },
    ]);
    safetyCircleRepository.listCircleMembers.mockResolvedValueOnce([
      { userId: 'actor_1' },
      { userId: 'member_1' },
    ]);

    const result = await patchMySafetyStatus('actor_1', { status: 'not_safe' });

    expect(result).toEqual({ status: 'not_safe' });
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      recipientUserId: 'member_1',
      actorUserId: 'actor_1',
      type: 'SAFETY_CIRCLE_STATUS_UPDATED',
      title: 'Safety circle alert',
      entity: { type: 'SAFETY_CIRCLE', id: 'circle_1' },
      data: expect.objectContaining({
        circleId: 'circle_1',
        status: 'not_safe',
      }),
    }));
  });

  test('deduplicates safety status notifications for members shared across circles', async () => {
    safetyStatusRepository.upsertSafetyStatus.mockResolvedValueOnce({ status: 'not_safe' });
    safetyCircleRepository.listCirclesForUser.mockResolvedValueOnce([
      { circleId: 'circle_1' },
      { circleId: 'circle_2' },
    ]);
    safetyCircleRepository.listCircleMembers
      .mockResolvedValueOnce([
        { userId: 'member_1' },
        { userId: 'member_2' },
      ])
      .mockResolvedValueOnce([
        { userId: 'member_1' },
      ]);

    await patchMySafetyStatus('actor_1', { status: 'not_safe' });

    expect(createNotification).toHaveBeenCalledTimes(2);
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      recipientUserId: 'member_1',
      entity: { type: 'SAFETY_CIRCLE', id: 'circle_1' },
    }));
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      recipientUserId: 'member_2',
    }));
  });

  test('does not fail safety status update when circle lookup fails', async () => {
    safetyStatusRepository.upsertSafetyStatus.mockResolvedValueOnce({ status: 'safe' });
    safetyCircleRepository.listCirclesForUser.mockRejectedValueOnce(new Error('lookup failed'));

    await expect(patchMySafetyStatus('actor_1', { status: 'safe' }))
      .resolves
      .toEqual({ status: 'safe' });
  });
});
