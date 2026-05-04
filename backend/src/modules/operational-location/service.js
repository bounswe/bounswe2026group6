const {
  findOperationalLocationByUserId,
  upsertOperationalLocation,
} = require('./repository');

async function getMyOperationalLocation(userId) {
  return findOperationalLocationByUserId(userId);
}

async function patchMyOperationalLocation(userId, input) {
  return upsertOperationalLocation(userId, input);
}

module.exports = {
  getMyOperationalLocation,
  patchMyOperationalLocation,
};
