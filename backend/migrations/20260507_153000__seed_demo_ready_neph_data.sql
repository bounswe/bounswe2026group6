BEGIN;

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
  ('demo_expertise_volunteer_3', 'demo_profile_volunteer_3', 'Search and rescue volunteer', '["search_and_rescue","structural_assessment"]', TRUE),
  ('demo_expertise_volunteer_4', 'demo_profile_volunteer_4', 'Shelter coordinator', '["shelter","logistics","translation"]', TRUE)
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
  ('demo_volunteer_sarp', 'demo_user_volunteer_3', TRUE, ARRAY['search_and_rescue','structural_assessment'], ARRAY['search_and_rescue'], 41.05880, 28.98190, CURRENT_TIMESTAMP - INTERVAL '10 minutes', CURRENT_TIMESTAMP + INTERVAL '6 hours', CURRENT_TIMESTAMP - INTERVAL '10 minutes', 16, 'DEMO_DEVICE_GPS'),
  ('demo_volunteer_zeynep', 'demo_user_volunteer_4', TRUE, ARRAY['shelter','logistics','translation'], ARRAY['shelter','food','water'], 41.03630, 29.03020, CURRENT_TIMESTAMP - INTERVAL '6 minutes', CURRENT_TIMESTAMP + INTERVAL '6 hours', CURRENT_TIMESTAMP - INTERVAL '6 minutes', 16, 'DEMO_DEVICE_GPS')
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
  ('demo_availability_zeynep_available', 'demo_volunteer_zeynep', TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '6 minutes')
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
  resolved_at
)
VALUES
  ('demo_request_active_medical', 'demo_user_requester_1', ARRAY['medical'], 1, ARRAY['elderly','urgent_medication'], ARRAY['elderly'], 'medical', '[DEMO] Elderly resident needs urgent blood pressure medication and a basic health check.', 'A+', 'Ayse Kara', 5332223344, TRUE, 'PENDING'::request_status, 'HIGH', 'HIGH', CURRENT_TIMESTAMP - INTERVAL '45 minutes', NULL),
  ('demo_request_assigned_food_water', 'demo_user_requester_2', ARRAY['food','water'], 4, ARRAY['children'], ARRAY['children'], 'food/water', '[DEMO] Family of four needs drinking water and ready-to-eat food supplies.', NULL, 'Mert Demir', 5343334455, TRUE, 'ASSIGNED'::request_status, 'MEDIUM', 'MEDIUM', CURRENT_TIMESTAMP - INTERVAL '1 hour', NULL),
  ('demo_request_active_search_rescue', 'demo_user_requester_2', ARRAY['search_and_rescue'], 2, ARRAY['injury','structural_damage'], ARRAY[]::TEXT[], 'search_and_rescue', '[DEMO] Residents report a damaged stairwell and possible trapped neighbor near an apartment entrance.', NULL, 'Mert Demir', 5343334455, TRUE, 'PENDING'::request_status, 'HIGH', 'HIGH', CURRENT_TIMESTAMP - INTERVAL '30 minutes', NULL),
  ('demo_request_active_shelter', 'demo_user_requester_3', ARRAY['shelter'], 2, ARRAY['elderly','cold_exposure'], ARRAY['elderly'], 'shelter', '[DEMO] Two residents need a temporary indoor shelter and warm blankets near Kuzguncuk.', NULL, 'Fatma Celik', 5376667788, TRUE, 'PENDING'::request_status, 'MEDIUM', 'MEDIUM', CURRENT_TIMESTAMP - INTERVAL '25 minutes', NULL),
  ('demo_request_resolved_mobility', 'demo_user_requester_1', ARRAY['mobility'], 1, ARRAY['mobility_impairment'], ARRAY['disabled'], 'mobility', '[DEMO] Wheelchair user needed help reaching a temporary gathering area.', NULL, 'Ayse Kara', 5332223344, TRUE, 'RESOLVED'::request_status, 'LOW', 'LOW', CURRENT_TIMESTAMP - INTERVAL '3 hours', CURRENT_TIMESTAMP - INTERVAL '2 hours')
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
  resolved_at = EXCLUDED.resolved_at;

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
  ('demo_location_request_resolved_mobility', 'demo_request_resolved_mobility', 'Turkiye', 'Istanbul', 'Besiktas', 'Levazim', 'Levazim Mahallesi, Nispetiye Caddesi cikisi', 41.06482, 29.00818, TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '3 hours')
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
  ('demo_assignment_food_water_can', 'demo_volunteer_can', 'demo_request_assigned_food_water', CURRENT_TIMESTAMP - INTERVAL '20 minutes', FALSE)
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
