function readUserId(request) {
  if (request.user && request.user.userId) {
    return request.user.userId;
  }

  const isDevelopment = process.env.NODE_ENV === 'development';

  // Temporary fallback for local development until auth middleware is integrated.
  if (
    isDevelopment
    && typeof request.headers['x-user-id'] === 'string'
    && request.headers['x-user-id'].trim() !== ''
  ) {
    return request.headers['x-user-id'].trim();
  }

  return null;
}

const visibilityValues = new Set(['PUBLIC', 'EMERGENCY_ONLY', 'PRIVATE']);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function pickAllowed(body, allowedKeys) {
  return Object.fromEntries(
    Object.entries(body).filter(([key]) => allowedKeys.includes(key)),
  );
}

function validateProfilePatch(body, { requireNames } = { requireNames: false }) {
  if (!isPlainObject(body)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Payload must be an object' };
  }

  const data = pickAllowed(body, ['firstName', 'lastName', 'phoneNumber']);

  if (Object.keys(data).length === 0) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'At least one profile field must be provided' };
  }

  if (requireNames && (typeof data.firstName !== 'string' || typeof data.lastName !== 'string')) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'firstName and lastName are required to create profile' };
  }

  if (data.firstName !== undefined) {
    if (typeof data.firstName !== 'string' || data.firstName.trim() === '') {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'firstName must be a non-empty string' };
    }
    data.firstName = data.firstName.trim();
  }

  if (data.lastName !== undefined) {
    if (typeof data.lastName !== 'string' || data.lastName.trim() === '') {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'lastName must be a non-empty string' };
    }
    data.lastName = data.lastName.trim();
  }

  if (data.phoneNumber !== undefined && data.phoneNumber !== null && typeof data.phoneNumber !== 'string') {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'phoneNumber must be a string or null' };
  }

  return { ok: true, data };
}

function validatePhysicalPatch(body) {
  if (!isPlainObject(body)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Payload must be an object' };
  }

  const data = pickAllowed(body, ['age', 'gender', 'height', 'weight']);

  if (Object.keys(data).length === 0) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'At least one physical field must be provided' };
  }

  if (data.age !== undefined && (typeof data.age !== 'number' || data.age < 0)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'age must be a number >= 0' };
  }

  if (data.gender !== undefined && data.gender !== null && typeof data.gender !== 'string') {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'gender must be a string or null' };
  }

  if (data.height !== undefined && (typeof data.height !== 'number' || data.height <= 0)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'height must be a number > 0' };
  }

  if (data.weight !== undefined && (typeof data.weight !== 'number' || data.weight <= 0)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'weight must be a number > 0' };
  }

  return { ok: true, data };
}

function validateHealthPatch(body) {
  if (!isPlainObject(body)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Payload must be an object' };
  }

  const data = pickAllowed(body, ['medicalConditions', 'chronicDiseases', 'allergies', 'medications', 'bloodType']);

  if (Object.keys(data).length === 0) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'At least one health field must be provided' };
  }

  const listFields = ['medicalConditions', 'chronicDiseases', 'allergies', 'medications'];

  for (const field of listFields) {
    if (data[field] !== undefined) {
      if (!Array.isArray(data[field]) || data[field].some((item) => typeof item !== 'string')) {
        return { ok: false, code: 'VALIDATION_ERROR', message: `${field} must be an array of strings` };
      }
    }
  }

  if (data.bloodType !== undefined && data.bloodType !== null && typeof data.bloodType !== 'string') {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'bloodType must be a string or null' };
  }

  return { ok: true, data };
}

function validateLocationPatch(body) {
  if (!isPlainObject(body)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Payload must be an object' };
  }

  const data = pickAllowed(body, ['address', 'city', 'country', 'latitude', 'longitude']);

  if (Object.keys(data).length === 0) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'At least one location field must be provided' };
  }

  const latitudeProvided = Object.prototype.hasOwnProperty.call(data, 'latitude');
  const longitudeProvided = Object.prototype.hasOwnProperty.call(data, 'longitude');

  if (latitudeProvided !== longitudeProvided) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'latitude and longitude must be provided together' };
  }

  if (latitudeProvided && data.latitude !== null && (typeof data.latitude !== 'number' || data.latitude < -90 || data.latitude > 90)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'latitude must be between -90 and 90' };
  }

  if (longitudeProvided && data.longitude !== null && (typeof data.longitude !== 'number' || data.longitude < -180 || data.longitude > 180)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'longitude must be between -180 and 180' };
  }

  for (const field of ['address', 'city', 'country']) {
    if (data[field] !== undefined && data[field] !== null && typeof data[field] !== 'string') {
      return { ok: false, code: 'VALIDATION_ERROR', message: `${field} must be a string or null` };
    }
  }

  return { ok: true, data };
}

function validatePrivacyPatch(body) {
  if (!isPlainObject(body)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Payload must be an object' };
  }

  const data = pickAllowed(body, ['profileVisibility', 'healthInfoVisibility', 'locationVisibility', 'locationSharingEnabled']);

  if (Object.keys(data).length === 0) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'At least one privacy field must be provided' };
  }

  for (const field of ['profileVisibility', 'healthInfoVisibility', 'locationVisibility']) {
    if (data[field] !== undefined && !visibilityValues.has(data[field])) {
      return { ok: false, code: 'VALIDATION_ERROR', message: `${field} must be one of PUBLIC, EMERGENCY_ONLY, PRIVATE` };
    }
  }

  if (data.locationSharingEnabled !== undefined && typeof data.locationSharingEnabled !== 'boolean') {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'locationSharingEnabled must be a boolean' };
  }

  return { ok: true, data };
}

module.exports = {
  readUserId,
  validateProfilePatch,
  validatePhysicalPatch,
  validateHealthPatch,
  validateLocationPatch,
  validatePrivacyPatch,
};
