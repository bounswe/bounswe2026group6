BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM users
    WHERE user_id LIKE 'demo\_%' ESCAPE '\'
      AND email NOT LIKE '%@neph.test'
  ) THEN
    RAISE EXCEPTION 'Refusing to apply demo seed: a demo_* user id exists with a non-demo email';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM help_requests
    WHERE request_id LIKE 'demo\_%' ESCAPE '\'
      AND description NOT LIKE '[DEMO]%'
  ) THEN
    RAISE EXCEPTION 'Refusing to apply demo seed: a demo_* help request exists without demo ownership markers';
  END IF;
END $$;

INSERT INTO users (
  user_id,
  email,
  password_hash,
  is_email_verified,
  accepted_terms
)
VALUES
  ('demo_user_admin', 'admin_demo@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE),
  ('demo_user_requester_1', 'requester_ayse@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE),
  ('demo_user_requester_2', 'requester_mert@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE),
  ('demo_user_requester_3', 'requester_fatma@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE),
  ('demo_user_requester_4', 'requester_orhan@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE),
  ('demo_user_volunteer_1', 'volunteer_elif@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE),
  ('demo_user_volunteer_2', 'volunteer_can@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE),
  ('demo_user_volunteer_3', 'volunteer_sarp@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE),
  ('demo_user_volunteer_4', 'volunteer_zeynep@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE)
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  is_email_verified = TRUE,
  accepted_terms = TRUE;

INSERT INTO admins (admin_id, user_id, role)
VALUES ('demo_admin_ops', 'demo_user_admin', 'SUPER_ADMIN')
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
VALUES
  ('demo_profile_admin', 'demo_user_admin', 'Deniz', 'Yilmaz', '5321112233'),
  ('demo_profile_requester_1', 'demo_user_requester_1', 'Ayse', 'Kara', '5332223344'),
  ('demo_profile_requester_2', 'demo_user_requester_2', 'Mert', 'Demir', '5343334455'),
  ('demo_profile_requester_3', 'demo_user_requester_3', 'Fatma', 'Celik', '5376667788'),
  ('demo_profile_requester_4', 'demo_user_requester_4', 'Orhan', 'Yildiz', '5327778899'),
  ('demo_profile_volunteer_1', 'demo_user_volunteer_1', 'Elif', 'Aydin', '5354445566'),
  ('demo_profile_volunteer_2', 'demo_user_volunteer_2', 'Can', 'Ozturk', '5365556677'),
  ('demo_profile_volunteer_3', 'demo_user_volunteer_3', 'Sarp', 'Aksoy', '5387778899'),
  ('demo_profile_volunteer_4', 'demo_user_volunteer_4', 'Zeynep', 'Ergin', '5398889900')
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
VALUES
  ('demo_physical_admin', 'demo_profile_admin', 38, DATE '1988-03-12', 'male', 178, 76),
  ('demo_physical_requester_1', 'demo_profile_requester_1', 71, DATE '1955-09-04', 'female', 162, 68),
  ('demo_physical_requester_2', 'demo_profile_requester_2', 34, DATE '1992-01-18', 'male', 181, 82),
  ('demo_physical_requester_3', 'demo_profile_requester_3', 63, DATE '1963-05-27', 'female', 158, 64),
  ('demo_physical_requester_4', 'demo_profile_requester_4', 46, DATE '1980-10-09', 'male', 174, 78),
  ('demo_physical_volunteer_1', 'demo_profile_volunteer_1', 29, DATE '1997-06-21', 'female', 168, 61),
  ('demo_physical_volunteer_2', 'demo_profile_volunteer_2', 42, DATE '1984-11-07', 'male', 176, 79),
  ('demo_physical_volunteer_3', 'demo_profile_volunteer_3', 36, DATE '1990-08-14', 'male', 183, 84),
  ('demo_physical_volunteer_4', 'demo_profile_volunteer_4', 31, DATE '1995-12-02', 'female', 170, 63)
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
VALUES
  ('demo_health_admin', 'demo_profile_admin', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], '0+'),
  ('demo_health_requester_1', 'demo_profile_requester_1', ARRAY['hypertension'], ARRAY['high blood pressure'], ARRAY['penicillin'], ARRAY['blood pressure medication'], 'A+'),
  ('demo_health_requester_2', 'demo_profile_requester_2', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'B+'),
  ('demo_health_requester_3', 'demo_profile_requester_3', ARRAY['asthma'], ARRAY['mild asthma'], ARRAY[]::TEXT[], ARRAY['inhaler'], 'AB+'),
  ('demo_health_requester_4', 'demo_profile_requester_4', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY['bee sting'], ARRAY[]::TEXT[], '0+'),
  ('demo_health_volunteer_1', 'demo_profile_volunteer_1', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'A-'),
  ('demo_health_volunteer_2', 'demo_profile_volunteer_2', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY['dust'], ARRAY[]::TEXT[], '0-'),
  ('demo_health_volunteer_3', 'demo_profile_volunteer_3', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'B-'),
  ('demo_health_volunteer_4', 'demo_profile_volunteer_4', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'A+')
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
  display_address,
  city,
  country,
  country_code,
  district,
  neighborhood,
  extra_address,
  latitude,
  longitude,
  coordinate_accuracy_meters,
  coordinate_source,
  coordinate_captured_at
)
VALUES
  ('demo_location_profile_admin', 'demo_profile_admin', 'Levazim, Besiktas - Levazim Mahallesi, Koru Sokak No: 8', 'Levazim Mahallesi, Koru Sokak No: 8, Besiktas, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Besiktas', 'Levazim', 'Levazim Mahallesi, Koru Sokak No: 8', 41.06482, 29.00818, 25, 'DEMO_RESIDENTIAL', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
  ('demo_location_profile_requester_1', 'demo_profile_requester_1', 'Moda, Kadikoy - Caferaga Mahallesi, Moda Caddesi No: 42', 'Caferaga Mahallesi, Moda Caddesi No: 42, Kadikoy, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Kadikoy', 'Moda', 'Caferaga Mahallesi, Moda Caddesi No: 42', 40.98466, 29.02730, 20, 'DEMO_RESIDENTIAL', CURRENT_TIMESTAMP - INTERVAL '90 minutes'),
  ('demo_location_profile_requester_2', 'demo_profile_requester_2', 'Mecidiyekoy, Sisli - Mecidiyekoy Mahallesi, Buyukdere Caddesi No: 95', 'Mecidiyekoy Mahallesi, Buyukdere Caddesi No: 95, Sisli, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Sisli', 'Mecidiyekoy', 'Mecidiyekoy Mahallesi, Buyukdere Caddesi No: 95', 41.06726, 28.99042, 25, 'DEMO_RESIDENTIAL', CURRENT_TIMESTAMP - INTERVAL '85 minutes'),
  ('demo_location_profile_requester_3', 'demo_profile_requester_3', 'Kuzguncuk, Uskudar - Icadiye Caddesi No: 18', 'Icadiye Caddesi No: 18, Kuzguncuk, Uskudar, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Uskudar', 'Kuzguncuk', 'Icadiye Caddesi No: 18', 41.03710, 29.02960, 22, 'DEMO_RESIDENTIAL', CURRENT_TIMESTAMP - INTERVAL '70 minutes'),
  ('demo_location_profile_requester_4', 'demo_profile_requester_4', 'Bomonti, Sisli - Bomonti Caddesi No: 24', 'Bomonti Caddesi No: 24, Sisli, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Sisli', 'Bomonti', 'Bomonti Caddesi No: 24', 41.05820, 28.98265, 24, 'DEMO_RESIDENTIAL', CURRENT_TIMESTAMP - INTERVAL '60 minutes'),
  ('demo_location_profile_volunteer_1', 'demo_profile_volunteer_1', 'Levazim, Besiktas - Levazim Mahallesi, Barbaros Bulvari yakinlari', 'Levazim Mahallesi, Barbaros Bulvari yakinlari, Besiktas, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Besiktas', 'Levazim', 'Levazim Mahallesi, Barbaros Bulvari yakinlari', 41.06390, 29.00690, 18, 'DEMO_RESIDENTIAL', CURRENT_TIMESTAMP - INTERVAL '45 minutes'),
  ('demo_location_profile_volunteer_2', 'demo_profile_volunteer_2', 'Moda, Kadikoy - Caferaga Mahallesi, Moda Caddesi gonullu bulusma noktasi', 'Caferaga Mahallesi, Moda Caddesi gonullu bulusma noktasi, Kadikoy, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Kadikoy', 'Moda', 'Caferaga Mahallesi, Moda Caddesi gonullu bulusma noktasi', 40.98612, 29.02562, 18, 'DEMO_RESIDENTIAL', CURRENT_TIMESTAMP - INTERVAL '40 minutes'),
  ('demo_location_profile_volunteer_3', 'demo_profile_volunteer_3', 'Bomonti, Sisli - Bomonti Caddesi arama kurtarma ekibi noktasi', 'Bomonti Caddesi arama kurtarma ekibi noktasi, Sisli, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Sisli', 'Bomonti', 'Bomonti Caddesi arama kurtarma ekibi noktasi', 41.05880, 28.98190, 16, 'DEMO_RESIDENTIAL', CURRENT_TIMESTAMP - INTERVAL '35 minutes'),
  ('demo_location_profile_volunteer_4', 'demo_profile_volunteer_4', 'Kuzguncuk, Uskudar - Kuzguncuk Bostani yakinlari', 'Kuzguncuk Bostani yakinlari, Uskudar, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Uskudar', 'Kuzguncuk', 'Kuzguncuk Bostani yakinlari', 41.03630, 29.03020, 16, 'DEMO_RESIDENTIAL', CURRENT_TIMESTAMP - INTERVAL '30 minutes')
ON CONFLICT (location_profile_id) DO UPDATE SET
  profile_id = EXCLUDED.profile_id,
  address = EXCLUDED.address,
  display_address = EXCLUDED.display_address,
  city = EXCLUDED.city,
  country = EXCLUDED.country,
  country_code = EXCLUDED.country_code,
  district = EXCLUDED.district,
  neighborhood = EXCLUDED.neighborhood,
  extra_address = EXCLUDED.extra_address,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  coordinate_accuracy_meters = EXCLUDED.coordinate_accuracy_meters,
  coordinate_source = EXCLUDED.coordinate_source,
  coordinate_captured_at = EXCLUDED.coordinate_captured_at,
  last_updated = CURRENT_TIMESTAMP;

INSERT INTO privacy_settings (
  settings_id,
  profile_id,
  profile_visibility,
  health_info_visibility,
  location_visibility,
  location_sharing_enabled
)
VALUES
  ('demo_privacy_admin', 'demo_profile_admin', 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_privacy_requester_1', 'demo_profile_requester_1', 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_privacy_requester_2', 'demo_profile_requester_2', 'EMERGENCY_ONLY'::visibility_level, 'PRIVATE'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_privacy_requester_3', 'demo_profile_requester_3', 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_privacy_requester_4', 'demo_profile_requester_4', 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_privacy_volunteer_1', 'demo_profile_volunteer_1', 'PUBLIC'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_privacy_volunteer_2', 'demo_profile_volunteer_2', 'PUBLIC'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_privacy_volunteer_3', 'demo_profile_volunteer_3', 'PUBLIC'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_privacy_volunteer_4', 'demo_profile_volunteer_4', 'PUBLIC'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE)
ON CONFLICT (settings_id) DO UPDATE SET
  profile_id = EXCLUDED.profile_id,
  profile_visibility = EXCLUDED.profile_visibility,
  health_info_visibility = EXCLUDED.health_info_visibility,
  location_visibility = EXCLUDED.location_visibility,
  location_sharing_enabled = EXCLUDED.location_sharing_enabled;

INSERT INTO users (
  user_id,
  email,
  password_hash,
  is_email_verified,
  accepted_terms
)
VALUES
  ('demo_user_resident_1', 'resident_nazan@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE),
  ('demo_user_resident_2', 'resident_emre@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE),
  ('demo_user_resident_3', 'resident_selma@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE),
  ('demo_user_resident_4', 'resident_baris@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE),
  ('demo_user_resident_5', 'resident_derya@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE),
  ('demo_user_resident_6', 'resident_kerem@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE),
  ('demo_user_resident_7', 'resident_gizem@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE),
  ('demo_user_resident_8', 'resident_tolga@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE),
  ('demo_user_resident_9', 'resident_pelin@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE),
  ('demo_user_resident_10', 'resident_kaan@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE),
  ('demo_user_resident_11', 'resident_melis@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE),
  ('demo_user_resident_12', 'resident_hakan@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE),
  ('demo_user_resident_13', 'resident_asli@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE),
  ('demo_user_resident_14', 'resident_cem@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE),
  ('demo_user_resident_15', 'resident_lale@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE)
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  is_email_verified = TRUE,
  accepted_terms = TRUE;

INSERT INTO user_profiles (
  profile_id,
  user_id,
  first_name,
  last_name,
  phone_number
)
VALUES
  ('demo_profile_resident_1', 'demo_user_resident_1', 'Nazan', 'Ersoy', '5329000001'),
  ('demo_profile_resident_2', 'demo_user_resident_2', 'Emre', 'Sahin', '5329000002'),
  ('demo_profile_resident_3', 'demo_user_resident_3', 'Selma', 'Kurt', '5329000003'),
  ('demo_profile_resident_4', 'demo_user_resident_4', 'Baris', 'Arslan', '5329000004'),
  ('demo_profile_resident_5', 'demo_user_resident_5', 'Derya', 'Polat', '5329000005'),
  ('demo_profile_resident_6', 'demo_user_resident_6', 'Kerem', 'Yavuz', '5329000006'),
  ('demo_profile_resident_7', 'demo_user_resident_7', 'Gizem', 'Eren', '5329000007'),
  ('demo_profile_resident_8', 'demo_user_resident_8', 'Tolga', 'Acar', '5329000008'),
  ('demo_profile_resident_9', 'demo_user_resident_9', 'Pelin', 'Uslu', '5329000009'),
  ('demo_profile_resident_10', 'demo_user_resident_10', 'Kaan', 'Tekin', '5329000010'),
  ('demo_profile_resident_11', 'demo_user_resident_11', 'Melis', 'Koc', '5329000011'),
  ('demo_profile_resident_12', 'demo_user_resident_12', 'Hakan', 'Turan', '5329000012'),
  ('demo_profile_resident_13', 'demo_user_resident_13', 'Asli', 'Kaplan', '5329000013'),
  ('demo_profile_resident_14', 'demo_user_resident_14', 'Cem', 'Erdem', '5329000014'),
  ('demo_profile_resident_15', 'demo_user_resident_15', 'Lale', 'Ozkan', '5329000015')
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
VALUES
  ('demo_physical_resident_1', 'demo_profile_resident_1', 58, DATE '1968-04-11', 'female', 164, 70),
  ('demo_physical_resident_2', 'demo_profile_resident_2', 27, DATE '1999-07-03', 'male', 179, 74),
  ('demo_physical_resident_3', 'demo_profile_resident_3', 67, DATE '1959-02-19', 'female', 160, 66),
  ('demo_physical_resident_4', 'demo_profile_resident_4', 41, DATE '1985-06-23', 'male', 182, 86),
  ('demo_physical_resident_5', 'demo_profile_resident_5', 33, DATE '1993-01-29', 'female', 169, 62),
  ('demo_physical_resident_6', 'demo_profile_resident_6', 49, DATE '1977-09-15', 'male', 175, 80),
  ('demo_physical_resident_7', 'demo_profile_resident_7', 24, DATE '2002-12-08', 'female', 166, 58),
  ('demo_physical_resident_8', 'demo_profile_resident_8', 52, DATE '1974-03-30', 'male', 178, 83),
  ('demo_physical_resident_9', 'demo_profile_resident_9', 45, DATE '1981-08-05', 'female', 163, 65),
  ('demo_physical_resident_10', 'demo_profile_resident_10', 30, DATE '1996-11-16', 'male', 181, 77),
  ('demo_physical_resident_11', 'demo_profile_resident_11', 39, DATE '1987-05-02', 'female', 171, 64),
  ('demo_physical_resident_12', 'demo_profile_resident_12', 61, DATE '1965-10-21', 'male', 173, 81),
  ('demo_physical_resident_13', 'demo_profile_resident_13', 35, DATE '1991-02-27', 'female', 168, 60),
  ('demo_physical_resident_14', 'demo_profile_resident_14', 44, DATE '1982-07-14', 'male', 177, 79),
  ('demo_physical_resident_15', 'demo_profile_resident_15', 72, DATE '1954-01-06', 'female', 157, 63)
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
VALUES
  ('demo_health_resident_1', 'demo_profile_resident_1', ARRAY['diabetes'], ARRAY['type 2 diabetes'], ARRAY[]::TEXT[], ARRAY['metformin'], 'A+'),
  ('demo_health_resident_2', 'demo_profile_resident_2', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], '0+'),
  ('demo_health_resident_3', 'demo_profile_resident_3', ARRAY['hypertension'], ARRAY['high blood pressure'], ARRAY['penicillin'], ARRAY['blood pressure medication'], 'B+'),
  ('demo_health_resident_4', 'demo_profile_resident_4', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY['nuts'], ARRAY[]::TEXT[], 'A-'),
  ('demo_health_resident_5', 'demo_profile_resident_5', ARRAY['pregnancy'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY['prenatal vitamins'], 'AB+'),
  ('demo_health_resident_6', 'demo_profile_resident_6', ARRAY['asthma'], ARRAY['asthma'], ARRAY['dust'], ARRAY['inhaler'], '0-'),
  ('demo_health_resident_7', 'demo_profile_resident_7', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'B-'),
  ('demo_health_resident_8', 'demo_profile_resident_8', ARRAY['knee injury'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY['pain reliever'], 'A+'),
  ('demo_health_resident_9', 'demo_profile_resident_9', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY['shellfish'], ARRAY[]::TEXT[], '0+'),
  ('demo_health_resident_10', 'demo_profile_resident_10', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'B+'),
  ('demo_health_resident_11', 'demo_profile_resident_11', ARRAY['migraine'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'AB-'),
  ('demo_health_resident_12', 'demo_profile_resident_12', ARRAY['heart condition'], ARRAY['coronary artery disease'], ARRAY[]::TEXT[], ARRAY['heart medication'], 'A+'),
  ('demo_health_resident_13', 'demo_profile_resident_13', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY['latex'], ARRAY[]::TEXT[], '0+'),
  ('demo_health_resident_14', 'demo_profile_resident_14', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'B+'),
  ('demo_health_resident_15', 'demo_profile_resident_15', ARRAY['limited mobility'], ARRAY['arthritis'], ARRAY[]::TEXT[], ARRAY['arthritis medication'], 'A-')
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
  display_address,
  city,
  country,
  country_code,
  district,
  neighborhood,
  extra_address,
  latitude,
  longitude,
  coordinate_accuracy_meters,
  coordinate_source,
  coordinate_captured_at
)
VALUES
  ('demo_location_profile_resident_1', 'demo_profile_resident_1', 'Caferaga, Kadikoy - Moda Caddesi No: 12', 'Moda Caddesi No: 12, Kadikoy, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Kadikoy', 'Caferaga', 'Moda Caddesi No: 12', 40.98520, 29.02610, 24, 'DEMO_RESIDENTIAL', CURRENT_TIMESTAMP - INTERVAL '75 minutes'),
  ('demo_location_profile_resident_2', 'demo_profile_resident_2', 'Rasim Pasa, Kadikoy - Ayrilik Cesmesi Sokak No: 6', 'Ayrilik Cesmesi Sokak No: 6, Kadikoy, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Kadikoy', 'Rasim Pasa', 'Ayrilik Cesmesi Sokak No: 6', 40.99790, 29.03070, 26, 'DEMO_RESIDENTIAL', CURRENT_TIMESTAMP - INTERVAL '72 minutes'),
  ('demo_location_profile_resident_3', 'demo_profile_resident_3', 'Mecidiyekoy, Sisli - Selahattin Pinar Caddesi No: 18', 'Selahattin Pinar Caddesi No: 18, Sisli, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Sisli', 'Mecidiyekoy', 'Selahattin Pinar Caddesi No: 18', 41.06640, 28.99180, 28, 'DEMO_RESIDENTIAL', CURRENT_TIMESTAMP - INTERVAL '70 minutes'),
  ('demo_location_profile_resident_4', 'demo_profile_resident_4', 'Bomonti, Sisli - Birahane Sokak No: 9', 'Birahane Sokak No: 9, Sisli, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Sisli', 'Bomonti', 'Birahane Sokak No: 9', 41.05890, 28.98130, 24, 'DEMO_RESIDENTIAL', CURRENT_TIMESTAMP - INTERVAL '68 minutes'),
  ('demo_location_profile_resident_5', 'demo_profile_resident_5', 'Levazim, Besiktas - Koru Sokak No: 21', 'Koru Sokak No: 21, Besiktas, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Besiktas', 'Levazim', 'Koru Sokak No: 21', 41.06530, 29.00770, 22, 'DEMO_RESIDENTIAL', CURRENT_TIMESTAMP - INTERVAL '65 minutes'),
  ('demo_location_profile_resident_6', 'demo_profile_resident_6', 'Ortakoy, Besiktas - Dereboyu Caddesi No: 33', 'Dereboyu Caddesi No: 33, Besiktas, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Besiktas', 'Ortakoy', 'Dereboyu Caddesi No: 33', 41.04980, 29.02660, 30, 'DEMO_RESIDENTIAL', CURRENT_TIMESTAMP - INTERVAL '63 minutes'),
  ('demo_location_profile_resident_7', 'demo_profile_resident_7', 'Kuzguncuk, Uskudar - Bostan Sokak No: 7', 'Bostan Sokak No: 7, Uskudar, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Uskudar', 'Kuzguncuk', 'Bostan Sokak No: 7', 41.03670, 29.02920, 20, 'DEMO_RESIDENTIAL', CURRENT_TIMESTAMP - INTERVAL '60 minutes'),
  ('demo_location_profile_resident_8', 'demo_profile_resident_8', 'Selimiye, Uskudar - Tophanelioglu Caddesi No: 44', 'Tophanelioglu Caddesi No: 44, Uskudar, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Uskudar', 'Selimiye', 'Tophanelioglu Caddesi No: 44', 41.01590, 29.01820, 26, 'DEMO_RESIDENTIAL', CURRENT_TIMESTAMP - INTERVAL '58 minutes'),
  ('demo_location_profile_resident_9', 'demo_profile_resident_9', 'Goztepe, Kadikoy - Bagdat Caddesi No: 202', 'Bagdat Caddesi No: 202, Kadikoy, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Kadikoy', 'Goztepe', 'Bagdat Caddesi No: 202', 40.97190, 29.06400, 24, 'DEMO_RESIDENTIAL', CURRENT_TIMESTAMP - INTERVAL '55 minutes'),
  ('demo_location_profile_resident_10', 'demo_profile_resident_10', 'Fikirtepe, Kadikoy - Mandira Caddesi No: 15', 'Mandira Caddesi No: 15, Kadikoy, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Kadikoy', 'Fikirtepe', 'Mandira Caddesi No: 15', 40.99490, 29.05610, 30, 'DEMO_RESIDENTIAL', CURRENT_TIMESTAMP - INTERVAL '53 minutes'),
  ('demo_location_profile_resident_11', 'demo_profile_resident_11', 'Fulya, Sisli - Ortaklar Caddesi No: 10', 'Ortaklar Caddesi No: 10, Sisli, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Sisli', 'Fulya', 'Ortaklar Caddesi No: 10', 41.05960, 28.99830, 22, 'DEMO_RESIDENTIAL', CURRENT_TIMESTAMP - INTERVAL '50 minutes'),
  ('demo_location_profile_resident_12', 'demo_profile_resident_12', 'Tesvikiye, Sisli - Valikonagi Caddesi No: 55', 'Valikonagi Caddesi No: 55, Sisli, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Sisli', 'Tesvikiye', 'Valikonagi Caddesi No: 55', 41.05070, 28.99350, 25, 'DEMO_RESIDENTIAL', CURRENT_TIMESTAMP - INTERVAL '48 minutes'),
  ('demo_location_profile_resident_13', 'demo_profile_resident_13', 'Abbasaga, Besiktas - Ihlamurdere Caddesi No: 71', 'Ihlamurdere Caddesi No: 71, Besiktas, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Besiktas', 'Abbasaga', 'Ihlamurdere Caddesi No: 71', 41.04440, 29.00380, 24, 'DEMO_RESIDENTIAL', CURRENT_TIMESTAMP - INTERVAL '45 minutes'),
  ('demo_location_profile_resident_14', 'demo_profile_resident_14', 'Yildiz, Besiktas - Ciragan Caddesi No: 90', 'Ciragan Caddesi No: 90, Besiktas, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Besiktas', 'Yildiz', 'Ciragan Caddesi No: 90', 41.04530, 29.01520, 26, 'DEMO_RESIDENTIAL', CURRENT_TIMESTAMP - INTERVAL '43 minutes'),
  ('demo_location_profile_resident_15', 'demo_profile_resident_15', 'Beylerbeyi, Uskudar - Abdullahaga Caddesi No: 28', 'Abdullahaga Caddesi No: 28, Uskudar, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Uskudar', 'Beylerbeyi', 'Abdullahaga Caddesi No: 28', 41.04210, 29.04420, 24, 'DEMO_RESIDENTIAL', CURRENT_TIMESTAMP - INTERVAL '40 minutes')
ON CONFLICT (location_profile_id) DO UPDATE SET
  profile_id = EXCLUDED.profile_id,
  address = EXCLUDED.address,
  display_address = EXCLUDED.display_address,
  city = EXCLUDED.city,
  country = EXCLUDED.country,
  country_code = EXCLUDED.country_code,
  district = EXCLUDED.district,
  neighborhood = EXCLUDED.neighborhood,
  extra_address = EXCLUDED.extra_address,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  coordinate_accuracy_meters = EXCLUDED.coordinate_accuracy_meters,
  coordinate_source = EXCLUDED.coordinate_source,
  coordinate_captured_at = EXCLUDED.coordinate_captured_at,
  last_updated = CURRENT_TIMESTAMP;

INSERT INTO privacy_settings (
  settings_id,
  profile_id,
  profile_visibility,
  health_info_visibility,
  location_visibility,
  location_sharing_enabled
)
VALUES
  ('demo_privacy_resident_1', 'demo_profile_resident_1', 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_privacy_resident_2', 'demo_profile_resident_2', 'PUBLIC'::visibility_level, 'PRIVATE'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_privacy_resident_3', 'demo_profile_resident_3', 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_privacy_resident_4', 'demo_profile_resident_4', 'PUBLIC'::visibility_level, 'PRIVATE'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, FALSE),
  ('demo_privacy_resident_5', 'demo_profile_resident_5', 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_privacy_resident_6', 'demo_profile_resident_6', 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_privacy_resident_7', 'demo_profile_resident_7', 'PUBLIC'::visibility_level, 'PRIVATE'::visibility_level, 'PRIVATE'::visibility_level, FALSE),
  ('demo_privacy_resident_8', 'demo_profile_resident_8', 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_privacy_resident_9', 'demo_profile_resident_9', 'EMERGENCY_ONLY'::visibility_level, 'PRIVATE'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_privacy_resident_10', 'demo_profile_resident_10', 'PUBLIC'::visibility_level, 'PRIVATE'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_privacy_resident_11', 'demo_profile_resident_11', 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_privacy_resident_12', 'demo_profile_resident_12', 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_privacy_resident_13', 'demo_profile_resident_13', 'PUBLIC'::visibility_level, 'PRIVATE'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_privacy_resident_14', 'demo_profile_resident_14', 'EMERGENCY_ONLY'::visibility_level, 'PRIVATE'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, FALSE),
  ('demo_privacy_resident_15', 'demo_profile_resident_15', 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE)
ON CONFLICT (settings_id) DO UPDATE SET
  profile_id = EXCLUDED.profile_id,
  profile_visibility = EXCLUDED.profile_visibility,
  health_info_visibility = EXCLUDED.health_info_visibility,
  location_visibility = EXCLUDED.location_visibility,
  location_sharing_enabled = EXCLUDED.location_sharing_enabled;

INSERT INTO user_operational_locations (
  user_id,
  latitude,
  longitude,
  accuracy_meters,
  source,
  captured_at,
  updated_at
)
VALUES
  ('demo_user_resident_1', 40.98520, 29.02610, 24, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '75 minutes', CURRENT_TIMESTAMP - INTERVAL '75 minutes'),
  ('demo_user_resident_2', 40.99790, 29.03070, 26, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '72 minutes', CURRENT_TIMESTAMP - INTERVAL '72 minutes'),
  ('demo_user_resident_3', 41.06640, 28.99180, 28, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '70 minutes', CURRENT_TIMESTAMP - INTERVAL '70 minutes'),
  ('demo_user_resident_4', 41.05890, 28.98130, 24, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '68 minutes', CURRENT_TIMESTAMP - INTERVAL '68 minutes'),
  ('demo_user_resident_5', 41.06530, 29.00770, 22, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '65 minutes', CURRENT_TIMESTAMP - INTERVAL '65 minutes'),
  ('demo_user_resident_6', 41.04980, 29.02660, 30, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '63 minutes', CURRENT_TIMESTAMP - INTERVAL '63 minutes'),
  ('demo_user_resident_7', 41.03670, 29.02920, 20, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '60 minutes', CURRENT_TIMESTAMP - INTERVAL '60 minutes'),
  ('demo_user_resident_8', 41.01590, 29.01820, 26, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '58 minutes', CURRENT_TIMESTAMP - INTERVAL '58 minutes'),
  ('demo_user_resident_9', 40.97190, 29.06400, 24, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '55 minutes', CURRENT_TIMESTAMP - INTERVAL '55 minutes'),
  ('demo_user_resident_10', 40.99490, 29.05610, 30, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '53 minutes', CURRENT_TIMESTAMP - INTERVAL '53 minutes'),
  ('demo_user_resident_11', 41.05960, 28.99830, 22, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '50 minutes', CURRENT_TIMESTAMP - INTERVAL '50 minutes'),
  ('demo_user_resident_12', 41.05070, 28.99350, 25, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '48 minutes', CURRENT_TIMESTAMP - INTERVAL '48 minutes'),
  ('demo_user_resident_13', 41.04440, 29.00380, 24, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '45 minutes', CURRENT_TIMESTAMP - INTERVAL '45 minutes'),
  ('demo_user_resident_14', 41.04530, 29.01520, 26, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '43 minutes', CURRENT_TIMESTAMP - INTERVAL '43 minutes'),
  ('demo_user_resident_15', 41.04210, 29.04420, 24, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '40 minutes', CURRENT_TIMESTAMP - INTERVAL '40 minutes')
ON CONFLICT (user_id) DO UPDATE SET
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  accuracy_meters = EXCLUDED.accuracy_meters,
  source = EXCLUDED.source,
  captured_at = EXCLUDED.captured_at,
  updated_at = EXCLUDED.updated_at;

INSERT INTO user_safety_statuses (
  user_id,
  status,
  status_note,
  share_location_consent,
  latitude,
  longitude,
  location_accuracy_meters,
  location_source,
  location_captured_at,
  updated_at
)
VALUES
  ('demo_user_resident_1', 'unknown', '[DEMO] Checking on elderly neighbors in Caferaga.', TRUE, 40.98520, 29.02610, 24, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '75 minutes', CURRENT_TIMESTAMP - INTERVAL '75 minutes'),
  ('demo_user_resident_2', 'safe', '[DEMO] Safe and able to share updates near Ayrilik Cesmesi.', TRUE, 40.99790, 29.03070, 26, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '72 minutes', CURRENT_TIMESTAMP - INTERVAL '72 minutes'),
  ('demo_user_resident_3', 'not_safe', '[DEMO] Needs a medication refill near Mecidiyekoy.', TRUE, 41.06640, 28.99180, 28, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '70 minutes', CURRENT_TIMESTAMP - INTERVAL '70 minutes'),
  ('demo_user_resident_4', 'safe', '[DEMO] Safe but reports broken glass near Bomonti.', FALSE, 41.05890, 28.98130, 24, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '68 minutes', CURRENT_TIMESTAMP - INTERVAL '68 minutes'),
  ('demo_user_resident_5', 'unknown', '[DEMO] Family gathering point not confirmed yet in Levazim.', TRUE, 41.06530, 29.00770, 22, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '65 minutes', CURRENT_TIMESTAMP - INTERVAL '65 minutes'),
  ('demo_user_resident_6', 'safe', '[DEMO] Safe in Ortakoy and can relay neighborhood needs.', TRUE, 41.04980, 29.02660, 30, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '63 minutes', CURRENT_TIMESTAMP - INTERVAL '63 minutes'),
  ('demo_user_resident_7', 'safe', '[DEMO] Safe near Kuzguncuk Bostani.', FALSE, 41.03670, 29.02920, 20, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '60 minutes', CURRENT_TIMESTAMP - INTERVAL '60 minutes'),
  ('demo_user_resident_8', 'unknown', '[DEMO] Waiting for family confirmation near Selimiye.', TRUE, 41.01590, 29.01820, 26, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '58 minutes', CURRENT_TIMESTAMP - INTERVAL '58 minutes'),
  ('demo_user_resident_9', 'safe', '[DEMO] Safe in Goztepe and has bottled water.', TRUE, 40.97190, 29.06400, 24, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '55 minutes', CURRENT_TIMESTAMP - INTERVAL '55 minutes'),
  ('demo_user_resident_10', 'unknown', '[DEMO] Reports crowded streets near Fikirtepe.', TRUE, 40.99490, 29.05610, 30, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '53 minutes', CURRENT_TIMESTAMP - INTERVAL '53 minutes'),
  ('demo_user_resident_11', 'safe', '[DEMO] Safe near Fulya and can host a phone charging point.', TRUE, 41.05960, 28.99830, 22, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '50 minutes', CURRENT_TIMESTAMP - INTERVAL '50 minutes'),
  ('demo_user_resident_12', 'not_safe', '[DEMO] Needs heart medication support in Tesvikiye.', TRUE, 41.05070, 28.99350, 25, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '48 minutes', CURRENT_TIMESTAMP - INTERVAL '48 minutes'),
  ('demo_user_resident_13', 'safe', '[DEMO] Safe near Abbasaga park.', TRUE, 41.04440, 29.00380, 24, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '45 minutes', CURRENT_TIMESTAMP - INTERVAL '45 minutes'),
  ('demo_user_resident_14', 'unknown', '[DEMO] Phone battery low near Yildiz.', FALSE, 41.04530, 29.01520, 26, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '43 minutes', CURRENT_TIMESTAMP - INTERVAL '43 minutes'),
  ('demo_user_resident_15', 'not_safe', '[DEMO] Limited mobility resident needs check-in near Beylerbeyi.', TRUE, 41.04210, 29.04420, 24, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '40 minutes', CURRENT_TIMESTAMP - INTERVAL '40 minutes')
ON CONFLICT (user_id) DO UPDATE SET
  status = EXCLUDED.status,
  status_note = EXCLUDED.status_note,
  share_location_consent = EXCLUDED.share_location_consent,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  location_accuracy_meters = EXCLUDED.location_accuracy_meters,
  location_source = EXCLUDED.location_source,
  location_captured_at = EXCLUDED.location_captured_at,
  updated_at = EXCLUDED.updated_at;

INSERT INTO expertise (
  expertise_id,
  profile_id,
  profession,
  expertise_area,
  is_verified
)
VALUES
  ('demo_expertise_volunteer_1', 'demo_profile_volunteer_1', 'Paramedic volunteer', '["first_aid","medical_support"]', TRUE),
  ('demo_expertise_volunteer_2', 'demo_profile_volunteer_2', 'Logistics volunteer', '["food","water","mobility_support"]', TRUE),
  ('demo_expertise_volunteer_3', 'demo_profile_volunteer_3', 'Search and rescue volunteer', '["search_rescue","structural_assessment"]', TRUE),
  ('demo_expertise_volunteer_4', 'demo_profile_volunteer_4', 'Shelter coordinator', '["shelter","logistics","translation"]', TRUE),
  ('demo_expertise_resident_volunteer_2', 'demo_profile_resident_2', 'Neighborhood runner', '["food","water","delivery"]', TRUE),
  ('demo_expertise_resident_volunteer_4', 'demo_profile_resident_4', 'Building safety volunteer', '["structural_assessment","fire_safety"]', TRUE),
  ('demo_expertise_resident_volunteer_6', 'demo_profile_resident_6', 'Driver volunteer', '["transport","mobility_support"]', TRUE),
  ('demo_expertise_resident_volunteer_8', 'demo_profile_resident_8', 'First aid volunteer', '["first_aid","elderly_support"]', TRUE),
  ('demo_expertise_resident_volunteer_10', 'demo_profile_resident_10', 'Communications volunteer', '["communications","translation","logistics"]', TRUE)
ON CONFLICT (expertise_id) DO UPDATE SET
  profile_id = EXCLUDED.profile_id,
  profession = EXCLUDED.profession,
  expertise_area = EXCLUDED.expertise_area,
  is_verified = EXCLUDED.is_verified;

INSERT INTO volunteers (
  volunteer_id,
  user_id,
  is_available,
  skills,
  need_types,
  last_known_latitude,
  last_known_longitude,
  location_updated_at,
  available_until,
  availability_confirmed_at,
  last_location_accuracy_meters,
  last_location_source
)
VALUES
  ('demo_volunteer_elif', 'demo_user_volunteer_1', TRUE, ARRAY['first_aid','medical_support'], ARRAY['medical','mobility'], 41.06390, 29.00690, CURRENT_TIMESTAMP - INTERVAL '12 minutes', CURRENT_TIMESTAMP + INTERVAL '6 hours', CURRENT_TIMESTAMP - INTERVAL '12 minutes', 18, 'DEMO_DEVICE_GPS'),
  ('demo_volunteer_can', 'demo_user_volunteer_2', TRUE, ARRAY['supplies','mobility_support'], ARRAY['food','water','mobility'], 40.98612, 29.02562, CURRENT_TIMESTAMP - INTERVAL '8 minutes', CURRENT_TIMESTAMP + INTERVAL '6 hours', CURRENT_TIMESTAMP - INTERVAL '8 minutes', 18, 'DEMO_DEVICE_GPS'),
  ('demo_volunteer_sarp', 'demo_user_volunteer_3', TRUE, ARRAY['search_rescue','structural_assessment'], ARRAY['search_rescue'], 41.05880, 28.98190, CURRENT_TIMESTAMP - INTERVAL '10 minutes', CURRENT_TIMESTAMP + INTERVAL '6 hours', CURRENT_TIMESTAMP - INTERVAL '10 minutes', 16, 'DEMO_DEVICE_GPS'),
  ('demo_volunteer_zeynep', 'demo_user_volunteer_4', TRUE, ARRAY['shelter','logistics','translation'], ARRAY['shelter','food','water'], 41.03630, 29.03020, CURRENT_TIMESTAMP - INTERVAL '6 minutes', CURRENT_TIMESTAMP + INTERVAL '6 hours', CURRENT_TIMESTAMP - INTERVAL '6 minutes', 16, 'DEMO_DEVICE_GPS'),
  ('demo_volunteer_resident_emre', 'demo_user_resident_2', TRUE, ARRAY['delivery','food','water'], ARRAY['food','water'], 40.99790, 29.03070, CURRENT_TIMESTAMP - INTERVAL '11 minutes', CURRENT_TIMESTAMP + INTERVAL '5 hours', CURRENT_TIMESTAMP - INTERVAL '11 minutes', 26, 'DEMO_DEVICE_GPS'),
  ('demo_volunteer_resident_baris', 'demo_user_resident_4', TRUE, ARRAY['structural_assessment','fire_safety'], ARRAY['search_rescue','other'], 41.05890, 28.98130, CURRENT_TIMESTAMP - INTERVAL '18 minutes', CURRENT_TIMESTAMP + INTERVAL '5 hours', CURRENT_TIMESTAMP - INTERVAL '18 minutes', 24, 'DEMO_DEVICE_GPS'),
  ('demo_volunteer_resident_kerem', 'demo_user_resident_6', TRUE, ARRAY['transport','mobility_support'], ARRAY['mobility','medical'], 41.04980, 29.02660, CURRENT_TIMESTAMP - INTERVAL '14 minutes', CURRENT_TIMESTAMP + INTERVAL '5 hours', CURRENT_TIMESTAMP - INTERVAL '14 minutes', 30, 'DEMO_DEVICE_GPS'),
  ('demo_volunteer_resident_tolga', 'demo_user_resident_8', TRUE, ARRAY['first_aid','elderly_support'], ARRAY['medical','shelter'], 41.01590, 29.01820, CURRENT_TIMESTAMP - INTERVAL '16 minutes', CURRENT_TIMESTAMP + INTERVAL '5 hours', CURRENT_TIMESTAMP - INTERVAL '16 minutes', 26, 'DEMO_DEVICE_GPS'),
  ('demo_volunteer_resident_kaan', 'demo_user_resident_10', TRUE, ARRAY['communications','translation','logistics'], ARRAY['other','shelter'], 40.99490, 29.05610, CURRENT_TIMESTAMP - INTERVAL '13 minutes', CURRENT_TIMESTAMP + INTERVAL '5 hours', CURRENT_TIMESTAMP - INTERVAL '13 minutes', 30, 'DEMO_DEVICE_GPS')
ON CONFLICT (volunteer_id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  is_available = EXCLUDED.is_available,
  skills = EXCLUDED.skills,
  need_types = EXCLUDED.need_types,
  last_known_latitude = EXCLUDED.last_known_latitude,
  last_known_longitude = EXCLUDED.last_known_longitude,
  location_updated_at = EXCLUDED.location_updated_at,
  available_until = EXCLUDED.available_until,
  availability_confirmed_at = EXCLUDED.availability_confirmed_at,
  last_location_accuracy_meters = EXCLUDED.last_location_accuracy_meters,
  last_location_source = EXCLUDED.last_location_source;

INSERT INTO availability_records (
  availability_id,
  volunteer_id,
  is_available,
  stored_locally,
  synced_at
)
VALUES
  ('demo_availability_elif_available', 'demo_volunteer_elif', TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '12 minutes'),
  ('demo_availability_can_available', 'demo_volunteer_can', TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '8 minutes'),
  ('demo_availability_sarp_available', 'demo_volunteer_sarp', TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '10 minutes'),
  ('demo_availability_zeynep_available', 'demo_volunteer_zeynep', TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '6 minutes'),
  ('demo_availability_emre_available', 'demo_volunteer_resident_emre', TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '11 minutes'),
  ('demo_availability_baris_available', 'demo_volunteer_resident_baris', TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '18 minutes'),
  ('demo_availability_kerem_available', 'demo_volunteer_resident_kerem', TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '14 minutes'),
  ('demo_availability_tolga_available', 'demo_volunteer_resident_tolga', TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '16 minutes'),
  ('demo_availability_kaan_available', 'demo_volunteer_resident_kaan', TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '13 minutes')
ON CONFLICT (availability_id) DO UPDATE SET
  volunteer_id = EXCLUDED.volunteer_id,
  is_available = EXCLUDED.is_available,
  stored_locally = EXCLUDED.stored_locally,
  synced_at = EXCLUDED.synced_at;

INSERT INTO user_operational_locations (
  user_id,
  latitude,
  longitude,
  accuracy_meters,
  source,
  captured_at,
  updated_at
)
VALUES
  ('demo_user_requester_1', 40.98466, 29.02730, 20, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '45 minutes', CURRENT_TIMESTAMP - INTERVAL '45 minutes'),
  ('demo_user_requester_2', 41.06726, 28.99042, 25, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '30 minutes', CURRENT_TIMESTAMP - INTERVAL '30 minutes'),
  ('demo_user_requester_3', 41.03710, 29.02960, 22, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '25 minutes', CURRENT_TIMESTAMP - INTERVAL '25 minutes'),
  ('demo_user_requester_4', 41.05820, 28.98265, 24, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '20 minutes', CURRENT_TIMESTAMP - INTERVAL '20 minutes'),
  ('demo_user_volunteer_1', 41.06390, 29.00690, 18, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '12 minutes', CURRENT_TIMESTAMP - INTERVAL '12 minutes'),
  ('demo_user_volunteer_2', 40.98612, 29.02562, 18, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '8 minutes', CURRENT_TIMESTAMP - INTERVAL '8 minutes'),
  ('demo_user_volunteer_3', 41.05880, 28.98190, 16, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '10 minutes', CURRENT_TIMESTAMP - INTERVAL '10 minutes'),
  ('demo_user_volunteer_4', 41.03630, 29.03020, 16, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '6 minutes', CURRENT_TIMESTAMP - INTERVAL '6 minutes')
ON CONFLICT (user_id) DO UPDATE SET
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  accuracy_meters = EXCLUDED.accuracy_meters,
  source = EXCLUDED.source,
  captured_at = EXCLUDED.captured_at,
  updated_at = EXCLUDED.updated_at;

INSERT INTO user_safety_statuses (
  user_id,
  status,
  status_note,
  share_location_consent,
  latitude,
  longitude,
  location_accuracy_meters,
  location_source,
  location_captured_at,
  updated_at
)
VALUES
  ('demo_user_requester_1', 'not_safe', '[DEMO] Needs medication assistance at home.', TRUE, 40.98466, 29.02730, 20, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '45 minutes', CURRENT_TIMESTAMP - INTERVAL '45 minutes'),
  ('demo_user_requester_2', 'unknown', '[DEMO] Family needs supply support; status not confirmed yet.', TRUE, 41.06726, 28.99042, 25, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '30 minutes', CURRENT_TIMESTAMP - INTERVAL '30 minutes'),
  ('demo_user_requester_3', 'not_safe', '[DEMO] Needs temporary shelter and warm clothing near Kuzguncuk.', TRUE, 41.03710, 29.02960, 22, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '25 minutes', CURRENT_TIMESTAMP - INTERVAL '25 minutes'),
  ('demo_user_requester_4', 'unknown', '[DEMO] Reports stairwell damage near Bomonti and is waiting for search and rescue guidance.', TRUE, 41.05820, 28.98265, 24, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '20 minutes', CURRENT_TIMESTAMP - INTERVAL '20 minutes'),
  ('demo_user_volunteer_1', 'safe', '[DEMO] Available near Levazim with first-aid kit.', TRUE, 41.06390, 29.00690, 18, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '12 minutes', CURRENT_TIMESTAMP - INTERVAL '12 minutes'),
  ('demo_user_volunteer_2', 'safe', '[DEMO] Available near Moda with water and food supplies.', TRUE, 40.98612, 29.02562, 18, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '8 minutes', CURRENT_TIMESTAMP - INTERVAL '8 minutes'),
  ('demo_user_volunteer_3', 'safe', '[DEMO] Available near Bomonti for search and rescue support.', TRUE, 41.05880, 28.98190, 16, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '10 minutes', CURRENT_TIMESTAMP - INTERVAL '10 minutes'),
  ('demo_user_volunteer_4', 'safe', '[DEMO] Available near Kuzguncuk for shelter coordination.', TRUE, 41.03630, 29.03020, 16, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '6 minutes', CURRENT_TIMESTAMP - INTERVAL '6 minutes')
ON CONFLICT (user_id) DO UPDATE SET
  status = EXCLUDED.status,
  status_note = EXCLUDED.status_note,
  share_location_consent = EXCLUDED.share_location_consent,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  location_accuracy_meters = EXCLUDED.location_accuracy_meters,
  location_source = EXCLUDED.location_source,
  location_captured_at = EXCLUDED.location_captured_at,
  updated_at = EXCLUDED.updated_at;

INSERT INTO safety_circles (
  circle_id,
  owner_user_id,
  name,
  created_at,
  updated_at
)
VALUES
  ('demo_circle_kadikoy_neighbors', 'demo_user_requester_1', 'Kadikoy Neighbors Demo Circle', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days')
ON CONFLICT (circle_id) DO UPDATE SET
  owner_user_id = EXCLUDED.owner_user_id,
  name = EXCLUDED.name,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO safety_circle_members (
  circle_id,
  user_id,
  role,
  joined_at
)
VALUES
  ('demo_circle_kadikoy_neighbors', 'demo_user_requester_1', 'owner', CURRENT_TIMESTAMP - INTERVAL '2 days'),
  ('demo_circle_kadikoy_neighbors', 'demo_user_volunteer_2', 'member', CURRENT_TIMESTAMP - INTERVAL '1 day'),
  ('demo_circle_kadikoy_neighbors', 'demo_user_volunteer_4', 'member', CURRENT_TIMESTAMP - INTERVAL '18 hours')
ON CONFLICT (circle_id, user_id) DO UPDATE SET
  role = EXCLUDED.role,
  joined_at = EXCLUDED.joined_at;

INSERT INTO help_requests (
  request_id,
  user_id,
  help_types,
  affected_people_count,
  risk_flags,
  vulnerable_groups,
  need_type,
  description,
  blood_type,
  contact_full_name,
  contact_phone,
  consent_given,
  status,
  urgency_level,
  priority_level,
  created_at,
  resolved_at,
  cancelled_at
)
VALUES
  ('demo_request_active_medical', 'demo_user_requester_1', ARRAY['medical'], 1, ARRAY['elderly','urgent_medication'], ARRAY['elderly'], 'medical', '[DEMO] Elderly resident needs urgent blood pressure medication and a basic health check.', 'A+', 'Ayse Kara', 5332223344, TRUE, 'PENDING'::request_status, 'HIGH', 'HIGH', CURRENT_TIMESTAMP - INTERVAL '45 minutes', NULL, NULL),
  ('demo_request_assigned_food_water', 'demo_user_requester_2', ARRAY['food','water'], 4, ARRAY['children'], ARRAY['children'], 'food/water', '[DEMO] Family of four needs drinking water and ready-to-eat food supplies.', NULL, 'Mert Demir', 5343334455, TRUE, 'ASSIGNED'::request_status, 'MEDIUM', 'MEDIUM', CURRENT_TIMESTAMP - INTERVAL '1 hour', NULL, NULL),
  ('demo_request_active_search_rescue', 'demo_user_requester_4', ARRAY['search_rescue'], 2, ARRAY['injury','structural_damage'], ARRAY[]::TEXT[], 'search_rescue', '[DEMO] Residents report a damaged stairwell and possible trapped neighbor near an apartment entrance.', NULL, 'Orhan Yildiz', 5327778899, TRUE, 'PENDING'::request_status, 'HIGH', 'HIGH', CURRENT_TIMESTAMP - INTERVAL '30 minutes', NULL, NULL),
  ('demo_request_active_shelter', 'demo_user_requester_3', ARRAY['shelter'], 2, ARRAY['elderly','cold_exposure'], ARRAY['elderly'], 'shelter', '[DEMO] Two residents need a temporary indoor shelter and warm blankets near Kuzguncuk.', NULL, 'Fatma Celik', 5376667788, TRUE, 'PENDING'::request_status, 'MEDIUM', 'MEDIUM', CURRENT_TIMESTAMP - INTERVAL '25 minutes', NULL, NULL),
  ('demo_request_resolved_mobility', 'demo_user_requester_1', ARRAY['mobility'], 1, ARRAY['mobility_impairment'], ARRAY['disabled'], 'mobility', '[DEMO] Wheelchair user needed help reaching a temporary gathering area.', NULL, 'Ayse Kara', 5332223344, TRUE, 'RESOLVED'::request_status, 'LOW', 'LOW', CURRENT_TIMESTAMP - INTERVAL '3 hours', CURRENT_TIMESTAMP - INTERVAL '2 hours', NULL),
  ('demo_request_cancelled_checkin', 'demo_user_requester_2', ARRAY['other'], 1, ARRAY['duplicate_report'], ARRAY[]::TEXT[], 'other', '[DEMO] Duplicate neighborhood check-in request cancelled after phone confirmation.', NULL, 'Mert Demir', 5343334455, TRUE, 'CANCELLED'::request_status, 'LOW', 'LOW', CURRENT_TIMESTAMP - INTERVAL '5 hours', NULL, CURRENT_TIMESTAMP - INTERVAL '4 hours 30 minutes'),
  ('demo_request_resident_medication', 'demo_user_resident_3', ARRAY['medical'], 1, ARRAY['elderly','medication'], ARRAY['elderly'], 'medical', '[DEMO] Resident needs hypertension medication pickup near Mecidiyekoy.', 'B+', 'Selma Kurt', 5329000003, TRUE, 'PENDING'::request_status, 'HIGH', 'HIGH', CURRENT_TIMESTAMP - INTERVAL '38 minutes', NULL, NULL),
  ('demo_request_resident_supplies', 'demo_user_resident_1', ARRAY['food','water'], 2, ARRAY['elderly'], ARRAY['elderly'], 'food/water', '[DEMO] Two neighbors need bottled water and simple food supplies near Caferaga.', NULL, 'Nazan Ersoy', 5329000001, TRUE, 'ASSIGNED'::request_status, 'MEDIUM', 'MEDIUM', CURRENT_TIMESTAMP - INTERVAL '52 minutes', NULL, NULL),
  ('demo_request_resident_shelter_in_progress', 'demo_user_resident_5', ARRAY['shelter'], 3, ARRAY['pregnancy','cold_exposure'], ARRAY['pregnant'], 'shelter', '[DEMO] Small family needs temporary indoor shelter near Levazim.', NULL, 'Derya Polat', 5329000005, TRUE, 'IN_PROGRESS'::request_status, 'HIGH', 'HIGH', CURRENT_TIMESTAMP - INTERVAL '1 hour 20 minutes', NULL, NULL),
  ('demo_request_resident_heart_medication', 'demo_user_resident_12', ARRAY['medical','mobility'], 1, ARRAY['heart_condition','limited_mobility'], ARRAY['elderly'], 'medical', '[DEMO] Resident with heart condition needs medication support and mobility assistance.', 'A+', 'Hakan Turan', 5329000012, TRUE, 'PENDING'::request_status, 'HIGH', 'HIGH', CURRENT_TIMESTAMP - INTERVAL '18 minutes', NULL, NULL),
  ('demo_request_resident_mobility_resolved', 'demo_user_resident_15', ARRAY['mobility'], 1, ARRAY['limited_mobility'], ARRAY['elderly','disabled'], 'mobility', '[DEMO] Limited mobility resident was escorted to a safer indoor waiting point.', NULL, 'Lale Ozkan', 5329000015, TRUE, 'RESOLVED'::request_status, 'LOW', 'LOW', CURRENT_TIMESTAMP - INTERVAL '6 hours', CURRENT_TIMESTAMP - INTERVAL '5 hours 15 minutes', NULL)
ON CONFLICT (request_id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  help_types = EXCLUDED.help_types,
  affected_people_count = EXCLUDED.affected_people_count,
  risk_flags = EXCLUDED.risk_flags,
  vulnerable_groups = EXCLUDED.vulnerable_groups,
  need_type = EXCLUDED.need_type,
  description = EXCLUDED.description,
  blood_type = EXCLUDED.blood_type,
  contact_full_name = EXCLUDED.contact_full_name,
  contact_phone = EXCLUDED.contact_phone,
  consent_given = EXCLUDED.consent_given,
  status = EXCLUDED.status,
  urgency_level = EXCLUDED.urgency_level,
  priority_level = EXCLUDED.priority_level,
  created_at = EXCLUDED.created_at,
  resolved_at = EXCLUDED.resolved_at,
  cancelled_at = EXCLUDED.cancelled_at;

INSERT INTO request_locations (
  location_id,
  request_id,
  country,
  city,
  district,
  neighborhood,
  extra_address,
  latitude,
  longitude,
  is_gps_location,
  is_last_known,
  captured_at
)
VALUES
  ('demo_location_request_active_medical', 'demo_request_active_medical', 'Turkiye', 'Istanbul', 'Kadikoy', 'Moda', 'Caferaga Mahallesi, Moda Caddesi No: 42', 40.98466, 29.02730, TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '45 minutes'),
  ('demo_location_request_assigned_food', 'demo_request_assigned_food_water', 'Turkiye', 'Istanbul', 'Sisli', 'Mecidiyekoy', 'Mecidiyekoy Meydani yakinlari', 41.06726, 28.99042, TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '1 hour'),
  ('demo_location_request_search_rescue', 'demo_request_active_search_rescue', 'Turkiye', 'Istanbul', 'Sisli', 'Mecidiyekoy', 'Mecidiyekoy Mahallesi, Buyukdere Caddesi yakinindaki yan sokak', 41.06810, 28.99115, TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '30 minutes'),
  ('demo_location_request_active_shelter', 'demo_request_active_shelter', 'Turkiye', 'Istanbul', 'Uskudar', 'Kuzguncuk', 'Icadiye Caddesi ve Kuzguncuk Bostani yakinlari', 41.03710, 29.02960, TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '25 minutes'),
  ('demo_location_request_resolved_mobility', 'demo_request_resolved_mobility', 'Turkiye', 'Istanbul', 'Besiktas', 'Levazim', 'Levazim Mahallesi, Nispetiye Caddesi cikisi', 41.06482, 29.00818, TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '3 hours'),
  ('demo_location_request_cancelled_checkin', 'demo_request_cancelled_checkin', 'Turkiye', 'Istanbul', 'Sisli', 'Mecidiyekoy', 'Mecidiyekoy Mahallesi, Buyukdere Caddesi kontrol noktasi', 41.06680, 28.99100, TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '5 hours'),
  ('demo_location_request_resident_medication', 'demo_request_resident_medication', 'Turkiye', 'Istanbul', 'Sisli', 'Mecidiyekoy', 'Selahattin Pinar Caddesi No: 18', 41.06640, 28.99180, TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '38 minutes'),
  ('demo_location_request_resident_supplies', 'demo_request_resident_supplies', 'Turkiye', 'Istanbul', 'Kadikoy', 'Caferaga', 'Moda Caddesi No: 12', 40.98520, 29.02610, TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '52 minutes'),
  ('demo_location_request_resident_shelter', 'demo_request_resident_shelter_in_progress', 'Turkiye', 'Istanbul', 'Besiktas', 'Levazim', 'Koru Sokak No: 21', 41.06530, 29.00770, TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '1 hour 20 minutes'),
  ('demo_location_request_resident_heart', 'demo_request_resident_heart_medication', 'Turkiye', 'Istanbul', 'Sisli', 'Tesvikiye', 'Valikonagi Caddesi No: 55', 41.05070, 28.99350, TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '18 minutes'),
  ('demo_location_request_resident_mobility_resolved', 'demo_request_resident_mobility_resolved', 'Turkiye', 'Istanbul', 'Uskudar', 'Beylerbeyi', 'Abdullahaga Caddesi No: 28', 41.04210, 29.04420, TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '6 hours')
ON CONFLICT (location_id) DO UPDATE SET
  request_id = EXCLUDED.request_id,
  country = EXCLUDED.country,
  city = EXCLUDED.city,
  district = EXCLUDED.district,
  neighborhood = EXCLUDED.neighborhood,
  extra_address = EXCLUDED.extra_address,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  is_gps_location = EXCLUDED.is_gps_location,
  is_last_known = EXCLUDED.is_last_known,
  captured_at = EXCLUDED.captured_at;

INSERT INTO assignments (
  assignment_id,
  volunteer_id,
  request_id,
  assigned_at,
  is_cancelled
)
VALUES
  ('demo_assignment_food_water_can', 'demo_volunteer_can', 'demo_request_assigned_food_water', CURRENT_TIMESTAMP - INTERVAL '20 minutes', FALSE),
  ('demo_assignment_resident_supplies_emre', 'demo_volunteer_resident_emre', 'demo_request_resident_supplies', CURRENT_TIMESTAMP - INTERVAL '25 minutes', FALSE),
  ('demo_assignment_resident_shelter_tolga', 'demo_volunteer_resident_tolga', 'demo_request_resident_shelter_in_progress', CURRENT_TIMESTAMP - INTERVAL '40 minutes', FALSE)
ON CONFLICT (assignment_id) DO UPDATE SET
  volunteer_id = EXCLUDED.volunteer_id,
  request_id = EXCLUDED.request_id,
  assigned_at = EXCLUDED.assigned_at,
  is_cancelled = EXCLUDED.is_cancelled;

INSERT INTO news_announcements (
  announcement_id,
  admin_id,
  title,
  content,
  created_at
)
VALUES
  ('demo_announcement_water_kadikoy', 'demo_admin_ops', 'Water distribution in Kadikoy', '[DEMO] Bottled water distribution is available near Moda Caddesi between 10:00 and 18:00 today.', CURRENT_TIMESTAMP - INTERVAL '35 minutes'),
  ('demo_announcement_gathering_besiktas', 'demo_admin_ops', 'Temporary gathering area in Besiktas', '[DEMO] A temporary gathering area is active at Levazim neighborhood park with basic first-aid support.', CURRENT_TIMESTAMP - INTERVAL '50 minutes'),
  ('demo_announcement_shelter_uskudar', 'demo_admin_ops', 'Shelter support in Uskudar', '[DEMO] A community shelter desk is active near Kuzguncuk for residents who need blankets and indoor waiting space.', CURRENT_TIMESTAMP - INTERVAL '25 minutes')
ON CONFLICT (announcement_id) DO UPDATE SET
  admin_id = EXCLUDED.admin_id,
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  created_at = EXCLUDED.created_at;

INSERT INTO notifications (
  notification_id,
  recipient_user_id,
  actor_user_id,
  type,
  title,
  body,
  entity_type,
  entity_id,
  payload,
  is_read,
  read_at,
  created_at,
  updated_at
)
VALUES
  ('demo_notification_assignment_can', 'demo_user_volunteer_2', 'demo_user_admin', 'TASK_ASSIGNED', 'New supply delivery assigned', '[DEMO] You have been assigned to the food and water request in Mecidiyekoy.', 'HELP_REQUEST', 'demo_request_assigned_food_water', '{"screen":"assignment","requestId":"demo_request_assigned_food_water"}'::jsonb, FALSE, NULL, CURRENT_TIMESTAMP - INTERVAL '20 minutes', CURRENT_TIMESTAMP - INTERVAL '20 minutes'),
  ('demo_notification_status_ayse', 'demo_user_requester_1', 'demo_user_admin', 'HELP_REQUEST_STATUS_CHANGED', 'Mobility request resolved', '[DEMO] Your mobility support request has been marked as resolved.', 'HELP_REQUEST', 'demo_request_resolved_mobility', '{"screen":"helpRequestDetails","requestId":"demo_request_resolved_mobility"}'::jsonb, TRUE, CURRENT_TIMESTAMP - INTERVAL '1 hour 55 minutes', CURRENT_TIMESTAMP - INTERVAL '2 hours', CURRENT_TIMESTAMP - INTERVAL '1 hour 55 minutes'),
  ('demo_notification_shelter_fatma', 'demo_user_requester_3', 'demo_user_admin', 'HELP_REQUEST_STATUS_CHANGED', 'Shelter request received', '[DEMO] Your temporary shelter request is visible to nearby volunteers.', 'HELP_REQUEST', 'demo_request_active_shelter', '{"screen":"helpRequestDetails","requestId":"demo_request_active_shelter"}'::jsonb, FALSE, NULL, CURRENT_TIMESTAMP - INTERVAL '24 minutes', CURRENT_TIMESTAMP - INTERVAL '24 minutes')
ON CONFLICT (notification_id) DO UPDATE SET
  recipient_user_id = EXCLUDED.recipient_user_id,
  actor_user_id = EXCLUDED.actor_user_id,
  type = EXCLUDED.type,
  title = EXCLUDED.title,
  body = EXCLUDED.body,
  entity_type = EXCLUDED.entity_type,
  entity_id = EXCLUDED.entity_id,
  payload = EXCLUDED.payload,
  is_read = EXCLUDED.is_read,
  read_at = EXCLUDED.read_at,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;

COMMIT;
