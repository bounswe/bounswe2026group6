const {
  createCircle,
  listCirclesForUser,
  findCircleForMember,
  listCircleMembers,
  findUserByIdOrEmail,
  isCircleMember,
  createInvite,
  listInvitesForUser,
  respondToInvite,
  removeMember,
  deleteCircle,
  transferCircleOwnership,
} = require('./repository');
const { patchMySafetyStatus } = require('../safety-status/service');

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
    return await createInvite(circleId, userId, invitee.user_id);
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
  const invite = await respondToInvite(inviteId, userId, decision);
  if (!invite) {
    throw notFound('Safety circle invite not found');
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

  const deleted = await deleteCircle(circleId, userId);
  if (!deleted) {
    throw notFound();
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
