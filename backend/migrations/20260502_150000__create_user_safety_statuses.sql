BEGIN;

CREATE TABLE IF NOT EXISTS user_safety_statuses (
  user_id VARCHAR(64) PRIMARY KEY,
  status VARCHAR(20) NOT NULL DEFAULT 'unknown',
  status_note VARCHAR(500),
  share_location_consent BOOLEAN NOT NULL DEFAULT FALSE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_accuracy_meters DOUBLE PRECISION,
  location_source VARCHAR(100),
  location_captured_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_user_safety_status_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE,

  CONSTRAINT chk_user_safety_status_value
    CHECK (status IN ('safe', 'not_safe', 'unknown')),

  CONSTRAINT chk_user_safety_status_coordinates
    CHECK (
      (latitude IS NULL AND longitude IS NULL)
      OR
      (
        latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND latitude BETWEEN -90 AND 90
        AND longitude BETWEEN -180 AND 180
      )
    ),

  CONSTRAINT chk_user_safety_status_accuracy
    CHECK (
      location_accuracy_meters IS NULL
      OR location_accuracy_meters >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_user_safety_statuses_status
  ON user_safety_statuses (status);

CREATE INDEX IF NOT EXISTS idx_user_safety_statuses_updated_at
  ON user_safety_statuses (updated_at DESC);

COMMIT;
