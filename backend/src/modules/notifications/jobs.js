const {
  createNotification,
} = require('./service');
const {
  listAvailabilityPausedNotificationCandidates,
  expireStalePendingHelpRequests,
} = require('./repository');
const { env } = require('../../config/env');

let intervalHandle = null;
let running = false;

async function runAvailabilityPausedNotificationCycle() {
  const candidates = await listAvailabilityPausedNotificationCandidates({
    locationMaxAgeMinutes: env.volunteerMatching.locationMaxAgeMinutes,
    limit: env.notifications.jobBatchSize,
  });

  for (const candidate of candidates) {
    await createNotification({
      recipientUserId: candidate.userId,
      actorUserId: null,
      type: 'VOLUNTEER_AVAILABILITY_PAUSED',
      title: 'Volunteer availability paused',
      body: 'Your availability was paused because your location is no longer fresh. Open NEPH to refresh your location and become available again.',
      entity: null,
      data: {
        screen: 'availability',
        kind: 'availability_paused',
        pauseReason: candidate.pauseReason,
        pauseEventKey: candidate.pauseEventKey,
      },
    });
  }
}

async function runHelpRequestExpirationCycle() {
  const expiredRows = await expireStalePendingHelpRequests({
    ttlHours: env.notifications.pendingRequestTtlHours,
    limit: env.notifications.jobBatchSize,
  });

  for (const row of expiredRows) {
    if (!row.user_id) {
      continue;
    }

    await createNotification({
      recipientUserId: row.user_id,
      actorUserId: null,
      type: 'HELP_REQUEST_STATUS_CHANGED',
      title: 'Help request expired',
      body: 'Your help request expired due to inactivity and was cancelled.',
      entity: {
        type: 'HELP_REQUEST',
        id: row.request_id,
      },
      data: {
        screen: 'my-help-requests',
        requestId: row.request_id,
        status: 'CANCELLED',
        reason: 'ttl_expired',
      },
    });
  }
}

async function runNotificationJobsOnce() {
  if (running) {
    return;
  }

  running = true;
  try {
    await runAvailabilityPausedNotificationCycle();
    await runHelpRequestExpirationCycle();
  } catch (error) {
    console.error('notifications.jobs.runNotificationJobsOnce failed', error);
  } finally {
    running = false;
  }
}

function startNotificationJobs() {
  if (env.nodeEnv === 'test' || !env.notifications.jobsEnabled) {
    return;
  }

  if (intervalHandle) {
    return;
  }

  intervalHandle = setInterval(runNotificationJobsOnce, env.notifications.jobIntervalMs);
  if (typeof intervalHandle.unref === 'function') {
    intervalHandle.unref();
  }

  setTimeout(runNotificationJobsOnce, 5000);
}

function stopNotificationJobs() {
  if (!intervalHandle) {
    return;
  }

  clearInterval(intervalHandle);
  intervalHandle = null;
}

module.exports = {
  startNotificationJobs,
  stopNotificationJobs,
  runNotificationJobsOnce,
};
