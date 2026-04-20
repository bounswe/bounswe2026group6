function readUserId(request) {
  if (request.user && request.user.userId) {
    return request.user.userId;
  }

  return null;
}

const visibilityValues = new Set(['PUBLIC', 'EMERGENCY_ONLY', 'PRIVATE']);
const isoAlpha2Pattern = /^[A-Za-z]{2}$/;

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

  const data = pickAllowed(body, [
    'address',
    'city',
    'country',
    'latitude',
    'longitude',
    'displayAddress',
    'placeId',
    'administrative',
    'coordinate',
  ]);

  if (Object.keys(data).length === 0) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'At least one location field must be provided' };
  }

  if (data.administrative !== undefined && !isPlainObject(data.administrative)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'administrative must be an object' };
  }

  if (data.coordinate !== undefined && !isPlainObject(data.coordinate)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'coordinate must be an object' };
  }

  if (isPlainObject(data.coordinate)) {
    const coordinateHasLatitude = Object.prototype.hasOwnProperty.call(data.coordinate, 'latitude');
    const coordinateHasLongitude = Object.prototype.hasOwnProperty.call(data.coordinate, 'longitude');

    if (coordinateHasLatitude !== coordinateHasLongitude) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'coordinate.latitude and coordinate.longitude must be provided together' };
    }

    if (
      coordinateHasLatitude
      && data.coordinate.latitude !== null
      && (typeof data.coordinate.latitude !== 'number' || data.coordinate.latitude < -90 || data.coordinate.latitude > 90)
    ) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'coordinate.latitude must be between -90 and 90' };
    }

    if (
      coordinateHasLongitude
      && data.coordinate.longitude !== null
      && (typeof data.coordinate.longitude !== 'number' || data.coordinate.longitude < -180 || data.coordinate.longitude > 180)
    ) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'coordinate.longitude must be between -180 and 180' };
    }

    if (
      Object.prototype.hasOwnProperty.call(data.coordinate, 'accuracyMeters')
      && data.coordinate.accuracyMeters !== null
      && (typeof data.coordinate.accuracyMeters !== 'number' || data.coordinate.accuracyMeters < 0)
    ) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'coordinate.accuracyMeters must be a number >= 0' };
    }

    if (
      Object.prototype.hasOwnProperty.call(data.coordinate, 'source')
      && data.coordinate.source !== null
      && typeof data.coordinate.source !== 'string'
    ) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'coordinate.source must be a string or null' };
    }

    if (
      Object.prototype.hasOwnProperty.call(data.coordinate, 'capturedAt')
      && data.coordinate.capturedAt !== null
      && typeof data.coordinate.capturedAt !== 'string'
    ) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'coordinate.capturedAt must be a string or null' };
    }

    if (
      Object.prototype.hasOwnProperty.call(data, 'latitude')
      && Object.prototype.hasOwnProperty.call(data.coordinate, 'latitude')
      && data.latitude !== null
      && data.coordinate.latitude !== null
      && data.latitude !== data.coordinate.latitude
    ) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'latitude conflicts with coordinate.latitude' };
    }

    if (
      Object.prototype.hasOwnProperty.call(data, 'longitude')
      && Object.prototype.hasOwnProperty.call(data.coordinate, 'longitude')
      && data.longitude !== null
      && data.coordinate.longitude !== null
      && data.longitude !== data.coordinate.longitude
    ) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'longitude conflicts with coordinate.longitude' };
    }
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

  for (const field of ['address', 'city', 'country', 'displayAddress', 'placeId']) {
    if (data[field] !== undefined && data[field] !== null && typeof data[field] !== 'string') {
      return { ok: false, code: 'VALIDATION_ERROR', message: `${field} must be a string or null` };
    }
  }

  if (isPlainObject(data.administrative)) {
    for (const field of ['countryCode', 'country', 'city', 'district', 'neighborhood', 'extraAddress', 'postalCode']) {
      if (
        Object.prototype.hasOwnProperty.call(data.administrative, field)
        && data.administrative[field] !== null
        && typeof data.administrative[field] !== 'string'
      ) {
        return { ok: false, code: 'VALIDATION_ERROR', message: `administrative.${field} must be a string or null` };
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(data.administrative, 'countryCode')
      && data.administrative.countryCode !== null
    ) {
      const normalizedCountryCode = data.administrative.countryCode.trim();
      if (!isoAlpha2Pattern.test(normalizedCountryCode)) {
        return { ok: false, code: 'VALIDATION_ERROR', message: 'administrative.countryCode must be a 2-letter ISO code' };
      }

      data.administrative.countryCode = normalizedCountryCode.toUpperCase();
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

function validateProfessionPatch(body) {
  if (!isPlainObject(body)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Payload must be an object' };
  }

  const data = pickAllowed(body, ['profession']);

  if (Object.keys(data).length === 0) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'profession must be provided' };
  }

  if (data.profession !== undefined) {
    if (data.profession !== null && typeof data.profession !== 'string') {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'profession must be a string or null' };
    }

    if (typeof data.profession === 'string') {
      data.profession = data.profession.trim();
      if (data.profession === '') {
        return { ok: false, code: 'VALIDATION_ERROR', message: 'profession cannot be empty. Use null to clear it' };
      }
    }

    if (typeof data.profession === 'string' && data.profession.length > 200) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'profession must be at most 200 characters' };
    }
  }

  return { ok: true, data };
}

function validateExpertiseAreasPatch(body) {
  if (!isPlainObject(body)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Payload must be an object' };
  }

  const data = pickAllowed(body, ['expertiseAreas']);

  if (!Object.prototype.hasOwnProperty.call(data, 'expertiseAreas')) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'expertiseAreas must be provided' };
  }

  if (!Array.isArray(data.expertiseAreas)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'expertiseAreas must be an array of strings' };
  }

  if (data.expertiseAreas.length > 5) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'expertiseAreas can contain at most 5 items' };
  }

  const normalized = [];
  for (const item of data.expertiseAreas) {
    if (typeof item !== 'string') {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'expertiseAreas must be an array of strings' };
    }

    const trimmed = item.trim();
    if (!trimmed) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'expertiseAreas items cannot be empty' };
    }

    if (trimmed.length > 35) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'each expertise area must be at most 35 characters' };
    }

    normalized.push(trimmed);
  }

  const unique = Array.from(new Set(normalized));
  if (unique.length !== normalized.length) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'expertiseAreas cannot contain duplicates' };
  }

  // expertise.expertise_area column is VARCHAR(200), and values are stored as JSON string.
  if (JSON.stringify(unique).length > 200) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'expertiseAreas is too long for storage. Choose shorter area names',
    };
  }

  return { ok: true, data: { expertiseAreas: unique } };
}

module.exports = {
  readUserId,
  validateProfilePatch,
  validatePhysicalPatch,
  validateHealthPatch,
  validateLocationPatch,
  validatePrivacyPatch,
  validateProfessionPatch,
  validateExpertiseAreasPatch,
};
