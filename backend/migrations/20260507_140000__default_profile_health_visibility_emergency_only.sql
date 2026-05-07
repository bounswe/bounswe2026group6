ALTER TABLE privacy_settings
  ALTER COLUMN profile_visibility SET DEFAULT 'EMERGENCY_ONLY',
  ALTER COLUMN health_info_visibility SET DEFAULT 'EMERGENCY_ONLY';
