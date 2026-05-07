const { randomUUID } = require('crypto');
const {
  deleteAnnouncementById,
  findAnnouncementById,
  insertAnnouncement,
  listAnnouncements,
  updateAnnouncementById,
} = require('./repository');
const { createNotification } = require('../notifications/service');
const { listAnnouncementRecipientUserIds } = require('../notifications/repository');

const ANNOUNCEMENT_NOTIFICATION_BATCH_SIZE = 25;

function createAnnouncementId() {
  return `ann_${randomUUID()}`;
}

async function getAnnouncements(options = {}) {
  return listAnnouncements(options);
}

async function getAnnouncement(announcementId) {
  return findAnnouncementById(announcementId);
}

async function createAnnouncement(adminUser, payload) {
  if (!adminUser?.adminId) {
    const error = new Error('Admin identity is required to create announcements.');
    error.code = 'FORBIDDEN';
    throw error;
  }

  const announcement = await insertAnnouncement({
    id: createAnnouncementId(),
    adminId: adminUser.adminId,
    title: payload.title,
    content: payload.content,
  });

  enqueueAnnouncementNotifications(
    announcement,
    adminUser.userId || null,
    'announcement_published',
  );

  return announcement;
}

function enqueueAnnouncementNotifications(announcement, actorUserId, kind) {
  setImmediate(() => {
    notifyAnnouncementRecipients(announcement, actorUserId, kind).catch((error) => {
      console.error('announcements.notifyAnnouncementRecipients failed', error);
    });
  });
}

function chunkItems(items, chunkSize) {
  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

async function notifyAnnouncementRecipients(announcement, actorUserId, kind) {
  if (!announcement) {
    return;
  }

  let recipientUserIds = [];
  try {
    recipientUserIds = await listAnnouncementRecipientUserIds();
  } catch (error) {
    console.error('announcements.notifyAnnouncementRecipients recipient lookup failed', error);
    return;
  }

  const eligibleRecipientUserIds = recipientUserIds.filter(
    (recipientUserId) => recipientUserId && recipientUserId !== actorUserId,
  );
  let failedCount = 0;

  for (const batch of chunkItems(eligibleRecipientUserIds, ANNOUNCEMENT_NOTIFICATION_BATCH_SIZE)) {
    const results = await Promise.allSettled(batch.map((recipientUserId) => (
      createNotification({
        recipientUserId,
        actorUserId: actorUserId || null,
        type: kind === 'announcement_updated' ? 'ANNOUNCEMENT_UPDATED' : 'ANNOUNCEMENT_PUBLISHED',
        title: kind === 'announcement_updated' ? 'Announcement updated' : 'New announcement',
        body: announcement.title,
        entity: {
          type: 'ANNOUNCEMENT',
          id: announcement.id,
        },
        data: {
          screen: 'announcements',
          announcementId: announcement.id,
          kind,
        },
      })
    )));

    failedCount += results.filter((result) => result.status === 'rejected').length;
  }

  if (failedCount > 0) {
    console.error('announcements.notifyAnnouncementRecipients recipient failures', {
      announcementId: announcement.id,
      kind,
      failedCount,
    });
  }
}

async function updateAnnouncement(announcementId, payload, adminUser = null) {
  const announcement = await updateAnnouncementById(announcementId, payload);
  enqueueAnnouncementNotifications(
    announcement,
    adminUser?.userId || null,
    'announcement_updated',
  );
  return announcement;
}

async function deleteAnnouncement(announcementId) {
  return deleteAnnouncementById(announcementId);
}

module.exports = {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncement,
  getAnnouncements,
  updateAnnouncement,
};
