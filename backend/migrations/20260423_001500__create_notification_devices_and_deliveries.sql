BEGIN;

CREATE TABLE IF NOT EXISTS notification_devices (
  device_id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  platform VARCHAR(20) NOT NULL,
  provider VARCHAR(20) NOT NULL DEFAULT 'FCM',
  device_token VARCHAR(512) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_notification_devices_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE,

  CONSTRAINT uq_notification_devices_provider_token
    UNIQUE (provider, device_token)
);

CREATE INDEX IF NOT EXISTS idx_notification_devices_user_active
  ON notification_devices (user_id, is_active);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  delivery_id VARCHAR(64) PRIMARY KEY,
  notification_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  channel VARCHAR(20) NOT NULL,
  provider VARCHAR(20),
  platform VARCHAR(20),
  device_token VARCHAR(512),
  status VARCHAR(20) NOT NULL,
  error_message TEXT,
  delivered_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_notification_deliveries_notification
    FOREIGN KEY (notification_id)
    REFERENCES notifications(notification_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_notification_deliveries_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_notification
  ON notification_deliveries (notification_id);

COMMIT;
