const {
  listUsers,
  banUserById,
  findBanTargetByUserId,
  unbanUserById,
  listHelpRequests,
  listAnnouncements,
  getBasicStats,
  getEmergencyOverview,
  getEmergencyHistory,
  getEmergencyAnalytics,
  getDeploymentMonitoring,
} = require('./repository');
const {
  listHelpRequestsByUserId,
  markHelpRequestAsCancelled,
} = require('../help-requests/repository');
const {
  cancelAssignmentByRequestId,
  cancelAssignmentsForBannedVolunteer,
  tryToAssignRequest,
} = require('../availability/service');
const { pool } = require('../../db/pool');

const OPEN_REQUEST_STATUSES = new Set(['PENDING', 'ASSIGNED', 'IN_PROGRESS']);

async function getUsersForAdmin(options = {}) {
  const { users, total } = await listUsers(options);

  return {
    users: users.map((row) => mapAdminUserRow(row)),
    total,
  };
}

function mapAdminUserRow(row) {
  const firstName = row.first_name ? String(row.first_name).trim() : '';
  const lastName = row.last_name ? String(row.last_name).trim() : '';
  const username = [firstName, lastName].filter(Boolean).join(' ');

  return {
    userId: row.user_id,
    username: username || null,
    email: row.email,
    isEmailVerified: Boolean(row.is_email_verified),
    isBanned: Boolean(row.is_banned),
    banReason: row.ban_reason || null,
    bannedAt: row.banned_at || null,
    createdAt: row.created_at,
    isAdmin: Boolean(row.admin_id),
    adminRole: row.admin_role || null,
  };
}

function buildModerationError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function banUserForAdmin({ actorUserId = null, userId, reason = null }) {
  if (actorUserId && actorUserId === userId) {
    throw buildModerationError('SELF_BAN_FORBIDDEN', 'Admins cannot ban their own account.');
  }

  const client = await pool.connect();
  let updated = null;
  let volunteerCleanup = null;

  try {
    await client.query('BEGIN');

    const target = await findBanTargetByUserId(userId, client);
    if (!target) {
      await client.query('ROLLBACK');
      return null;
    }

    if (target.is_admin) {
      throw buildModerationError('ADMIN_BAN_FORBIDDEN', 'Admin accounts cannot be banned.');
    }

    updated = await banUserById(userId, reason, client);
    if (!updated) {
      await client.query('ROLLBACK');
      return null;
    }

    await cancelOpenRequestsForBannedRequester(userId, { db: client });
    volunteerCleanup = await cancelAssignmentsForBannedVolunteer(userId, {
      db: client,
      notify: false,
      runMatching: false,
    });

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  // Try rematching only after transaction commit to avoid partial writes.
  if (volunteerCleanup?.affectedRequestId) {
    try {
      await tryToAssignRequest(volunteerCleanup.affectedRequestId);
    } catch (error) {
      console.error('admin.banUserForAdmin rematching failed', error);
    }
  }

  return mapAdminUserRow(updated);
}

async function unbanUserForAdmin({ userId }) {
  const updated = await unbanUserById(userId);
  return updated ? mapAdminUserRow(updated) : null;
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

async function cancelOpenRequestsForBannedRequester(userId, options = {}) {
  const executor = options.db || null;
  const requesterRequests = await listHelpRequestsByUserId(userId, executor);
  const openRequests = requesterRequests.filter((request) => OPEN_REQUEST_STATUSES.has(request.internalStatus));

  for (const request of openRequests) {
    await markHelpRequestAsCancelled(userId, request.id, executor);
    await cancelAssignmentByRequestId(request.id, {
      db: executor,
      notify: false,
      runMatching: false,
    });
  }
}

module.exports = {
  getUsersForAdmin,
  banUserForAdmin,
  unbanUserForAdmin,
  getHelpRequestsForAdmin,
  getAnnouncementsForAdmin,
  getStatsForAdmin,
  getEmergencyOverviewForAdmin,
  getEmergencyHistoryForAdmin,
  getEmergencyAnalyticsForAdmin,
  getDeploymentMonitoringForAdmin,
};
