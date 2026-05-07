'use strict';

jest.mock('../../../../src/modules/safety-circles/repository', () => ({
  createCircle: jest.fn(),
  listCirclesForUser: jest.fn(),
  findCircleForMember: jest.fn(),
  listCircleMembers: jest.fn(),
  findUserByIdOrEmail: jest.fn(),
  isCircleMember: jest.fn(),
  createInvite: jest.fn(),
  listInvitesForUser: jest.fn(),
  findInviteForUser: jest.fn(),
  respondToInvite: jest.fn(),
  removeMember: jest.fn(),
  deleteCircle: jest.fn(),
  transferCircleOwnership: jest.fn(),
}));

jest.mock('../../../../src/modules/safety-status/service', () => ({
  patchMySafetyStatus: jest.fn(),
}));

jest.mock('../../../../src/modules/notifications/service', () => ({
  createNotification: jest.fn().mockResolvedValue({ id: 'notif_1' }),
}));

const repository = require('../../../../src/modules/safety-circles/repository');
const { patchMySafetyStatus } = require('../../../../src/modules/safety-status/service');
const { createNotification } = require('../../../../src/modules/notifications/service');
const {
  inviteToSafetyCircle,
  respondToSafetyCircleInvite,
  checkInToSafetyCircle,
  deleteSafetyCircle,
  transferSafetyCircleOwnership,
} = require('../../../../src/modules/safety-circles/service');

describe('safety-circles service notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repository.findCircleForMember.mockResolvedValue({
      circleId: 'circle_1',
      name: 'Family',
      ownerUserId: 'owner_1',
    });
    repository.listCircleMembers.mockResolvedValue([
      { userId: 'owner_1' },
      { userId: 'member_1' },
    ]);
  });

  test('notifies invitee when a safety circle invite is created', async () => {
    repository.findUserByIdOrEmail.mockResolvedValueOnce({ user_id: 'invitee_1' });
    repository.isCircleMember.mockResolvedValueOnce(false);
    repository.createInvite.mockResolvedValueOnce({
      inviteId: 'invite_1',
      circleId: 'circle_1',
      inviteeUserId: 'invitee_1',
      inviterUserId: 'owner_1',
      status: 'pending',
    });

    await inviteToSafetyCircle('owner_1', 'circle_1', { inviteeUserId: 'invitee_1' });

    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      recipientUserId: 'invitee_1',
      actorUserId: 'owner_1',
      type: 'SAFETY_CIRCLE_INVITE_RECEIVED',
      entity: { type: 'SAFETY_CIRCLE_INVITE', id: 'invite_1' },
    }));
  });

  test('notifies inviter only when a pending invite is first answered', async () => {
    repository.findInviteForUser.mockResolvedValueOnce({ invite_id: 'invite_1', status: 'pending' });
    repository.respondToInvite.mockResolvedValueOnce({
      inviteId: 'invite_1',
      circleId: 'circle_1',
      inviterUserId: 'owner_1',
      inviteeUserId: 'member_1',
      status: 'accepted',
    });

    await respondToSafetyCircleInvite('member_1', 'invite_1', 'accept');

    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      recipientUserId: 'owner_1',
      actorUserId: 'member_1',
      type: 'SAFETY_CIRCLE_INVITE_RESPONDED',
      data: expect.objectContaining({ status: 'accepted' }),
    }));
  });

  test('notifies circle members when a member checks in as not safe', async () => {
    patchMySafetyStatus.mockResolvedValueOnce({ status: 'not_safe' });

    await checkInToSafetyCircle('member_1', 'circle_1', { status: 'not_safe' });

    expect(patchMySafetyStatus).toHaveBeenCalledWith('member_1', { status: 'not_safe' });
  });

  test('notifies remaining members when a circle is deleted', async () => {
    repository.deleteCircle.mockResolvedValueOnce(true);

    await deleteSafetyCircle('owner_1', 'circle_1');

    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      recipientUserId: 'member_1',
      type: 'SAFETY_CIRCLE_UPDATED',
      data: expect.objectContaining({ kind: 'safety_circle_deleted' }),
    }));
  });

  test('notifies the new owner when ownership is transferred', async () => {
    repository.isCircleMember.mockResolvedValueOnce(true);
    repository.transferCircleOwnership.mockResolvedValueOnce(true);

    await transferSafetyCircleOwnership('owner_1', 'circle_1', 'member_1');

    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      recipientUserId: 'member_1',
      type: 'SAFETY_CIRCLE_UPDATED',
      data: expect.objectContaining({ kind: 'safety_circle_ownership_transferred' }),
    }));
  });
});
