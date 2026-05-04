function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateCreateCircle(payload) {
  const errors = [];
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';

  if (!name) {
    errors.push('`name` is required.');
  } else if (name.length > 120) {
    errors.push('`name` must be at most 120 characters.');
  }

  return {
    errors,
    value: { name },
  };
}

function validateCreateInvite(payload) {
  const errors = [];
  const inviteeUserId = hasText(payload.inviteeUserId) ? payload.inviteeUserId.trim() : null;
  const inviteeEmail = hasText(payload.inviteeEmail) ? payload.inviteeEmail.trim().toLowerCase() : null;

  if (!inviteeUserId && !inviteeEmail) {
    errors.push('`inviteeUserId` or `inviteeEmail` is required.');
  }

  return {
    errors,
    value: { inviteeUserId, inviteeEmail },
  };
}

function validateInviteResponse(payload) {
  const errors = [];
  const decision = hasText(payload.decision) ? payload.decision.trim().toLowerCase() : '';

  if (!['accept', 'reject'].includes(decision)) {
    errors.push('`decision` must be one of: accept, reject.');
  }

  return {
    errors,
    value: { decision },
  };
}

module.exports = {
  validateCreateCircle,
  validateCreateInvite,
  validateInviteResponse,
};
