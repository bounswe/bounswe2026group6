BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM users
    WHERE user_id = 'demo_bogazici_admin_ops'
      AND email <> 'bogazici_admin@neph.test'
  ) THEN
    RAISE EXCEPTION 'Refusing to apply Bogazici demo admin seed: demo_bogazici_admin_ops exists with a non-demo email';
  END IF;
END $$;

INSERT INTO users (
  user_id,
  email,
  password_hash,
  is_email_verified,
  accepted_terms,
  is_deleted,
  is_banned
)
VALUES (
  'demo_bogazici_admin_ops',
  'bogazici_admin@neph.test',
  '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG',
  TRUE,
  TRUE,
  FALSE,
  FALSE
)
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  is_email_verified = TRUE,
  accepted_terms = TRUE,
  is_deleted = FALSE,
  is_banned = FALSE,
  ban_reason = NULL,
  banned_at = NULL;

INSERT INTO admins (
  admin_id,
  user_id,
  role
)
VALUES (
  'demo_bogazici_admin_ops',
  'demo_bogazici_admin_ops',
  'SUPER_ADMIN'
)
ON CONFLICT (admin_id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  role = EXCLUDED.role;

INSERT INTO user_profiles (
  profile_id,
  user_id,
  first_name,
  last_name,
  phone_number
)
VALUES (
  'demo_bogazici_profile_admin_ops',
  'demo_bogazici_admin_ops',
  'Deniz',
  'Yilmaz',
  '5328101000'
)
ON CONFLICT (profile_id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone_number = EXCLUDED.phone_number;

INSERT INTO physical_info (
  physical_id,
  profile_id,
  age,
  date_of_birth,
  gender,
  height,
  weight
)
VALUES (
  'demo_bogazici_physical_admin_ops',
  'demo_bogazici_profile_admin_ops',
  36,
  DATE '1990-02-17',
  'non_binary',
  172,
  70
)
ON CONFLICT (physical_id) DO UPDATE SET
  profile_id = EXCLUDED.profile_id,
  age = EXCLUDED.age,
  date_of_birth = EXCLUDED.date_of_birth,
  gender = EXCLUDED.gender,
  height = EXCLUDED.height,
  weight = EXCLUDED.weight;

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
  'demo_bogazici_health_admin_ops',
  'demo_bogazici_profile_admin_ops',
  ARRAY[]::TEXT[],
  ARRAY[]::TEXT[],
  ARRAY[]::TEXT[],
  ARRAY[]::TEXT[],
  '0Rh+'
)
ON CONFLICT (health_id) DO UPDATE SET
  profile_id = EXCLUDED.profile_id,
  medical_conditions = EXCLUDED.medical_conditions,
  chronic_diseases = EXCLUDED.chronic_diseases,
  allergies = EXCLUDED.allergies,
  medications = EXCLUDED.medications,
  blood_type = EXCLUDED.blood_type;

INSERT INTO location_profiles (
  location_profile_id,
  profile_id,
  address,
  city,
  country,
  latitude,
  longitude
)
VALUES (
  'demo_bogazici_location_profile_admin_ops',
  'demo_bogazici_profile_admin_ops',
  'Bogazici University Kandilli Campus Operations Desk',
  'Istanbul',
  'Turkey',
  41.06270,
  29.05940
)
ON CONFLICT (location_profile_id) DO UPDATE SET
  profile_id = EXCLUDED.profile_id,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  country = EXCLUDED.country,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  last_updated = CURRENT_TIMESTAMP;

INSERT INTO privacy_settings (
  settings_id,
  profile_id,
  profile_visibility,
  health_info_visibility,
  location_visibility,
  location_sharing_enabled
)
VALUES (
  'demo_bogazici_privacy_admin_ops',
  'demo_bogazici_profile_admin_ops',
  'PUBLIC'::visibility_level,
  'PRIVATE'::visibility_level,
  'EMERGENCY_ONLY'::visibility_level,
  TRUE
)
ON CONFLICT (settings_id) DO UPDATE SET
  profile_id = EXCLUDED.profile_id,
  profile_visibility = EXCLUDED.profile_visibility,
  health_info_visibility = EXCLUDED.health_info_visibility,
  location_visibility = EXCLUDED.location_visibility,
  location_sharing_enabled = EXCLUDED.location_sharing_enabled;

COMMIT;
