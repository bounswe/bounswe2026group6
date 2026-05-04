const express = require('express');
const { requireAuth, requireAdmin } = require('../auth/middleware');
const {
  deleteAdminAnnouncement,
  getPublicAnnouncement,
  listAdminAnnouncements,
  listPublicAnnouncements,
  patchAdminAnnouncement,
  postAdminAnnouncement,
} = require('./controller');

const announcementsRouter = express.Router();
const adminAnnouncementsRouter = express.Router();

announcementsRouter.get('/', listPublicAnnouncements);
announcementsRouter.get('/:announcementId', getPublicAnnouncement);

adminAnnouncementsRouter.use(requireAuth, requireAdmin);
adminAnnouncementsRouter.get('/', listAdminAnnouncements);
adminAnnouncementsRouter.post('/', postAdminAnnouncement);
adminAnnouncementsRouter.patch('/:announcementId', patchAdminAnnouncement);
adminAnnouncementsRouter.delete('/:announcementId', deleteAdminAnnouncement);

module.exports = {
  adminAnnouncementsRouter,
  announcementsRouter,
};
