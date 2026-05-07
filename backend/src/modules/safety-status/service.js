const {
  findSafetyStatusByUserId,
  upsertSafetyStatus,
  listVisibleSafetyStatuses,
} = require('./repository');

async function getMySafetyStatus(userId) {
  return findSafetyStatusByUserId(userId);
}

async function patchMySafetyStatus(userId, input) {
  return upsertSafetyStatus(userId, input);
}

async function getVisibleSafetyStatuses(userId, options = {}) {
  return listVisibleSafetyStatuses(userId, options);
}

module.exports = {
  getMySafetyStatus,
  patchMySafetyStatus,
  getVisibleSafetyStatuses,
};
