BEGIN;

CREATE TABLE IF NOT EXISTS user_operational_locations (
  user_id VARCHAR(64) PRIMARY KEY,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy_meters DOUBLE PRECISION,
  source VARCHAR(100),
  captured_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_user_operational_location_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE,

  CONSTRAINT chk_user_operational_location_coordinates
    CHECK (
      latitude BETWEEN -90 AND 90
      AND longitude BETWEEN -180 AND 180
    ),

  CONSTRAINT chk_user_operational_location_accuracy
    CHECK (
      accuracy_meters IS NULL
      OR accuracy_meters >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_user_operational_locations_updated_at
  ON user_operational_locations (updated_at DESC);

COMMIT;
