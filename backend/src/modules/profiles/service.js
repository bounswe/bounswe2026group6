const { findProfileBundleByUserId } = require('./repository');

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
      city: row.city,
      country: row.country,
      latitude: row.latitude,
      longitude: row.longitude,
      lastUpdated: row.last_updated,
    },
  };
}

async function getMyProfile(userId) {
  const row = await findProfileBundleByUserId(userId);

  if (!row) {
    return null;
  }

  return mapProfileRow(row);
}

module.exports = {
  getMyProfile,
};
