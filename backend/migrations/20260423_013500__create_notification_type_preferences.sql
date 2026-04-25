BEGIN;

CREATE TABLE IF NOT EXISTS notification_type_preferences (
  user_id VARCHAR(64) NOT NULL,
  notification_type VARCHAR(100) NOT NULL,
  push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (user_id, notification_type),

  CONSTRAINT fk_notification_type_preferences_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_type_preferences_user
  ON notification_type_preferences (user_id);

COMMIT;
