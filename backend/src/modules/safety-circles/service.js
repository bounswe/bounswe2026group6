const {
  createCircle,
  listCirclesForUser,
  findCircleForMember,
  listCircleMembers,
  findUserByIdOrEmail,
  isCircleMember,
  createInvite,
  listInvitesForUser,
  findInviteForUser,
  respondToInvite,
  removeMember,
  deleteCircle,
  transferCircleOwnership,
} = require('./repository');
const { patchMySafetyStatus } = require('../safety-status/service');
const { createNotification } = require('../notifications/service');

function notFound(message = 'Safety circle not found') {
  const error = new Error(message);
  error.code = 'NOT_FOUND';
  return error;
}

function conflict(message) {
  const error = new Error(message);
  error.code = 'CONFLICT';
  return error;
}

function forbidden(message) {
  const error = new Error(message);
  error.code = 'FORBIDDEN';
  return error;
}

async function createSafetyCircle(userId, input) {
  return createCircle(userId, input);
}

async function notifySafetyCircleInviteReceived(invite, circle, actorUserId) {
  if (!invite || !invite.inviteeUserId || !invite.inviteId) {
    return;
  }

  try {
    await createNotification({
      recipientUserId: invite.inviteeUserId,
      actorUserId: actorUserId || null,
      type: 'SAFETY_CIRCLE_INVITE_RECEIVED',
      title: 'Safety circle invite',
      body: `You were invited to ${circle?.name || invite.circleName || 'a safety circle'}.`,
      entity: {
        type: 'SAFETY_CIRCLE_INVITE',
        id: invite.inviteId,
      },
      data: {
        screen: 'safety-circles',
        circleId: invite.circleId,
        inviteId: invite.inviteId,
        kind: 'safety_circle_invite',
      },
    });
  } catch (error) {
    console.error('safety-circles.notifySafetyCircleInviteReceived failed', error);
  }
}

async function notifySafetyCircleInviteResponded(invite, actorUserId) {
  if (!invite || !invite.inviterUserId || !invite.inviteId) {
    return;
  }

  try {
    await createNotification({
      recipientUserId: invite.inviterUserId,
      actorUserId: actorUserId || null,
      type: 'SAFETY_CIRCLE_INVITE_RESPONDED',
      title: 'Safety circle invite response',
      body: `A safety circle invite was ${invite.status}.`,
      entity: {
        type: 'SAFETY_CIRCLE_INVITE',
        id: invite.inviteId,
      },
      data: {
        screen: 'safety-circles',
        circleId: invite.circleId,
        inviteId: invite.inviteId,
        status: invite.status,
        kind: 'safety_circle_invite_response',
      },
    });
  } catch (error) {
    console.error('safety-circles.notifySafetyCircleInviteResponded failed', error);
  }
}

async function notifySafetyCircleUser(recipientUserId, actorUserId, circleId, payload) {
  if (!recipientUserId || recipientUserId === actorUserId) {
    return;
  }

  try {
    await createNotification({
      recipientUserId,
      actorUserId: actorUserId || null,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      entity: payload.entity || {
        type: 'SAFETY_CIRCLE',
        id: circleId,
      },
      data: {
        screen: 'safety-circles',
        circleId,
        ...(payload.data || {}),
      },
    });
  } catch (error) {
    console.error('safety-circles.notifySafetyCircleUser failed', error);
  }
}

async function listMySafetyCircles(userId) {
  return listCirclesForUser(userId);
}

async function getSafetyCircle(userId, circleId) {
  const circle = await findCircleForMember(circleId, userId);
  if (!circle) {
    throw notFound();
  }

  const members = await listCircleMembers(circleId, userId);
  const currentUser = members.find((member) => member.userId === userId);
  return { circle, currentUserRole: currentUser?.role || 'member', members };
}

async function inviteToSafetyCircle(userId, circleId, input) {
  const circle = await findCircleForMember(circleId, userId);
  if (!circle) {
    throw notFound();
  }

  const invitee = await findUserByIdOrEmail(input);
  if (!invitee) {
    throw notFound('Invitee user not found');
  }
  if (invitee.user_id === userId) {
    throw conflict('You cannot invite yourself to a safety circle.');
  }
  if (await isCircleMember(circleId, invitee.user_id)) {
    throw conflict('User is already a member of this safety circle.');
  }

  try {
    const invite = await createInvite(circleId, userId, invitee.user_id);
    await notifySafetyCircleInviteReceived(invite, circle, userId);
    return invite;
  } catch (error) {
    if (error && error.code === '23505') {
      throw conflict('A pending invite already exists for this user.');
    }
    throw error;
  }
}

async function listMySafetyCircleInvites(userId) {
  return listInvitesForUser(userId);
}

async function respondToSafetyCircleInvite(userId, inviteId, decision) {
  const existingInvite = await findInviteForUser(inviteId, userId);
  const invite = await respondToInvite(inviteId, userId, decision);
  if (!invite) {
    throw notFound('Safety circle invite not found');
  }
  if (existingInvite && existingInvite.status === 'pending' && invite.status !== 'pending') {
    await notifySafetyCircleInviteResponded(invite, userId);
  }
  return invite;
}

async function checkInToSafetyCircle(userId, circleId, input) {
  const circle = await findCircleForMember(circleId, userId);
  if (!circle) {
    throw notFound();
  }

  const safetyStatus = await patchMySafetyStatus(userId, input);
  const circleDetail = await getSafetyCircle(userId, circleId);
  return {
    safetyStatus,
    circle: circleDetail.circle,
    members: circleDetail.members,
  };
}

async function leaveSafetyCircle(userId, circleId) {
  const circle = await findCircleForMember(circleId, userId);
  if (!circle) {
    throw notFound();
  }
  if (circle.ownerUserId === userId) {
    throw conflict('Circle owner cannot leave the circle.');
  }

  const removed = await removeMember(circleId, userId);
  if (!removed) {
    throw notFound();
  }

  await notifySafetyCircleUser(circle.ownerUserId, userId, circleId, {
    type: 'SAFETY_CIRCLE_UPDATED',
    title: 'Safety circle updated',
    body: 'A member left your safety circle.',
    data: {
      kind: 'safety_circle_member_left',
    },
  });

  return { message: 'You left the safety circle.' };
}

async function deleteSafetyCircle(userId, circleId) {
  const circle = await findCircleForMember(circleId, userId);
  if (!circle) {
    throw notFound();
  }
  if (circle.ownerUserId !== userId) {
    throw forbidden('Only the circle owner can delete this safety circle.');
  }

  const members = await listCircleMembers(circleId, userId);
  const deleted = await deleteCircle(circleId, userId);
  if (!deleted) {
    throw notFound();
  }

  for (const member of members) {
    await notifySafetyCircleUser(member.userId, userId, circleId, {
      type: 'SAFETY_CIRCLE_UPDATED',
      title: 'Safety circle deleted',
      body: 'A safety circle you were in was deleted.',
      data: {
        kind: 'safety_circle_deleted',
      },
    });
  }

  return { message: 'Safety circle deleted.' };
}

async function transferSafetyCircleOwnership(userId, circleId, nextOwnerUserId) {
  const circle = await findCircleForMember(circleId, userId);
  if (!circle) {
    throw notFound();
  }
  if (circle.ownerUserId !== userId) {
    throw forbidden('Only the circle owner can transfer ownership.');
  }
  if (nextOwnerUserId === userId) {
    throw conflict('You are already the owner of this safety circle.');
  }
  if (!(await isCircleMember(circleId, nextOwnerUserId))) {
    throw conflict('New owner must be an accepted circle member.');
  }

  const transferred = await transferCircleOwnership(circleId, userId, nextOwnerUserId);
  if (!transferred) {
    throw notFound();
  }

  await notifySafetyCircleUser(nextOwnerUserId, userId, circleId, {
    type: 'SAFETY_CIRCLE_UPDATED',
    title: 'Safety circle ownership transferred',
    body: 'You are now the owner of a safety circle.',
    data: {
      kind: 'safety_circle_ownership_transferred',
    },
  });

  return getSafetyCircle(userId, circleId);
}

module.exports = {
  createSafetyCircle,
  listMySafetyCircles,
  getSafetyCircle,
  inviteToSafetyCircle,
  listMySafetyCircleInvites,
  respondToSafetyCircleInvite,
  checkInToSafetyCircle,
  leaveSafetyCircle,
  deleteSafetyCircle,
  transferSafetyCircleOwnership,
};
