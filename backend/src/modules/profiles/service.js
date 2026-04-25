const {
  findActiveUserById,
  findProfileByUserId,
  createProfileByUserId,
  updateProfileByUserId,
  upsertPhysicalInfo,
  upsertHealthInfo,
  upsertLocationProfile,
  upsertPrivacySettings,
  upsertProfession,
  upsertExpertiseAreas,
  findProfileBundleByUserId,
  listExpertiseByProfileId,
} = require('./repository');

function mapProfileRow(row) {
  return {
    profile: {
      profileId: row.profile_id,
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      phoneNumber: row.phone_number,
    },
    privacySettings: {
      profileVisibility: row.profile_visibility || 'PRIVATE',
      healthInfoVisibility: row.health_info_visibility || 'PRIVATE',
      locationVisibility: row.location_visibility || 'PRIVATE',
      locationSharingEnabled: row.location_sharing_enabled || false,
    },
    healthInfo: {
      medicalConditions: row.medical_conditions || [],
      chronicDiseases: row.chronic_diseases || [],
      allergies: row.allergies || [],
      medications: row.medications || [],
      bloodType: row.blood_type || null,
    },
    physicalInfo: {
      age: row.age,
      gender: row.gender,
      height: row.height,
      weight: row.weight,
    },
    locationProfile: {
      address: row.address,
      displayAddress: row.display_address || row.address,
      city: row.city,
      country: row.country,
      latitude: row.latitude,
      longitude: row.longitude,
      administrative: {
        countryCode: row.country_code,
        country: row.country,
        city: row.city,
        district: row.district,
        neighborhood: row.neighborhood,
        extraAddress: row.extra_address,
        postalCode: row.postal_code,
      },
      coordinate: row.latitude === null || row.longitude === null
        ? null
        : {
          latitude: row.latitude,
          longitude: row.longitude,
          accuracyMeters: row.coordinate_accuracy_meters,
          source: row.coordinate_source,
          capturedAt: row.coordinate_captured_at || row.last_updated,
        },
      placeId: row.place_id,
      lastUpdated: row.last_updated,
    },
  };
}

async function getMyProfile(userId) {
  const row = await findProfileBundleByUserId(userId);

  if (!row) {
    return null;
  }

  const expertise = await listExpertiseByProfileId(row.profile_id);
  const mapped = mapProfileRow(row);
  mapped.expertise = expertise;
  return mapped;
}

async function hasProfile(userId) {
  const profile = await findProfileByUserId(userId);
  return Boolean(profile);
}

async function ensureActiveUser(userId) {
  const user = await findActiveUserById(userId);
  if (!user) {
    const error = new Error('USER_NOT_FOUND');
    throw error;
  }
}

async function patchMyProfile(userId, data) {
  await ensureActiveUser(userId);

  const profile = await findProfileByUserId(userId);

  if (!profile) {
    await createProfileByUserId(userId, data);
  } else {
    await updateProfileByUserId(userId, data);
  }

  return getMyProfile(userId);
}

async function getProfileIdOrThrow(userId) {
  await ensureActiveUser(userId);

  const profile = await findProfileByUserId(userId);
  if (!profile) {
    const error = new Error('PROFILE_NOT_FOUND');
    throw error;
  }

  return profile.profile_id;
}

async function patchMyPhysical(userId, data, providedFields = []) {
  const profileId = await getProfileIdOrThrow(userId);
  await upsertPhysicalInfo(profileId, data, providedFields);
  return getMyProfile(userId);
}

async function patchMyHealth(userId, data, providedFields = []) {
  const profileId = await getProfileIdOrThrow(userId);
  await upsertHealthInfo(profileId, data, providedFields);
  return getMyProfile(userId);
}

async function patchMyLocation(userId, data, providedFields = []) {
  const profileId = await getProfileIdOrThrow(userId);
  await upsertLocationProfile(profileId, data, providedFields);
  return getMyProfile(userId);
}

async function patchMyPrivacy(userId, data, providedFields = []) {
  const profileId = await getProfileIdOrThrow(userId);
  await upsertPrivacySettings(profileId, data, providedFields);
  return getMyProfile(userId);
}

async function patchMyProfession(userId, data) {
  const profileId = await getProfileIdOrThrow(userId);
  await upsertProfession(profileId, data);
  return getMyProfile(userId);
}

async function patchMyExpertiseAreas(userId, data) {
  const profileId = await getProfileIdOrThrow(userId);
  await upsertExpertiseAreas(profileId, data.expertiseAreas);
  return getMyProfile(userId);
}

module.exports = {
  getMyProfile,
  hasProfile,
  patchMyProfile,
  patchMyPhysical,
  patchMyHealth,
  patchMyLocation,
  patchMyPrivacy,
  patchMyProfession,
  patchMyExpertiseAreas,
};
