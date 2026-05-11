ALTER TABLE help_requests
  ADD COLUMN IF NOT EXISTS share_profile_health_info_with_volunteer BOOLEAN NOT NULL DEFAULT FALSE;
