'use strict';

jest.mock('../../../../src/modules/notifications/repository', () => ({
  insertNotification: jest.fn(),
  listNotificationsByRecipient: jest.fn(),
  countUnreadNotifications: jest.fn(),
  markNotificationAsRead: jest.fn(),
  markAllNotificationsAsRead: jest.fn(),
  upsertNotificationDevice: jest.fn(),
  deactivateNotificationDevice: jest.fn(),
  listActiveNotificationDevicesByUserId: jest.fn(),
  insertNotificationDelivery: jest.fn(),
  getNotificationPreferencesByUserId: jest.fn(),
  upsertNotificationPreferences: jest.fn(),
  getNotificationDeliveryStats: jest.fn(),
  listNotificationTypePreferencesByUserId: jest.fn(),
  upsertNotificationTypePreference: jest.fn(),
  listUserIdsWithinRadius: jest.fn(),
  listAvailabilityReminderCandidates: jest.fn(),
  expireStalePendingHelpRequests: jest.fn(),
}));

const repository = require('../../../../src/modules/notifications/repository');
const {
  createNotificationForRequester,
  listMyNotifications,
  markMyNotificationAsRead,
  markAllMyNotificationsAsRead,
  registerMyNotificationDevice,
  unregisterMyNotificationDevice,
  getMyNotificationPreferences,
  updateMyNotificationPreferences,
  listMyNotificationTypePreferences,
  updateMyNotificationTypePreference,
  getMyUnreadNotificationCount,
  getAdminNotificationStats,
  createEmergencyBroadcast,
} = require('../../../../src/modules/notifications/service');

function createStoredNotification(overrides = {}) {
  return {
    id: 'notif_1',
    recipientUserId: 'user_1',
    actorUserId: 'user_1',
    type: 'SYSTEM',
    title: 'Title',
    body: 'Body',
    isRead: false,
    readAt: null,
    createdAt: new Date('2026-04-22T20:00:00.000Z'),
    updatedAt: new Date('2026-04-22T20:00:00.000Z'),
    entity: null,
    data: {},
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  repository.getNotificationPreferencesByUserId.mockResolvedValue({ userId: 'user_1', pushEnabled: true });
  repository.listNotificationTypePreferencesByUserId.mockResolvedValue([]);
  repository.listUserIdsWithinRadius.mockResolvedValue([]);
});

describe('notifications service', () => {
  test('createNotificationForRequester creates self notification', async () => {
    const stored = createStoredNotification();
    repository.insertNotification.mockResolvedValue(stored);
    repository.listActiveNotificationDevicesByUserId.mockResolvedValue([]);
    repository.insertNotificationDelivery.mockResolvedValue(undefined);

    const result = await createNotificationForRequester(
      { userId: 'user_1', isAdmin: false },
      {
        type: 'SYSTEM',
        title: 'Title',
        body: 'Body',
        data: { screen: 'home' },
      },
    );

    expect(repository.insertNotification).toHaveBeenCalledWith({
      recipientUserId: 'user_1',
      actorUserId: 'user_1',
      type: 'SYSTEM',
      title: 'Title',
      body: 'Body',
      entity: null,
      data: { screen: 'home' },
    });

    expect(result).toMatchObject({
      id: 'notif_1',
      type: 'SYSTEM',
      title: 'Title',
      body: 'Body',
      isRead: false,
    });
    expect(repository.insertNotificationDelivery).toHaveBeenCalled();
  });

  test('createNotificationForRequester rejects cross-user create for non-admin', async () => {
    await expect(
      createNotificationForRequester(
        { userId: 'user_1', isAdmin: false },
        {
          recipientUserId: 'user_2',
          type: 'SYSTEM',
          title: 'Title',
          body: 'Body',
          data: {},
        },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  test('listMyNotifications returns nextCursor and unreadCount', async () => {
    const rows = [
      createStoredNotification({ id: 'notif_2', createdAt: new Date('2026-04-22T20:00:00.000Z') }),
      createStoredNotification({ id: 'notif_1', createdAt: new Date('2026-04-22T19:59:00.000Z') }),
    ];
    repository.listNotificationsByRecipient.mockResolvedValue(rows);
    repository.countUnreadNotifications.mockResolvedValue(3);

    const result = await listMyNotifications('user_1', {
      limit: 2,
      unreadOnly: false,
      cursor: null,
    });

    expect(repository.listNotificationsByRecipient).toHaveBeenCalledWith({
      recipientUserId: 'user_1',
      limit: 2,
      unreadOnly: false,
      cursorCreatedAt: null,
      cursorNotificationId: null,
    });
    expect(result.items).toHaveLength(2);
    expect(result.unreadCount).toBe(3);
    expect(typeof result.nextCursor).toBe('string');
  });

  test('listMyNotifications rejects malformed cursor', async () => {
    await expect(
      listMyNotifications('user_1', {
        limit: 20,
        unreadOnly: false,
        cursor: 'not-base64',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
  });

  test('markMyNotificationAsRead returns null when not found', async () => {
    repository.markNotificationAsRead.mockResolvedValue(null);

    const result = await markMyNotificationAsRead('user_1', 'notif_missing');

    expect(result).toBeNull();
  });

  test('markAllMyNotificationsAsRead returns updated and unread count', async () => {
    repository.markAllNotificationsAsRead.mockResolvedValue(5);
    repository.countUnreadNotifications.mockResolvedValue(0);

    const result = await markAllMyNotificationsAsRead('user_1');

    expect(result).toEqual({
      updatedCount: 5,
      unreadCount: 0,
    });
  });

  test('registerMyNotificationDevice delegates to repository', async () => {
    repository.upsertNotificationDevice.mockResolvedValue({ id: 'dev_1' });

    const result = await registerMyNotificationDevice('user_1', {
      platform: 'ANDROID',
      provider: 'FCM',
      deviceToken: 'token_1',
    });

    expect(repository.upsertNotificationDevice).toHaveBeenCalledWith({
      userId: 'user_1',
      platform: 'ANDROID',
      provider: 'FCM',
      deviceToken: 'token_1',
    });
    expect(result).toEqual({ id: 'dev_1' });
  });

  test('unregisterMyNotificationDevice delegates to repository', async () => {
    repository.deactivateNotificationDevice.mockResolvedValue({ id: 'dev_1', isActive: false });

    const result = await unregisterMyNotificationDevice('user_1', {
      provider: 'FCM',
      deviceToken: 'token_1',
    });

    expect(repository.deactivateNotificationDevice).toHaveBeenCalledWith({
      userId: 'user_1',
      provider: 'FCM',
      deviceToken: 'token_1',
    });
    expect(result).toEqual({ id: 'dev_1', isActive: false });
  });

  test('getMyNotificationPreferences delegates to repository', async () => {
    repository.getNotificationPreferencesByUserId.mockResolvedValue({ userId: 'user_1', pushEnabled: true });

    const result = await getMyNotificationPreferences('user_1');

    expect(repository.getNotificationPreferencesByUserId).toHaveBeenCalledWith('user_1');
    expect(result).toEqual({ userId: 'user_1', pushEnabled: true });
  });

  test('updateMyNotificationPreferences delegates to repository', async () => {
    repository.upsertNotificationPreferences.mockResolvedValue({ userId: 'user_1', pushEnabled: false });

    const result = await updateMyNotificationPreferences('user_1', { pushEnabled: false });

    expect(repository.upsertNotificationPreferences).toHaveBeenCalledWith({
      userId: 'user_1',
      pushEnabled: false,
    });
    expect(result).toEqual({ userId: 'user_1', pushEnabled: false });
  });

  test('getAdminNotificationStats rejects non-admin', async () => {
    await expect(
      getAdminNotificationStats({ userId: 'u1', isAdmin: false }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  test('getAdminNotificationStats delegates for admins', async () => {
    repository.getNotificationDeliveryStats.mockResolvedValue({ totals: [] });

    const result = await getAdminNotificationStats({ userId: 'admin_1', isAdmin: true });

    expect(repository.getNotificationDeliveryStats).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ totals: [] });
  });

  test('listMyNotificationTypePreferences returns defaults for unknown types', async () => {
    repository.listNotificationTypePreferencesByUserId.mockResolvedValue([
      { notificationType: 'SYSTEM', pushEnabled: false, updatedAt: new Date() },
    ]);

    const result = await listMyNotificationTypePreferences('user_1');

    expect(Array.isArray(result)).toBe(true);
    expect(result.find((item) => item.notificationType === 'SYSTEM')?.pushEnabled).toBe(false);
    expect(result.find((item) => item.notificationType === 'TASK_ASSIGNED')?.pushEnabled).toBe(true);
  });

  test('updateMyNotificationTypePreference delegates to repository', async () => {
    repository.upsertNotificationTypePreference.mockResolvedValue({
      userId: 'user_1',
      notificationType: 'SYSTEM',
      pushEnabled: false,
    });

    const result = await updateMyNotificationTypePreference('user_1', {
      notificationType: 'SYSTEM',
      pushEnabled: false,
    });

    expect(repository.upsertNotificationTypePreference).toHaveBeenCalledWith({
      userId: 'user_1',
      notificationType: 'SYSTEM',
      pushEnabled: false,
    });
    expect(result.notificationType).toBe('SYSTEM');
  });

  test('getMyUnreadNotificationCount delegates to repository', async () => {
    repository.countUnreadNotifications.mockResolvedValue(9);

    const result = await getMyUnreadNotificationCount('user_1');

    expect(result).toEqual({ unreadCount: 9 });
  });

  test('createEmergencyBroadcast rejects non-admin', async () => {
    await expect(
      createEmergencyBroadcast(
        { userId: 'user_1', isAdmin: false },
        {
          broadcastId: 'broadcast_1',
          title: 'Emergency',
          body: 'Emergency body',
          location: { latitude: 41, longitude: 29, radiusKm: 10 },
          maxRecipients: 100,
        },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  test('createEmergencyBroadcast fans out to recipients', async () => {
    repository.listUserIdsWithinRadius.mockResolvedValue(['u1', 'u2']);
    repository.insertNotification.mockImplementation(async ({ recipientUserId, type, title, body, entity, data }) => (
      createStoredNotification({
        id: `notif_${recipientUserId}`,
        recipientUserId,
        type,
        title,
        body,
        entity,
        data,
      })
    ));
    repository.listActiveNotificationDevicesByUserId.mockResolvedValue([]);
    repository.insertNotificationDelivery.mockResolvedValue(undefined);

    const result = await createEmergencyBroadcast(
      { userId: 'admin_1', isAdmin: true },
      {
        broadcastId: 'broadcast_1',
        title: 'Emergency',
        body: 'Emergency body',
        location: { latitude: 41, longitude: 29, radiusKm: 10 },
        maxRecipients: 100,
      },
    );

    expect(repository.listUserIdsWithinRadius).toHaveBeenCalledWith({
      latitude: 41,
      longitude: 29,
      radiusKm: 10,
      limit: 100,
    });
    expect(result).toMatchObject({
      broadcastId: 'broadcast_1',
      recipientCount: 2,
      deliveredCount: 2,
    });
  });
});
