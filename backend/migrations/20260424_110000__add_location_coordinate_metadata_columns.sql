BEGIN;

ALTER TABLE location_profiles
  ADD COLUMN IF NOT EXISTS coordinate_accuracy_meters DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS coordinate_source VARCHAR(100),
  ADD COLUMN IF NOT EXISTS coordinate_captured_at TIMESTAMP;

ALTER TABLE location_profiles
  DROP CONSTRAINT IF EXISTS chk_location_profile_coordinate_accuracy;

ALTER TABLE location_profiles
  ADD CONSTRAINT chk_location_profile_coordinate_accuracy
  CHECK (
    coordinate_accuracy_meters IS NULL
    OR coordinate_accuracy_meters >= 0
  );

COMMIT;
