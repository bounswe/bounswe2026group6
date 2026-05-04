const {
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

function parseBooleanQuery(value) {
  if (value === undefined || value === null || value === '') {
    return { value: null };
  }
  const normalized = String(value).toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return { value: true };
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return { value: false };
  }
  return { error: true };
}

function parseOptionalReason(rawReason) {
  if (rawReason === undefined || rawReason === null) {
    return { value: null };
  }

  if (typeof rawReason !== 'string') {
    return { error: '`reason` must be a string when provided.' };
  }

  const trimmed = rawReason.trim();
  if (trimmed.length > 1000) {
    return { error: '`reason` must be at most 1000 characters.' };
  }

  return { value: trimmed || null };
}

async function getAdminUsers(req, res) {
  try {
    const limitParam = req.query?.limit;
    const offsetParam = req.query?.offset;
    const limit = limitParam === undefined ? 50 : Number(limitParam);
    const offset = offsetParam === undefined ? 0 : Number(offsetParam);

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

    const isEmailVerified = parseBooleanQuery(req.query?.isEmailVerified);
    if (isEmailVerified.error) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: '`isEmailVerified` must be a boolean value.',
      });
    }

    const isBanned = parseBooleanQuery(req.query?.isBanned);
    if (isBanned.error) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: '`isBanned` must be a boolean value.',
      });
    }

    const emailRaw = req.query?.email;
    let emailContains = null;
    if (emailRaw !== undefined && emailRaw !== null && String(emailRaw).trim() !== '') {
      const trimmed = String(emailRaw).trim();
      if (trimmed.length > 255) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: '`email` filter must be at most 255 characters.',
        });
      }
      emailContains = trimmed;
    }

    const result = await getUsersForAdmin({
      limit,
      offset,
      emailContains,
      isEmailVerified: isEmailVerified.value,
      isBanned: isBanned.value,
    });

    return res.status(200).json({
      users: result.users,
      total: result.total,
      filters: {
        email: emailContains,
        isEmailVerified: isEmailVerified.value,
        isBanned: isBanned.value,
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

async function patchAdminUserBan(req, res) {
  try {
    const userId = typeof req.params?.userId === 'string' ? req.params.userId.trim() : '';
    if (!userId) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: '`userId` route param is required.',
      });
    }

    const parsedReason = parseOptionalReason(req.body?.reason);
    if (parsedReason.error) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: parsedReason.error,
      });
    }

    const user = await banUserForAdmin({
      actorUserId: req.user?.userId || null,
      userId,
      reason: parsedReason.value,
    });

    if (!user) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'User not found.',
      });
    }

    return res.status(200).json({ user });
  } catch (_error) {
    if (_error && (_error.code === 'SELF_BAN_FORBIDDEN' || _error.code === 'ADMIN_BAN_FORBIDDEN')) {
      return res.status(403).json({
        code: _error.code,
        message: _error.message,
      });
    }

    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
}

async function patchAdminUserUnban(req, res) {
  try {
    const userId = typeof req.params?.userId === 'string' ? req.params.userId.trim() : '';
    if (!userId) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: '`userId` route param is required.',
      });
    }

    const user = await unbanUserForAdmin({ userId });

    if (!user) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'User not found.',
      });
    }

    return res.status(200).json({ user });
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

function parsePositiveIntQuery(value, { min, max, defaultValue }) {
  if (value === undefined) {
    return { value: defaultValue };
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return { error: true, parsed };
  }
  return { value: parsed };
}

async function getAdminEmergencyAnalytics(req, res) {
  try {
    const regionLimit = parsePositiveIntQuery(req.query?.regionLimit, {
      min: 1,
      max: 50,
      defaultValue: 10,
    });
    if (regionLimit.error) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: '`regionLimit` must be an integer between 1 and 50.',
      });
    }

    const trendDays = parsePositiveIntQuery(req.query?.trendDays, {
      min: 1,
      max: 90,
      defaultValue: 14,
    });
    if (trendDays.error) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: '`trendDays` must be an integer between 1 and 90.',
      });
    }

    const comparisonWindowDays = parsePositiveIntQuery(req.query?.comparisonWindowDays, {
      min: 1,
      max: 30,
      defaultValue: 7,
    });
    if (comparisonWindowDays.error) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: '`comparisonWindowDays` must be an integer between 1 and 30.',
      });
    }

    const analytics = await getEmergencyAnalyticsForAdmin({
      regionLimit: regionLimit.value,
      trendDays: trendDays.value,
      comparisonWindowDays: comparisonWindowDays.value,
    });

    return res.status(200).json({ analytics });
  } catch (_error) {
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
}

async function getAdminDeploymentMonitoring(req, res) {
  try {
    const waitThresholdHours = parsePositiveIntQuery(req.query?.waitThresholdHours, {
      min: 1,
      max: 72,
      defaultValue: 6,
    });
    if (waitThresholdHours.error) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: '`waitThresholdHours` must be an integer between 1 and 72.',
      });
    }

    const neglectThresholdHours = parsePositiveIntQuery(req.query?.neglectThresholdHours, {
      min: 1,
      max: 168,
      defaultValue: 12,
    });
    if (neglectThresholdHours.error) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: '`neglectThresholdHours` must be an integer between 1 and 168.',
      });
    }

    const listLimit = parsePositiveIntQuery(req.query?.listLimit, {
      min: 1,
      max: 50,
      defaultValue: 10,
    });
    if (listLimit.error) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: '`listLimit` must be an integer between 1 and 50.',
      });
    }

    const monitoring = await getDeploymentMonitoringForAdmin({
      waitThresholdHours: waitThresholdHours.value,
      neglectThresholdHours: neglectThresholdHours.value,
      listLimit: listLimit.value,
    });

    return res.status(200).json({ monitoring });
  } catch (_error) {
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
}

module.exports = {
  getAdminUsers,
  patchAdminUserBan,
  patchAdminUserUnban,
  getAdminHelpRequests,
  getAdminAnnouncements,
  getAdminStats,
  getAdminEmergencyOverview,
  getAdminEmergencyHistory,
  getAdminEmergencyAnalytics,
  getAdminDeploymentMonitoring,
};
