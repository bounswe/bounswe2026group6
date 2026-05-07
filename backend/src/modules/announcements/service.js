const { randomUUID } = require('crypto');
const {
  deleteAnnouncementById,
  findAnnouncementById,
  insertAnnouncement,
  listAnnouncements,
  updateAnnouncementById,
} = require('./repository');

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

  return insertAnnouncement({
    id: createAnnouncementId(),
    adminId: adminUser.adminId,
    title: payload.title,
    content: payload.content,
  });
}

async function updateAnnouncement(announcementId, payload) {
  return updateAnnouncementById(announcementId, payload);
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
