BEGIN;

ALTER TABLE location_profiles
  ADD COLUMN IF NOT EXISTS display_address VARCHAR(500),
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS district VARCHAR(100),
  ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(100),
  ADD COLUMN IF NOT EXISTS extra_address VARCHAR(500),
  ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS place_id VARCHAR(255);

UPDATE location_profiles
SET display_address = COALESCE(display_address, address)
WHERE display_address IS NULL;

COMMIT;
