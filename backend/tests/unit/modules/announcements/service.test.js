'use strict';

jest.mock('../../../../src/modules/announcements/repository', () => ({
  deleteAnnouncementById: jest.fn(),
  findAnnouncementById: jest.fn(),
  insertAnnouncement: jest.fn(),
  listAnnouncements: jest.fn(),
  updateAnnouncementById: jest.fn(),
}));

jest.mock('../../../../src/modules/notifications/service', () => ({
  createNotification: jest.fn().mockResolvedValue({ id: 'notif_1' }),
}));

jest.mock('../../../../src/modules/notifications/repository', () => ({
  listAnnouncementRecipientUserIds: jest.fn(),
}));

const repository = require('../../../../src/modules/announcements/repository');
const { createNotification } = require('../../../../src/modules/notifications/service');
const { listAnnouncementRecipientUserIds } = require('../../../../src/modules/notifications/repository');
const {
  createAnnouncement,
  updateAnnouncement,
} = require('../../../../src/modules/announcements/service');

async function flushQueuedNotifications() {
  await new Promise((resolve) => setImmediate(resolve));
  await Promise.resolve();
}

describe('announcements service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listAnnouncementRecipientUserIds.mockResolvedValue([]);
  });

  test('creates notifications for active users when an announcement is published', async () => {
    const announcement = {
      id: 'ann_1',
      adminId: 'admin_1',
      title: 'Water distribution update',
      content: 'Updated gathering area info',
    };
    repository.insertAnnouncement.mockResolvedValueOnce(announcement);
    listAnnouncementRecipientUserIds.mockResolvedValueOnce(['admin_user', 'user_1', 'user_2']);

    const result = await createAnnouncement(
      { adminId: 'admin_1', userId: 'admin_user' },
      { title: announcement.title, content: announcement.content },
    );

    expect(result).toEqual(announcement);
    await flushQueuedNotifications();

    expect(createNotification).toHaveBeenCalledTimes(2);
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      recipientUserId: 'user_1',
      actorUserId: 'admin_user',
      type: 'ANNOUNCEMENT_PUBLISHED',
      entity: { type: 'ANNOUNCEMENT', id: 'ann_1' },
      data: expect.objectContaining({
        screen: 'announcements',
        announcementId: 'ann_1',
      }),
    }));
  });

  test('creates notifications for active users when an announcement is updated', async () => {
    const announcement = {
      id: 'ann_1',
      adminId: 'admin_1',
      title: 'Updated safety briefing',
      content: 'New content',
    };
    repository.updateAnnouncementById.mockResolvedValueOnce(announcement);
    listAnnouncementRecipientUserIds.mockResolvedValueOnce(['admin_user', 'user_1']);

    const result = await updateAnnouncement(
      'ann_1',
      { title: announcement.title },
      { userId: 'admin_user' },
    );

    expect(result).toEqual(announcement);
    await flushQueuedNotifications();

    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      recipientUserId: 'user_1',
      type: 'ANNOUNCEMENT_UPDATED',
      title: 'Announcement updated',
      data: expect.objectContaining({
        announcementId: 'ann_1',
        kind: 'announcement_updated',
      }),
    }));
  });
});
