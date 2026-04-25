BEGIN;

CREATE TABLE IF NOT EXISTS notifications (
  notification_id VARCHAR(64) PRIMARY KEY,
  recipient_user_id VARCHAR(64) NOT NULL,
  actor_user_id VARCHAR(64),
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  entity_type VARCHAR(100),
  entity_id VARCHAR(128),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_notifications_recipient
    FOREIGN KEY (recipient_user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_notifications_actor
    FOREIGN KEY (actor_user_id)
    REFERENCES users(user_id)
    ON DELETE SET NULL,

  CONSTRAINT chk_notifications_read_fields
    CHECK (
      (is_read = FALSE AND read_at IS NULL)
      OR (is_read = TRUE)
    )
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created_at
  ON notifications (recipient_user_id, created_at DESC, notification_id DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_is_read
  ON notifications (recipient_user_id, is_read);

COMMIT;
