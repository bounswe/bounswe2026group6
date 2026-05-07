const {
  findSafetyStatusByUserId,
  upsertSafetyStatus,
  listVisibleSafetyStatuses,
} = require('./repository');
const {
  listCirclesForUser,
  listCircleMembers,
} = require('../safety-circles/repository');
const { createNotification } = require('../notifications/service');

async function getMySafetyStatus(userId) {
  return findSafetyStatusByUserId(userId);
}

async function notifySafetyCircleMembersForStatusUpdate(userId, input, safetyStatus) {
  try {
    const circles = await listCirclesForUser(userId);
    const recipientsByUserId = new Map();

    for (const circle of circles) {
      let members = [];
      try {
        members = await listCircleMembers(circle.circleId, userId);
      } catch (memberError) {
        console.error('safety-status.notifySafetyCircleMembers member lookup failed', memberError);
        continue;
      }

      for (const member of members) {
        if (!member.userId || member.userId === userId) {
          continue;
        }

        if (!recipientsByUserId.has(member.userId)) {
          recipientsByUserId.set(member.userId, circle.circleId);
        }
      }
    }

    const status = input.status || safetyStatus?.status || 'unknown';
    for (const [recipientUserId, circleId] of recipientsByUserId.entries()) {
      try {
        await createNotification({
          recipientUserId,
          actorUserId: userId,
          type: 'SAFETY_CIRCLE_STATUS_UPDATED',
          title: status === 'not_safe' ? 'Safety circle alert' : 'Safety status updated',
          body: status === 'not_safe'
            ? 'A safety circle member marked themselves as not safe.'
            : 'A safety circle member updated their safety status.',
          entity: {
            type: 'SAFETY_CIRCLE',
            id: circleId,
          },
          data: {
            screen: 'safety-circles',
            circleId,
            kind: 'safety_circle_status_update',
            status,
          },
        });
      } catch (notificationError) {
        console.error('safety-status.notifySafetyCircleMembers notification failed', notificationError);
      }
    }
  } catch (error) {
    console.error('safety-status.notifySafetyCircleMembers circle lookup failed', error);
  }
}

async function patchMySafetyStatus(userId, input) {
  const safetyStatus = await upsertSafetyStatus(userId, input);
  await notifySafetyCircleMembersForStatusUpdate(userId, input, safetyStatus);
  return safetyStatus;
}

async function getVisibleSafetyStatuses(userId, options = {}) {
  return listVisibleSafetyStatuses(userId, options);
}

module.exports = {
  getMySafetyStatus,
  patchMySafetyStatus,
  getVisibleSafetyStatuses,
};
