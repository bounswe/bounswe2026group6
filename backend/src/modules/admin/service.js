const {
  listUsers,
  listHelpRequests,
  listAnnouncements,
  getBasicStats,
  getEmergencyOverview,
  getEmergencyHistory,
} = require('./repository');

async function getUsersForAdmin() {
  return listUsers();
}

async function getHelpRequestsForAdmin() {
  return listHelpRequests();
}

async function getAnnouncementsForAdmin() {
  return listAnnouncements();
}

async function getStatsForAdmin() {
  return getBasicStats();
}

async function getEmergencyOverviewForAdmin(options = {}) {
  return getEmergencyOverview(options);
}

async function getEmergencyHistoryForAdmin(options = {}) {
  return getEmergencyHistory(options);
}

module.exports = {
  getUsersForAdmin,
  getHelpRequestsForAdmin,
  getAnnouncementsForAdmin,
  getStatsForAdmin,
  getEmergencyOverviewForAdmin,
  getEmergencyHistoryForAdmin,
};
