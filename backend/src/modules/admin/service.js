const {
  listUsers,
  listHelpRequests,
  listAnnouncements,
  getBasicStats,
  getEmergencyOverview,
  getEmergencyHistory,
  getEmergencyAnalytics,
  getDeploymentMonitoring,
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

async function getEmergencyAnalyticsForAdmin(options = {}) {
  return getEmergencyAnalytics(options);
}

async function getDeploymentMonitoringForAdmin(options = {}) {
  return getDeploymentMonitoring(options);
}

module.exports = {
  getUsersForAdmin,
  getHelpRequestsForAdmin,
  getAnnouncementsForAdmin,
  getStatsForAdmin,
  getEmergencyOverviewForAdmin,
  getEmergencyHistoryForAdmin,
  getEmergencyAnalyticsForAdmin,
  getDeploymentMonitoringForAdmin,
};
