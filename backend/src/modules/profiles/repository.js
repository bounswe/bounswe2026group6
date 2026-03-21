const { query } = require('../../db/pool');

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
      lp.city,
      lp.country,
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
  findProfileBundleByUserId,
};
