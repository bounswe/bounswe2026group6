BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM users
    WHERE user_id LIKE 'demo_bogazici\_%' ESCAPE '\'
      AND email NOT LIKE '%@neph.test'
  ) THEN
    RAISE EXCEPTION 'Refusing to apply Bogazici demo seed: a demo_bogazici_* user id exists with a non-demo email';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM help_requests
    WHERE request_id LIKE 'demo_bogazici\_%' ESCAPE '\'
      AND description NOT LIKE '[DEMO]%'
  ) THEN
    RAISE EXCEPTION 'Refusing to apply Bogazici demo seed: a demo_bogazici_* help request exists without demo ownership markers';
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
VALUES
  ('demo_bogazici_requester_new_hall', 'bogazici_requester_new_hall@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE, FALSE, FALSE),
  ('demo_bogazici_requester_hisarustu', 'bogazici_requester_hisarustu@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE, FALSE, FALSE),
  ('demo_bogazici_requester_rumeli', 'bogazici_requester_rumeli@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE, FALSE, FALSE),
  ('demo_bogazici_requester_bebek', 'bogazici_requester_bebek@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE, FALSE, FALSE),
  ('demo_bogazici_requester_etiler', 'bogazici_requester_etiler@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE, FALSE, FALSE),
  ('demo_bogazici_requester_ucaksavar', 'bogazici_requester_ucaksavar@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE, FALSE, FALSE),
  ('demo_bogazici_user_reserve_1', 'bogazici_reserve_1@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE, FALSE, FALSE),
  ('demo_bogazici_user_reserve_2', 'bogazici_reserve_2@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE, FALSE, FALSE),
  ('demo_bogazici_user_reserve_3', 'bogazici_reserve_3@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE, FALSE, FALSE),
  ('demo_bogazici_user_reserve_4', 'bogazici_reserve_4@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE, FALSE, FALSE),
  ('demo_bogazici_user_assigned_1', 'bogazici_assigned_1@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE, FALSE, FALSE),
  ('demo_bogazici_user_assigned_2', 'bogazici_assigned_2@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE, FALSE, FALSE),
  ('demo_bogazici_user_outer_1', 'bogazici_outer_1@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE, FALSE, FALSE),
  ('demo_bogazici_user_outer_2', 'bogazici_outer_2@neph.test', '$2b$10$jVf8XVq2zkXAelSygXMVdO7IhqK1jjL4a4KtJw8iyttPBZLVi7USG', TRUE, TRUE, FALSE, FALSE)
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  is_email_verified = TRUE,
  accepted_terms = TRUE,
  is_deleted = FALSE,
  is_banned = FALSE,
  ban_reason = NULL,
  banned_at = NULL;

INSERT INTO user_profiles (
  profile_id,
  user_id,
  first_name,
  last_name,
  phone_number
)
VALUES
  ('demo_bogazici_profile_requester_new_hall', 'demo_bogazici_requester_new_hall', 'Selin', 'Arikan', '5328101101'),
  ('demo_bogazici_profile_requester_hisarustu', 'demo_bogazici_requester_hisarustu', 'Murat', 'Erdem', '5328101102'),
  ('demo_bogazici_profile_requester_rumeli', 'demo_bogazici_requester_rumeli', 'Nihan', 'Turan', '5328101103'),
  ('demo_bogazici_profile_requester_bebek', 'demo_bogazici_requester_bebek', 'Ozan', 'Yalcin', '5328101104'),
  ('demo_bogazici_profile_requester_etiler', 'demo_bogazici_requester_etiler', 'Aylin', 'Deniz', '5328101105'),
  ('demo_bogazici_profile_requester_ucaksavar', 'demo_bogazici_requester_ucaksavar', 'Kerem', 'Soyer', '5328101106'),
  ('demo_bogazici_profile_reserve_1', 'demo_bogazici_user_reserve_1', 'Ece', 'Kaya', '5328101201'),
  ('demo_bogazici_profile_reserve_2', 'demo_bogazici_user_reserve_2', 'Arda', 'Yildirim', '5328101202'),
  ('demo_bogazici_profile_reserve_3', 'demo_bogazici_user_reserve_3', 'Derya', 'Celik', '5328101203'),
  ('demo_bogazici_profile_reserve_4', 'demo_bogazici_user_reserve_4', 'Berk', 'Acar', '5328101204'),
  ('demo_bogazici_profile_assigned_1', 'demo_bogazici_user_assigned_1', 'Ipek', 'Ozturk', '5328101301'),
  ('demo_bogazici_profile_assigned_2', 'demo_bogazici_user_assigned_2', 'Emir', 'Polat', '5328101302'),
  ('demo_bogazici_profile_outer_1', 'demo_bogazici_user_outer_1', 'Cemre', 'Korkmaz', '5328101401'),
  ('demo_bogazici_profile_outer_2', 'demo_bogazici_user_outer_2', 'Tolga', 'Sahin', '5328101402')
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
  ('demo_bogazici_physical_requester_new_hall', 'demo_bogazici_profile_requester_new_hall', 22, DATE '2004-04-12', 'female', 166, 58),
  ('demo_bogazici_physical_requester_hisarustu', 'demo_bogazici_profile_requester_hisarustu', 41, DATE '1985-09-03', 'male', 178, 82),
  ('demo_bogazici_physical_requester_rumeli', 'demo_bogazici_profile_requester_rumeli', 34, DATE '1992-01-21', 'female', 164, 62),
  ('demo_bogazici_physical_requester_bebek', 'demo_bogazici_profile_requester_bebek', 57, DATE '1969-06-18', 'male', 173, 76),
  ('demo_bogazici_physical_requester_etiler', 'demo_bogazici_profile_requester_etiler', 68, DATE '1958-12-09', 'female', 160, 67),
  ('demo_bogazici_physical_requester_ucaksavar', 'demo_bogazici_profile_requester_ucaksavar', 29, DATE '1997-03-27', 'male', 181, 79),
  ('demo_bogazici_physical_reserve_1', 'demo_bogazici_profile_reserve_1', 31, DATE '1995-08-14', 'female', 169, 61),
  ('demo_bogazici_physical_reserve_2', 'demo_bogazici_profile_reserve_2', 35, DATE '1991-02-05', 'male', 182, 84),
  ('demo_bogazici_physical_reserve_3', 'demo_bogazici_profile_reserve_3', 28, DATE '1998-07-30', 'female', 171, 64),
  ('demo_bogazici_physical_reserve_4', 'demo_bogazici_profile_reserve_4', 39, DATE '1987-11-16', 'male', 176, 78),
  ('demo_bogazici_physical_assigned_1', 'demo_bogazici_profile_assigned_1', 33, DATE '1993-05-22', 'female', 167, 60),
  ('demo_bogazici_physical_assigned_2', 'demo_bogazici_profile_assigned_2', 44, DATE '1982-10-10', 'male', 180, 83),
  ('demo_bogazici_physical_outer_1', 'demo_bogazici_profile_outer_1', 30, DATE '1996-09-01', 'female', 165, 59),
  ('demo_bogazici_physical_outer_2', 'demo_bogazici_profile_outer_2', 46, DATE '1980-01-13', 'male', 177, 81)
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
  ('demo_bogazici_health_requester_new_hall', 'demo_bogazici_profile_requester_new_hall', ARRAY['minor cut'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'A+'),
  ('demo_bogazici_health_requester_hisarustu', 'demo_bogazici_profile_requester_hisarustu', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY['dust'], ARRAY[]::TEXT[], '0+'),
  ('demo_bogazici_health_requester_rumeli', 'demo_bogazici_profile_requester_rumeli', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'B+'),
  ('demo_bogazici_health_requester_bebek', 'demo_bogazici_profile_requester_bebek', ARRAY['diabetes'], ARRAY['type 2 diabetes'], ARRAY[]::TEXT[], ARRAY['insulin'], 'AB+'),
  ('demo_bogazici_health_requester_etiler', 'demo_bogazici_profile_requester_etiler', ARRAY['hypertension'], ARRAY['high blood pressure'], ARRAY['penicillin'], ARRAY['blood pressure medication'], 'A-'),
  ('demo_bogazici_health_requester_ucaksavar', 'demo_bogazici_profile_requester_ucaksavar', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], '0-'),
  ('demo_bogazici_health_reserve_1', 'demo_bogazici_profile_reserve_1', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'A+'),
  ('demo_bogazici_health_reserve_2', 'demo_bogazici_profile_reserve_2', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'B-'),
  ('demo_bogazici_health_reserve_3', 'demo_bogazici_profile_reserve_3', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY['pollen'], ARRAY[]::TEXT[], '0+'),
  ('demo_bogazici_health_reserve_4', 'demo_bogazici_profile_reserve_4', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'AB-'),
  ('demo_bogazici_health_assigned_1', 'demo_bogazici_profile_assigned_1', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'B+'),
  ('demo_bogazici_health_assigned_2', 'demo_bogazici_profile_assigned_2', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'A+'),
  ('demo_bogazici_health_outer_1', 'demo_bogazici_profile_outer_1', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[], '0+'),
  ('demo_bogazici_health_outer_2', 'demo_bogazici_profile_outer_2', ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY['dust'], ARRAY[]::TEXT[], 'A-')
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
  ('demo_bogazici_location_profile_requester_new_hall', 'demo_bogazici_profile_requester_new_hall', 'Bogazici University North Campus, New Hall', 'New Hall, North Campus, Bogazici University, Sariyer, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Sariyer', 'Rumeli Hisari', 'North Campus New Hall entrance', 41.08570, 29.04410, 18, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '28 minutes'),
  ('demo_bogazici_location_profile_requester_hisarustu', 'demo_bogazici_profile_requester_hisarustu', 'Hisarustu, Nispetiye Caddesi', 'Hisarustu near North Campus gate, Sariyer, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Sariyer', 'Hisarustu', 'Nispetiye Caddesi campus gate area', 41.08850, 29.04160, 22, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '24 minutes'),
  ('demo_bogazici_location_profile_requester_rumeli', 'demo_bogazici_profile_requester_rumeli', 'Rumeli Hisari, Yahya Kemal Caddesi', 'Rumeli Hisari, Yahya Kemal Caddesi, Sariyer, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Sariyer', 'Rumeli Hisari', 'Yahya Kemal Caddesi lower slope', 41.08420, 29.05670, 24, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '22 minutes'),
  ('demo_bogazici_location_profile_requester_bebek', 'demo_bogazici_profile_requester_bebek', 'Bebek, Cevdet Pasa Caddesi', 'Bebek near Cevdet Pasa Caddesi, Besiktas, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Besiktas', 'Bebek', 'Cevdet Pasa Caddesi upper side street', 41.07400, 29.04390, 25, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '20 minutes'),
  ('demo_bogazici_location_profile_requester_etiler', 'demo_bogazici_profile_requester_etiler', 'Etiler, Nispetiye Caddesi', 'Nispetiye Caddesi, Etiler, Besiktas, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Besiktas', 'Etiler', 'Nispetiye Caddesi side street', 41.07460, 29.03310, 28, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '18 minutes'),
  ('demo_bogazici_location_profile_requester_ucaksavar', 'demo_bogazici_profile_requester_ucaksavar', 'Ucaksavar Kampusu yolu', 'Ucaksavar area above Hisarustu, Besiktas, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Besiktas', 'Etiler', 'Ucaksavar campus access road', 41.09120, 29.03480, 30, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '16 minutes'),
  ('demo_bogazici_location_profile_reserve_1', 'demo_bogazici_profile_reserve_1', 'Bogazici North Campus south walkway', 'North Campus south walkway, Sariyer, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Sariyer', 'Rumeli Hisari', 'South walkway below New Hall', 41.08455, 29.04320, 14, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '6 minutes'),
  ('demo_bogazici_location_profile_reserve_2', 'demo_bogazici_profile_reserve_2', 'Bogazici North Campus library side', 'North Campus library side, Sariyer, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Sariyer', 'Rumeli Hisari', 'Library side path near New Hall', 41.08720, 29.04365, 14, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '7 minutes'),
  ('demo_bogazici_location_profile_reserve_3', 'demo_bogazici_profile_reserve_3', 'North Campus dining hall service point', 'North Campus dining hall service point, Sariyer, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Sariyer', 'Rumeli Hisari', 'Student dining hall supply point', 41.08390, 29.04190, 16, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '8 minutes'),
  ('demo_bogazici_location_profile_reserve_4', 'demo_bogazici_profile_reserve_4', 'Hisarustu upper street volunteer point', 'Hisarustu upper volunteer point, Sariyer, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Sariyer', 'Hisarustu', 'Upper Hisarustu street west of campus', 41.09020, 29.03980, 18, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '9 minutes'),
  ('demo_bogazici_location_profile_assigned_1', 'demo_bogazici_profile_assigned_1', 'New Hall triage point', 'New Hall triage point, North Campus, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Sariyer', 'Rumeli Hisari', 'New Hall triage point', 41.08585, 29.04435, 12, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '11 minutes'),
  ('demo_bogazici_location_profile_assigned_2', 'demo_bogazici_profile_assigned_2', 'Hisarustu campus gate logistics point', 'Hisarustu campus gate logistics point, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Sariyer', 'Hisarustu', 'Campus gate logistics point', 41.08850, 29.04160, 15, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '12 minutes'),
  ('demo_bogazici_location_profile_outer_1', 'demo_bogazici_profile_outer_1', 'Bebek volunteer checkpoint', 'Bebek volunteer checkpoint, Besiktas, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Besiktas', 'Bebek', 'Cevdet Pasa Caddesi volunteer checkpoint', 41.07400, 29.04390, 20, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '10 minutes'),
  ('demo_bogazici_location_profile_outer_2', 'demo_bogazici_profile_outer_2', 'Etiler Nispetiye volunteer checkpoint', 'Etiler Nispetiye volunteer checkpoint, Besiktas, Istanbul', 'Istanbul', 'Turkiye', 'TR', 'Besiktas', 'Etiler', 'Nispetiye Caddesi volunteer checkpoint', 41.07490, 29.03320, 22, 'DEMO_DEVICE_GPS', CURRENT_TIMESTAMP - INTERVAL '10 minutes')
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
  ('demo_bogazici_privacy_requester_new_hall', 'demo_bogazici_profile_requester_new_hall', 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_bogazici_privacy_requester_hisarustu', 'demo_bogazici_profile_requester_hisarustu', 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_bogazici_privacy_requester_rumeli', 'demo_bogazici_profile_requester_rumeli', 'EMERGENCY_ONLY'::visibility_level, 'PRIVATE'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_bogazici_privacy_requester_bebek', 'demo_bogazici_profile_requester_bebek', 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_bogazici_privacy_requester_etiler', 'demo_bogazici_profile_requester_etiler', 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_bogazici_privacy_requester_ucaksavar', 'demo_bogazici_profile_requester_ucaksavar', 'EMERGENCY_ONLY'::visibility_level, 'PRIVATE'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_bogazici_privacy_reserve_1', 'demo_bogazici_profile_reserve_1', 'PUBLIC'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_bogazici_privacy_reserve_2', 'demo_bogazici_profile_reserve_2', 'PUBLIC'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_bogazici_privacy_reserve_3', 'demo_bogazici_profile_reserve_3', 'PUBLIC'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_bogazici_privacy_reserve_4', 'demo_bogazici_profile_reserve_4', 'PUBLIC'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_bogazici_privacy_assigned_1', 'demo_bogazici_profile_assigned_1', 'PUBLIC'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_bogazici_privacy_assigned_2', 'demo_bogazici_profile_assigned_2', 'PUBLIC'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_bogazici_privacy_outer_1', 'demo_bogazici_profile_outer_1', 'PUBLIC'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE),
  ('demo_bogazici_privacy_outer_2', 'demo_bogazici_profile_outer_2', 'PUBLIC'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, 'EMERGENCY_ONLY'::visibility_level, TRUE)
ON CONFLICT (settings_id) DO UPDATE SET
  profile_id = EXCLUDED.profile_id,
  profile_visibility = EXCLUDED.profile_visibility,
  health_info_visibility = EXCLUDED.health_info_visibility,
  location_visibility = EXCLUDED.location_visibility,
  location_sharing_enabled = EXCLUDED.location_sharing_enabled;

INSERT INTO expertise (
  expertise_id,
  profile_id,
  profession,
  expertise_area,
  is_verified
)
VALUES
  ('demo_bogazici_expertise_reserve_1', 'demo_bogazici_profile_reserve_1', 'First aid volunteer', '["first_aid","medical_support"]', TRUE),
  ('demo_bogazici_expertise_reserve_2', 'demo_bogazici_profile_reserve_2', 'Search and rescue volunteer', '["search_rescue","structural_assessment"]', TRUE),
  ('demo_bogazici_expertise_reserve_3', 'demo_bogazici_profile_reserve_3', 'Food and water logistics volunteer', '["food_water","logistics","delivery"]', TRUE),
  ('demo_bogazici_expertise_reserve_4', 'demo_bogazici_profile_reserve_4', 'General support volunteer', '["shelter","communications","campus_support"]', TRUE),
  ('demo_bogazici_expertise_assigned_1', 'demo_bogazici_profile_assigned_1', 'Campus first aid responder', '["first_aid","medical_support"]', TRUE),
  ('demo_bogazici_expertise_assigned_2', 'demo_bogazici_profile_assigned_2', 'Campus logistics responder', '["food_water","logistics"]', TRUE),
  ('demo_bogazici_expertise_outer_1', 'demo_bogazici_profile_outer_1', 'Bebek neighborhood support volunteer', '["shelter","communications"]', TRUE),
  ('demo_bogazici_expertise_outer_2', 'demo_bogazici_profile_outer_2', 'Etiler supply runner', '["food_water","transport"]', TRUE)
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
  ('demo_bogazici_volunteer_reserve_1', 'demo_bogazici_user_reserve_1', TRUE, ARRAY['first_aid','medical_support'], ARRAY['first_aid'], 41.08455, 29.04320, CURRENT_TIMESTAMP - INTERVAL '6 minutes', CURRENT_TIMESTAMP + INTERVAL '6 hours', CURRENT_TIMESTAMP - INTERVAL '6 minutes', 14, 'DEMO_DEVICE_GPS'),
  ('demo_bogazici_volunteer_reserve_2', 'demo_bogazici_user_reserve_2', TRUE, ARRAY['search_rescue','structural_assessment'], ARRAY['search_rescue'], 41.08720, 29.04365, CURRENT_TIMESTAMP - INTERVAL '7 minutes', CURRENT_TIMESTAMP + INTERVAL '6 hours', CURRENT_TIMESTAMP - INTERVAL '7 minutes', 14, 'DEMO_DEVICE_GPS'),
  ('demo_bogazici_volunteer_reserve_3', 'demo_bogazici_user_reserve_3', TRUE, ARRAY['food_water','logistics','delivery'], ARRAY['food_water'], 41.08390, 29.04190, CURRENT_TIMESTAMP - INTERVAL '8 minutes', CURRENT_TIMESTAMP + INTERVAL '6 hours', CURRENT_TIMESTAMP - INTERVAL '8 minutes', 16, 'DEMO_DEVICE_GPS'),
  ('demo_bogazici_volunteer_reserve_4', 'demo_bogazici_user_reserve_4', TRUE, ARRAY['shelter','communications','general_support'], ARRAY['shelter','food_water'], 41.09020, 29.03980, CURRENT_TIMESTAMP - INTERVAL '9 minutes', CURRENT_TIMESTAMP + INTERVAL '6 hours', CURRENT_TIMESTAMP - INTERVAL '9 minutes', 18, 'DEMO_DEVICE_GPS'),
  ('demo_bogazici_volunteer_assigned_1', 'demo_bogazici_user_assigned_1', TRUE, ARRAY['first_aid','medical_support'], ARRAY['first_aid'], 41.08585, 29.04435, CURRENT_TIMESTAMP - INTERVAL '11 minutes', CURRENT_TIMESTAMP + INTERVAL '5 hours', CURRENT_TIMESTAMP - INTERVAL '11 minutes', 12, 'DEMO_DEVICE_GPS'),
  ('demo_bogazici_volunteer_assigned_2', 'demo_bogazici_user_assigned_2', TRUE, ARRAY['food_water','logistics'], ARRAY['food_water','shelter'], 41.08850, 29.04160, CURRENT_TIMESTAMP - INTERVAL '12 minutes', CURRENT_TIMESTAMP + INTERVAL '5 hours', CURRENT_TIMESTAMP - INTERVAL '12 minutes', 15, 'DEMO_DEVICE_GPS'),
  ('demo_bogazici_volunteer_outer_1', 'demo_bogazici_user_outer_1', TRUE, ARRAY['shelter','communications'], ARRAY['shelter'], 41.07400, 29.04390, CURRENT_TIMESTAMP - INTERVAL '10 minutes', CURRENT_TIMESTAMP + INTERVAL '5 hours', CURRENT_TIMESTAMP - INTERVAL '10 minutes', 20, 'DEMO_DEVICE_GPS'),
  ('demo_bogazici_volunteer_outer_2', 'demo_bogazici_user_outer_2', TRUE, ARRAY['food_water','transport'], ARRAY['food_water'], 41.07490, 29.03320, CURRENT_TIMESTAMP - INTERVAL '10 minutes', CURRENT_TIMESTAMP + INTERVAL '5 hours', CURRENT_TIMESTAMP - INTERVAL '10 minutes', 22, 'DEMO_DEVICE_GPS')
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
  ('demo_bogazici_availability_reserve_1', 'demo_bogazici_volunteer_reserve_1', TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '6 minutes'),
  ('demo_bogazici_availability_reserve_2', 'demo_bogazici_volunteer_reserve_2', TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '7 minutes'),
  ('demo_bogazici_availability_reserve_3', 'demo_bogazici_volunteer_reserve_3', TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '8 minutes'),
  ('demo_bogazici_availability_reserve_4', 'demo_bogazici_volunteer_reserve_4', TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '9 minutes'),
  ('demo_bogazici_availability_assigned_1', 'demo_bogazici_volunteer_assigned_1', TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '11 minutes'),
  ('demo_bogazici_availability_assigned_2', 'demo_bogazici_volunteer_assigned_2', TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '12 minutes'),
  ('demo_bogazici_availability_outer_1', 'demo_bogazici_volunteer_outer_1', TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '10 minutes'),
  ('demo_bogazici_availability_outer_2', 'demo_bogazici_volunteer_outer_2', TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '10 minutes')
ON CONFLICT (availability_id) DO UPDATE SET
  volunteer_id = EXCLUDED.volunteer_id,
  is_available = EXCLUDED.is_available,
  stored_locally = EXCLUDED.stored_locally,
  synced_at = EXCLUDED.synced_at;

INSERT INTO help_requests (
  request_id,
  user_id,
  help_types,
  other_help_text,
  affected_people_count,
  risk_flags,
  vulnerable_groups,
  need_type,
  description,
  blood_type,
  share_profile_health_info_with_volunteer,
  contact_full_name,
  contact_phone,
  contact_alternative_phone,
  consent_given,
  status,
  urgency_level,
  priority_level,
  created_at,
  resolved_at,
  cancelled_at,
  is_saved_locally
)
VALUES
  ('demo_bogazici_request_new_hall_medical', 'demo_bogazici_requester_new_hall', ARRAY['first_aid'], '', 1, ARRAY['minor_injury','bleeding'], ARRAY[]::TEXT[], 'first_aid', '[DEMO] Student near New Hall has a bleeding hand cut and needs basic first aid supplies.', 'A+', TRUE, 'Selin Arikan', 5328101101, NULL, TRUE, 'ASSIGNED'::request_status, 'HIGH', 'HIGH', CURRENT_TIMESTAMP - INTERVAL '28 minutes', NULL, NULL, FALSE),
  ('demo_bogazici_request_hisarustu_food', 'demo_bogazici_requester_hisarustu', ARRAY['food_water'], '', 4, ARRAY['children'], ARRAY['children'], 'food_water', '[DEMO] Family waiting near Hisarustu needs bottled water and ready-to-eat food packs.', NULL, FALSE, 'Murat Erdem', 5328101102, NULL, TRUE, 'ASSIGNED'::request_status, 'MEDIUM', 'MEDIUM', CURRENT_TIMESTAMP - INTERVAL '24 minutes', NULL, NULL, FALSE),
  ('demo_bogazici_request_rumeli_search', 'demo_bogazici_requester_rumeli', ARRAY['search_rescue'], '', 2, ARRAY['structural_damage','possible_entrapment'], ARRAY[]::TEXT[], 'search_rescue', '[DEMO] Rumeli Hisari resident reports a damaged stairwell and possible trapped neighbor after shaking.', NULL, FALSE, 'Nihan Turan', 5328101103, NULL, TRUE, 'PENDING'::request_status, 'HIGH', 'HIGH', CURRENT_TIMESTAMP - INTERVAL '22 minutes', NULL, NULL, FALSE),
  ('demo_bogazici_request_bebek_shelter', 'demo_bogazici_requester_bebek', ARRAY['shelter'], '', 2, ARRAY['cold_exposure'], ARRAY['elderly'], 'shelter', '[DEMO] Two residents near Bebek need a dry indoor waiting point and blankets.', NULL, FALSE, 'Ozan Yalcin', 5328101104, NULL, TRUE, 'PENDING'::request_status, 'MEDIUM', 'MEDIUM', CURRENT_TIMESTAMP - INTERVAL '20 minutes', NULL, NULL, FALSE),
  ('demo_bogazici_request_etiler_food_water', 'demo_bogazici_requester_etiler', ARRAY['food_water'], '', 3, ARRAY['elderly'], ARRAY['elderly'], 'food_water', '[DEMO] Elderly neighbors near Nispetiye need water bottles and simple food supplies.', NULL, FALSE, 'Aylin Deniz', 5328101105, NULL, TRUE, 'PENDING'::request_status, 'MEDIUM', 'MEDIUM', CURRENT_TIMESTAMP - INTERVAL '18 minutes', NULL, NULL, FALSE),
  ('demo_bogazici_request_ucaksavar_support', 'demo_bogazici_requester_ucaksavar', ARRAY['shelter'], 'Urgent campus access coordination and temporary safe waiting area.', 1, ARRAY['mobility_impairment'], ARRAY['disabled'], 'shelter', '[DEMO] Person near Ucaksavar access road needs help reaching a safer indoor waiting area.', NULL, FALSE, 'Kerem Soyer', 5328101106, NULL, TRUE, 'PENDING'::request_status, 'MEDIUM', 'MEDIUM', CURRENT_TIMESTAMP - INTERVAL '16 minutes', NULL, NULL, FALSE)
ON CONFLICT (request_id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  help_types = EXCLUDED.help_types,
  other_help_text = EXCLUDED.other_help_text,
  affected_people_count = EXCLUDED.affected_people_count,
  risk_flags = EXCLUDED.risk_flags,
  vulnerable_groups = EXCLUDED.vulnerable_groups,
  need_type = EXCLUDED.need_type,
  description = EXCLUDED.description,
  blood_type = EXCLUDED.blood_type,
  share_profile_health_info_with_volunteer = EXCLUDED.share_profile_health_info_with_volunteer,
  contact_full_name = EXCLUDED.contact_full_name,
  contact_phone = EXCLUDED.contact_phone,
  contact_alternative_phone = EXCLUDED.contact_alternative_phone,
  consent_given = EXCLUDED.consent_given,
  status = EXCLUDED.status,
  urgency_level = EXCLUDED.urgency_level,
  priority_level = EXCLUDED.priority_level,
  created_at = EXCLUDED.created_at,
  resolved_at = EXCLUDED.resolved_at,
  cancelled_at = EXCLUDED.cancelled_at,
  is_saved_locally = EXCLUDED.is_saved_locally;

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
  ('demo_bogazici_location_new_hall_medical', 'demo_bogazici_request_new_hall_medical', 'Turkiye', 'Istanbul', 'Sariyer', 'Rumeli Hisari', 'New Hall entrance, North Campus', 41.08570, 29.04410, TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '28 minutes'),
  ('demo_bogazici_location_hisarustu_food', 'demo_bogazici_request_hisarustu_food', 'Turkiye', 'Istanbul', 'Sariyer', 'Hisarustu', 'Hisarustu campus gate area, Nispetiye Caddesi', 41.08850, 29.04160, TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '24 minutes'),
  ('demo_bogazici_location_rumeli_search', 'demo_bogazici_request_rumeli_search', 'Turkiye', 'Istanbul', 'Sariyer', 'Rumeli Hisari', 'Yahya Kemal Caddesi lower slope near Rumeli Hisari', 41.08420, 29.05670, TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '22 minutes'),
  ('demo_bogazici_location_bebek_shelter', 'demo_bogazici_request_bebek_shelter', 'Turkiye', 'Istanbul', 'Besiktas', 'Bebek', 'Cevdet Pasa Caddesi upper side street', 41.07400, 29.04390, TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '20 minutes'),
  ('demo_bogazici_location_etiler_food_water', 'demo_bogazici_request_etiler_food_water', 'Turkiye', 'Istanbul', 'Besiktas', 'Etiler', 'Nispetiye Caddesi side street', 41.07460, 29.03310, TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '18 minutes'),
  ('demo_bogazici_location_ucaksavar_support', 'demo_bogazici_request_ucaksavar_support', 'Turkiye', 'Istanbul', 'Besiktas', 'Etiler', 'Ucaksavar campus access road', 41.09120, 29.03480, TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '16 minutes')
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

UPDATE assignments
SET is_cancelled = TRUE
WHERE is_cancelled = FALSE
  AND (
    (
      volunteer_id IN (
        'demo_bogazici_volunteer_reserve_1',
        'demo_bogazici_volunteer_reserve_2',
        'demo_bogazici_volunteer_reserve_3',
        'demo_bogazici_volunteer_reserve_4'
      )
      AND (
        assignment_id LIKE 'demo_bogazici\_%' ESCAPE '\'
        OR request_id LIKE 'demo_bogazici\_%' ESCAPE '\'
      )
    )
    OR (
      volunteer_id IN (
        'demo_bogazici_volunteer_assigned_1',
        'demo_bogazici_volunteer_assigned_2'
      )
      AND assignment_id LIKE 'demo_bogazici\_%' ESCAPE '\'
      AND assignment_id NOT IN (
        'demo_bogazici_assignment_new_hall_medical',
        'demo_bogazici_assignment_hisarustu_food'
      )
    )
  );

INSERT INTO assignments (
  assignment_id,
  volunteer_id,
  request_id,
  assigned_at,
  is_cancelled
)
VALUES
  ('demo_bogazici_assignment_new_hall_medical', 'demo_bogazici_volunteer_assigned_1', 'demo_bogazici_request_new_hall_medical', CURRENT_TIMESTAMP - INTERVAL '18 minutes', FALSE),
  ('demo_bogazici_assignment_hisarustu_food', 'demo_bogazici_volunteer_assigned_2', 'demo_bogazici_request_hisarustu_food', CURRENT_TIMESTAMP - INTERVAL '14 minutes', FALSE)
ON CONFLICT (volunteer_id) WHERE is_cancelled = FALSE DO UPDATE SET
  assignment_id = EXCLUDED.assignment_id,
  request_id = EXCLUDED.request_id,
  assigned_at = EXCLUDED.assigned_at,
  is_cancelled = FALSE;

COMMIT;
