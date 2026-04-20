const { query } = require('../../db/pool');
const { randomUUID } = require('crypto');

function makeId(prefix) {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}

function parseExpertiseAreas(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed;
    }
  } catch (_error) {
    // Backward compatibility: older records might store a single plain text value.
  }

  return [String(rawValue)];
}

function serializeExpertiseAreas(expertiseAreas) {
  return JSON.stringify(expertiseAreas || []);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(object, key) {
  return isPlainObject(object) && Object.prototype.hasOwnProperty.call(object, key);
}

function buildAddressFromAdministrative(administrative) {
  if (!isPlainObject(administrative)) {
    return null;
  }

  const parts = [administrative.neighborhood, administrative.district, administrative.extraAddress]
    .filter((item) => typeof item === 'string' && item.trim() !== '')
    .map((item) => item.trim());

  if (parts.length === 0) {
    return null;
  }

  return parts.join(', ');
}

function normalizeOptionalString(value, { uppercase = false } = {}) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }

  return uppercase ? trimmed.toUpperCase() : trimmed;
}

function normalizeIsoCountryCode(value) {
  const normalized = normalizeOptionalString(value, { uppercase: true });
  if (!normalized) {
    return null;
  }

  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function normalizeLocationInput(data) {
  const administrative = isPlainObject(data.administrative) ? data.administrative : null;
  const coordinate = isPlainObject(data.coordinate) ? data.coordinate : null;
  const fallbackAddress = buildAddressFromAdministrative(administrative);

  const displayAddress = normalizeOptionalString(data.displayAddress ?? data.address ?? fallbackAddress);
  const address = normalizeOptionalString(data.address ?? data.displayAddress ?? fallbackAddress);
  const city = normalizeOptionalString(data.city ?? administrative?.city);
  const country = normalizeOptionalString(data.country ?? administrative?.country);
  const countryCode = normalizeIsoCountryCode(administrative?.countryCode);
  const district = normalizeOptionalString(administrative?.district);
  const neighborhood = normalizeOptionalString(administrative?.neighborhood);
  const extraAddress = normalizeOptionalString(administrative?.extraAddress);
  const postalCode = normalizeOptionalString(administrative?.postalCode);
  const placeId = normalizeOptionalString(data.placeId);
  const latitude = data.latitude ?? coordinate?.latitude ?? null;
  const longitude = data.longitude ?? coordinate?.longitude ?? null;

  return {
    address,
    displayAddress,
    city,
    country,
    countryCode,
    district,
    neighborhood,
    extraAddress,
    postalCode,
    placeId,
    latitude,
    longitude,
  };
}

async function findActiveUserById(userId) {
  const sql = `
    SELECT user_id
    FROM users
    WHERE user_id = $1
      AND is_deleted = FALSE
    LIMIT 1;
  `;

  const result = await query(sql, [userId]);
  return result.rows[0] || null;
}

async function findProfileByUserId(userId) {
  const sql = `
    SELECT profile_id, user_id, first_name, last_name, phone_number
    FROM user_profiles
    WHERE user_id = $1
    LIMIT 1;
  `;

  const result = await query(sql, [userId]);
  return result.rows[0] || null;
}

function buildUpdateClause(fieldMap, data, firstParamIndex) {
  const entries = Object.entries(fieldMap)
    .filter(([inputKey]) => Object.prototype.hasOwnProperty.call(data, inputKey));

  if (entries.length === 0) {
    return null;
  }

  const setParts = entries.map(([, columnName], index) => `${columnName} = $${firstParamIndex + index}`);
  const values = entries.map(([inputKey]) => data[inputKey]);

  return {
    setClause: setParts.join(', '),
    values,
  };
}

async function createProfileByUserId(userId, data) {
  const profileId = makeId('prf');
  const sql = `
    INSERT INTO user_profiles (profile_id, user_id, first_name, last_name, phone_number)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING profile_id, user_id, first_name, last_name, phone_number;
  `;

  const values = [profileId, userId, data.firstName, data.lastName, data.phoneNumber ?? null];
  const result = await query(sql, values);
  return result.rows[0];
}

async function upsertProfileByUserId(userId, data, providedFields = []) {
  const provided = new Set(providedFields);
  const hasFirstName = provided.has('firstName');
  const hasLastName = provided.has('lastName');
  const hasPhoneNumber = provided.has('phoneNumber');

  const sql = `
    INSERT INTO user_profiles (profile_id, user_id, first_name, last_name, phone_number)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (user_id)
    DO UPDATE SET
      first_name = CASE WHEN $6 THEN EXCLUDED.first_name ELSE user_profiles.first_name END,
      last_name = CASE WHEN $7 THEN EXCLUDED.last_name ELSE user_profiles.last_name END,
      phone_number = CASE WHEN $8 THEN EXCLUDED.phone_number ELSE user_profiles.phone_number END
    RETURNING profile_id, user_id, first_name, last_name, phone_number;
  `;

  const values = [
    makeId('prf'),
    userId,
    data.firstName,
    data.lastName,
    data.phoneNumber ?? null,
    hasFirstName,
    hasLastName,
    hasPhoneNumber,
  ];

  const result = await query(sql, values);
  return result.rows[0] || null;
}

async function updateProfileByUserId(userId, data) {
  const clause = buildUpdateClause(
    {
      firstName: 'first_name',
      lastName: 'last_name',
      phoneNumber: 'phone_number',
    },
    data,
    1,
  );

  if (!clause) {
    return findProfileByUserId(userId);
  }

  const sql = `
    UPDATE user_profiles
    SET ${clause.setClause}
    WHERE user_id = $${clause.values.length + 1}
    RETURNING profile_id, user_id, first_name, last_name, phone_number;
  `;

  const values = [...clause.values, userId];
  const result = await query(sql, values);
  return result.rows[0] || null;
}

async function upsertPhysicalInfo(profileId, data, providedFields = []) {
  const provided = new Set(providedFields);
  const hasAge = provided.has('age');
  const hasGender = provided.has('gender');
  const hasHeight = provided.has('height');
  const hasWeight = provided.has('weight');

  const sql = `
    INSERT INTO physical_info (physical_id, profile_id, age, gender, height, weight)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (profile_id)
    DO UPDATE SET
      age = CASE WHEN $7 THEN EXCLUDED.age ELSE physical_info.age END,
      gender = CASE WHEN $8 THEN EXCLUDED.gender ELSE physical_info.gender END,
      height = CASE WHEN $9 THEN EXCLUDED.height ELSE physical_info.height END,
      weight = CASE WHEN $10 THEN EXCLUDED.weight ELSE physical_info.weight END
    RETURNING profile_id;
  `;

  const values = [
    makeId('phy'),
    profileId,
    data.age ?? null,
    data.gender ?? null,
    data.height ?? null,
    data.weight ?? null,
    hasAge,
    hasGender,
    hasHeight,
    hasWeight,
  ];

  await query(sql, values);
}

async function upsertHealthInfo(profileId, data, providedFields = []) {
  const provided = new Set(providedFields);
  const hasMedicalConditions = provided.has('medicalConditions');
  const hasChronicDiseases = provided.has('chronicDiseases');
  const hasAllergies = provided.has('allergies');
  const hasMedications = provided.has('medications');
  const hasBloodType = provided.has('bloodType');

  const sql = `
    INSERT INTO health_info (
      health_id,
      profile_id,
      medical_conditions,
      chronic_diseases,
      allergies,
      medications,
      blood_type
    )
    VALUES (
      $1,
      $2,
      CASE WHEN $8 THEN COALESCE($3, ARRAY[]::TEXT[]) ELSE ARRAY[]::TEXT[] END,
      CASE WHEN $9 THEN COALESCE($4, ARRAY[]::TEXT[]) ELSE ARRAY[]::TEXT[] END,
      CASE WHEN $10 THEN COALESCE($5, ARRAY[]::TEXT[]) ELSE ARRAY[]::TEXT[] END,
      CASE WHEN $11 THEN COALESCE($6, ARRAY[]::TEXT[]) ELSE ARRAY[]::TEXT[] END,
      CASE WHEN $12 THEN $7 ELSE NULL END
    )
    ON CONFLICT (profile_id)
    DO UPDATE SET
      medical_conditions = CASE WHEN $8 THEN EXCLUDED.medical_conditions ELSE health_info.medical_conditions END,
      chronic_diseases = CASE WHEN $9 THEN EXCLUDED.chronic_diseases ELSE health_info.chronic_diseases END,
      allergies = CASE WHEN $10 THEN EXCLUDED.allergies ELSE health_info.allergies END,
      medications = CASE WHEN $11 THEN EXCLUDED.medications ELSE health_info.medications END,
      blood_type = CASE WHEN $12 THEN EXCLUDED.blood_type ELSE health_info.blood_type END
    RETURNING profile_id;
  `;

  const values = [
    makeId('hlth'),
    profileId,
    data.medicalConditions,
    data.chronicDiseases,
    data.allergies,
    data.medications,
    data.bloodType,
    hasMedicalConditions,
    hasChronicDiseases,
    hasAllergies,
    hasMedications,
    hasBloodType,
  ];

  await query(sql, values);
}

async function upsertLocationProfile(profileId, data, providedFields = []) {
  const provided = new Set(providedFields);
  const administrative = isPlainObject(data.administrative) ? data.administrative : null;
  const coordinate = isPlainObject(data.coordinate) ? data.coordinate : null;
  const hasAddress =
    provided.has('address')
    || provided.has('displayAddress')
    || hasOwn(administrative, 'neighborhood')
    || hasOwn(administrative, 'district')
    || hasOwn(administrative, 'extraAddress');
  const hasDisplayAddress = hasAddress || provided.has('displayAddress');
  const hasCity = provided.has('city') || hasOwn(administrative, 'city');
  const hasCountry = provided.has('country') || hasOwn(administrative, 'country');
  const hasCountryCode = hasOwn(administrative, 'countryCode');
  const hasDistrict = hasOwn(administrative, 'district');
  const hasNeighborhood = hasOwn(administrative, 'neighborhood');
  const hasExtraAddress = hasOwn(administrative, 'extraAddress');
  const hasPostalCode = hasOwn(administrative, 'postalCode');
  const hasPlaceId = provided.has('placeId');
  const hasLatitude = provided.has('latitude') || hasOwn(coordinate, 'latitude');
  const hasLongitude = provided.has('longitude') || hasOwn(coordinate, 'longitude');
  const normalizedLocation = normalizeLocationInput(data);

  const sql = `
    INSERT INTO location_profiles (
      location_profile_id,
      profile_id,
      address,
      display_address,
      city,
      country,
      country_code,
      district,
      neighborhood,
      extra_address,
      postal_code,
      place_id,
      latitude,
      longitude
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    ON CONFLICT (profile_id)
    DO UPDATE SET
      address = CASE WHEN $15 THEN EXCLUDED.address ELSE location_profiles.address END,
      display_address = CASE WHEN $16 THEN EXCLUDED.display_address ELSE location_profiles.display_address END,
      city = CASE WHEN $17 THEN EXCLUDED.city ELSE location_profiles.city END,
      country = CASE WHEN $18 THEN EXCLUDED.country ELSE location_profiles.country END,
      country_code = CASE WHEN $19 THEN EXCLUDED.country_code ELSE location_profiles.country_code END,
      district = CASE WHEN $20 THEN EXCLUDED.district ELSE location_profiles.district END,
      neighborhood = CASE WHEN $21 THEN EXCLUDED.neighborhood ELSE location_profiles.neighborhood END,
      extra_address = CASE WHEN $22 THEN EXCLUDED.extra_address ELSE location_profiles.extra_address END,
      postal_code = CASE WHEN $23 THEN EXCLUDED.postal_code ELSE location_profiles.postal_code END,
      place_id = CASE WHEN $24 THEN EXCLUDED.place_id ELSE location_profiles.place_id END,
      latitude = CASE WHEN $25 THEN EXCLUDED.latitude ELSE location_profiles.latitude END,
      longitude = CASE WHEN $26 THEN EXCLUDED.longitude ELSE location_profiles.longitude END,
      last_updated = CURRENT_TIMESTAMP
    RETURNING profile_id;
  `;

  const values = [
    makeId('loc'),
    profileId,
    normalizedLocation.address,
    normalizedLocation.displayAddress,
    normalizedLocation.city,
    normalizedLocation.country,
    normalizedLocation.countryCode,
    normalizedLocation.district,
    normalizedLocation.neighborhood,
    normalizedLocation.extraAddress,
    normalizedLocation.postalCode,
    normalizedLocation.placeId,
    normalizedLocation.latitude,
    normalizedLocation.longitude,
    hasAddress,
    hasDisplayAddress,
    hasCity,
    hasCountry,
    hasCountryCode,
    hasDistrict,
    hasNeighborhood,
    hasExtraAddress,
    hasPostalCode,
    hasPlaceId,
    hasLatitude,
    hasLongitude,
  ];

  await query(sql, values);
}

async function upsertPrivacySettings(profileId, data, providedFields = []) {
  const provided = new Set(providedFields);
  const hasProfileVisibility = provided.has('profileVisibility');
  const hasHealthInfoVisibility = provided.has('healthInfoVisibility');
  const hasLocationVisibility = provided.has('locationVisibility');
  const hasLocationSharingEnabled = provided.has('locationSharingEnabled');

  const sql = `
    INSERT INTO privacy_settings (
      settings_id,
      profile_id,
      profile_visibility,
      health_info_visibility,
      location_visibility,
      location_sharing_enabled
    )
    VALUES (
      $1,
      $2,
      CASE WHEN $7 THEN $3::visibility_level ELSE 'PRIVATE'::visibility_level END,
      CASE WHEN $8 THEN $4::visibility_level ELSE 'PRIVATE'::visibility_level END,
      CASE WHEN $9 THEN $5::visibility_level ELSE 'PRIVATE'::visibility_level END,
      CASE WHEN $10 THEN $6 ELSE FALSE END
    )
    ON CONFLICT (profile_id)
    DO UPDATE SET
      profile_visibility = CASE WHEN $7 THEN EXCLUDED.profile_visibility ELSE privacy_settings.profile_visibility END,
      health_info_visibility = CASE WHEN $8 THEN EXCLUDED.health_info_visibility ELSE privacy_settings.health_info_visibility END,
      location_visibility = CASE WHEN $9 THEN EXCLUDED.location_visibility ELSE privacy_settings.location_visibility END,
      location_sharing_enabled = CASE WHEN $10 THEN EXCLUDED.location_sharing_enabled ELSE privacy_settings.location_sharing_enabled END
    RETURNING profile_id;
  `;

  const values = [
    makeId('set'),
    profileId,
    data.profileVisibility,
    data.healthInfoVisibility,
    data.locationVisibility,
    data.locationSharingEnabled,
    hasProfileVisibility,
    hasHealthInfoVisibility,
    hasLocationVisibility,
    hasLocationSharingEnabled,
  ];

  await query(sql, values);
}

async function listExpertiseByProfileId(profileId) {
  const sql = `
    SELECT expertise_id, profession, expertise_area, is_verified
    FROM expertise
    WHERE profile_id = $1
    ORDER BY expertise_id ASC;
  `;

  const result = await query(sql, [profileId]);

  return result.rows.map((row) => ({
    expertiseId: row.expertise_id,
    profession: row.profession,
    expertiseArea: row.expertise_area,
    expertiseAreas: parseExpertiseAreas(row.expertise_area),
    isVerified: row.is_verified,
  }));
}

async function upsertProfession(profileId, data) {
  const current = await query(
    `
      SELECT expertise_id
      FROM expertise
      WHERE profile_id = $1
      ORDER BY expertise_id ASC
      LIMIT 1;
    `,
    [profileId],
  );

  if (current.rows.length === 0) {
    await query(
      `
        INSERT INTO expertise (
          expertise_id,
          profile_id,
          profession,
          expertise_area,
          is_verified
        )
        VALUES ($1, $2, $3, $4, FALSE);
      `,
      [makeId('exp'), profileId, data.profession ?? null, null],
    );
    return;
  }

  await query(
    `
      UPDATE expertise
      SET profession = $2
      WHERE expertise_id = $1;
    `,
    [current.rows[0].expertise_id, data.profession],
  );
}

async function upsertExpertiseAreas(profileId, expertiseAreas) {
  const current = await query(
    `
      SELECT expertise_id
      FROM expertise
      WHERE profile_id = $1
      ORDER BY expertise_id ASC
      LIMIT 1;
    `,
    [profileId],
  );

  const serializedAreas = serializeExpertiseAreas(expertiseAreas);

  if (current.rows.length === 0) {
    await query(
      `
        INSERT INTO expertise (
          expertise_id,
          profile_id,
          profession,
          expertise_area,
          is_verified
        )
        VALUES ($1, $2, NULL, $3, FALSE);
      `,
      [makeId('exp'), profileId, serializedAreas],
    );
    return;
  }

  await query(
    `
      UPDATE expertise
      SET expertise_area = $2
      WHERE expertise_id = $1;
    `,
    [current.rows[0].expertise_id, serializedAreas],
  );
}

async function findProfileBundleByUserId(userId) {
  const sql = `
    SELECT
      up.profile_id,
      up.user_id,
      up.first_name,
      up.last_name,
      up.phone_number,
      ps.profile_visibility,
      ps.health_info_visibility,
      ps.location_visibility,
      ps.location_sharing_enabled,
      hi.medical_conditions,
      hi.chronic_diseases,
      hi.allergies,
      hi.medications,
      hi.blood_type,
      pi.age,
      pi.gender,
      pi.height,
      pi.weight,
      lp.address,
      lp.display_address,
      lp.city,
      lp.country,
      lp.country_code,
      lp.district,
      lp.neighborhood,
      lp.extra_address,
      lp.postal_code,
      lp.place_id,
      lp.latitude,
      lp.longitude,
      lp.last_updated
    FROM user_profiles up
    JOIN users u ON u.user_id = up.user_id
    LEFT JOIN privacy_settings ps ON ps.profile_id = up.profile_id
    LEFT JOIN health_info hi ON hi.profile_id = up.profile_id
    LEFT JOIN physical_info pi ON pi.profile_id = up.profile_id
    LEFT JOIN location_profiles lp ON lp.profile_id = up.profile_id
    WHERE up.user_id = $1
      AND u.is_deleted = FALSE
    LIMIT 1;
  `;

  const result = await query(sql, [userId]);

  return result.rows[0] || null;
}

module.exports = {
  findActiveUserById,
  findProfileByUserId,
  createProfileByUserId,
  upsertProfileByUserId,
  updateProfileByUserId,
  upsertPhysicalInfo,
  upsertHealthInfo,
  upsertLocationProfile,
  upsertPrivacySettings,
  listExpertiseByProfileId,
  upsertProfession,
  upsertExpertiseAreas,
  findProfileBundleByUserId,
};
