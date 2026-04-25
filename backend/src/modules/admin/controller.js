const {
  getUsersForAdmin,
  getHelpRequestsForAdmin,
  getAnnouncementsForAdmin,
  getStatsForAdmin,
  getEmergencyOverviewForAdmin,
  getEmergencyHistoryForAdmin,
} = require('./service');

const ALLOWED_HISTORY_STATUSES = new Set(['RESOLVED', 'CANCELLED']);
const ALLOWED_URGENCY_LEVELS = new Set(['LOW', 'MEDIUM', 'HIGH']);

function parseCsvQuery(value) {
  if (!value) {
    return [];
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function getAdminUsers(_req, res) {
  try {
    const users = await getUsersForAdmin();

    return res.status(200).json({ users });
  } catch (_error) {
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
}

async function getAdminHelpRequests(_req, res) {
  try {
    const helpRequests = await getHelpRequestsForAdmin();

    return res.status(200).json({ helpRequests });
  } catch (_error) {
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
}

async function getAdminAnnouncements(_req, res) {
  try {
    const announcements = await getAnnouncementsForAdmin();

    return res.status(200).json({ announcements });
  } catch (_error) {
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
}

async function getAdminStats(_req, res) {
  try {
    const stats = await getStatsForAdmin();

    return res.status(200).json({ stats });
  } catch (_error) {
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
}

async function getAdminEmergencyOverview(req, res) {
  try {
    const includeRegionSummary = ['1', 'true', 'yes', 'on'].includes(
      String(req.query?.includeRegionSummary || '').toLowerCase(),
    );
    const overview = await getEmergencyOverviewForAdmin({ includeRegionSummary });

    return res.status(200).json({ overview });
  } catch (_error) {
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
}

async function getAdminEmergencyHistory(req, res) {
  try {
    const requestedStatuses = parseCsvQuery(req.query?.status).map((item) => item.toUpperCase());
    const invalidStatuses = requestedStatuses.filter((item) => !ALLOWED_HISTORY_STATUSES.has(item));

    if (invalidStatuses.length > 0) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: `Invalid status filter: ${invalidStatuses.join(', ')}`,
      });
    }

    const requestedCities = parseCsvQuery(req.query?.city).map((item) => item.toLowerCase());
    const requestedNeedTypes = parseCsvQuery(req.query?.type).map((item) => item.toLowerCase());
    const requestedUrgencies = parseCsvQuery(req.query?.urgency).map((item) => item.toUpperCase());
    const invalidUrgencies = requestedUrgencies.filter((item) => !ALLOWED_URGENCY_LEVELS.has(item));
    const limitParam = req.query?.limit;
    const offsetParam = req.query?.offset;
    const limit = limitParam === undefined ? 50 : Number(limitParam);
    const offset = offsetParam === undefined ? 0 : Number(offsetParam);

    if (invalidUrgencies.length > 0) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: `Invalid urgency filter: ${invalidUrgencies.join(', ')}`,
      });
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: '`limit` must be an integer between 1 and 200.',
      });
    }
    if (!Number.isInteger(offset) || offset < 0 || offset > 100000) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: '`offset` must be an integer between 0 and 100000.',
      });
    }

    const historyPayload = await getEmergencyHistoryForAdmin({
      statuses: requestedStatuses.length > 0 ? requestedStatuses : null,
      cities: requestedCities.length > 0 ? requestedCities : null,
      needTypes: requestedNeedTypes.length > 0 ? requestedNeedTypes : null,
      urgencies: requestedUrgencies.length > 0 ? requestedUrgencies : null,
      limit,
      offset,
    });

    return res.status(200).json({
      history: historyPayload.history,
      total: historyPayload.total,
      filters: {
        status: requestedStatuses,
        city: requestedCities,
        type: requestedNeedTypes,
        urgency: requestedUrgencies,
        limit,
        offset,
      },
    });
  } catch (_error) {
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
}

module.exports = {
  getAdminUsers,
  getAdminHelpRequests,
  getAdminAnnouncements,
  getAdminStats,
  getAdminEmergencyOverview,
  getAdminEmergencyHistory,
};
