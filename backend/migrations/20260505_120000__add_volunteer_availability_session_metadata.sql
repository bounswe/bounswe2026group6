BEGIN;

ALTER TABLE volunteers
  ADD COLUMN IF NOT EXISTS available_until TIMESTAMP,
  ADD COLUMN IF NOT EXISTS availability_confirmed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_location_accuracy_meters DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_location_source VARCHAR(100);

ALTER TABLE volunteers
  ADD CONSTRAINT chk_volunteer_last_location_accuracy
  CHECK (
    last_location_accuracy_meters IS NULL
    OR last_location_accuracy_meters >= 0
  )
  NOT VALID;

ALTER TABLE volunteers
  VALIDATE CONSTRAINT chk_volunteer_last_location_accuracy;

CREATE INDEX IF NOT EXISTS idx_volunteers_matching_availability_session
  ON volunteers (is_available, available_until, location_updated_at);

COMMIT;
