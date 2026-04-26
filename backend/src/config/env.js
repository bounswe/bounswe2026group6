const path = require('path');

const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function readNumber(value, fallback) {
  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  appPort: readNumber(process.env.APP_PORT || process.env.PORT, 3000),
  database: {
    url: process.env.DATABASE_URL || '',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: readNumber(process.env.POSTGRES_PORT, 5432),
    database: process.env.POSTGRES_DB || 'neph_db',
    user: process.env.POSTGRES_USER || 'neph_user',
    password: process.env.POSTGRES_PASSWORD || 'neph_pass',
    ssl: (process.env.DB_SSL || 'false').toLowerCase() === 'true',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-123',
  },
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: readNumber(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  push: {
    deliveryMode: (process.env.PUSH_DELIVERY_MODE || 'log').toLowerCase(), // log | disabled | fcm
    firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'secrets/firebase-service-account.json',
  },
  notifications: {
    retentionDays: readNumber(process.env.NOTIFICATION_RETENTION_DAYS, 90),
    jobsEnabled: (process.env.NOTIFICATION_JOBS_ENABLED || 'false').toLowerCase() === 'true',
    jobIntervalMs: readNumber(process.env.NOTIFICATION_JOB_INTERVAL_MS, 5 * 60 * 1000),
    jobBatchSize: readNumber(process.env.NOTIFICATION_JOB_BATCH_SIZE, 100),
    availabilityReminderMinutes: readNumber(process.env.NOTIFICATION_AVAILABILITY_REMINDER_MINUTES, 120),
    availabilityReminderCooldownMinutes: readNumber(
      process.env.NOTIFICATION_AVAILABILITY_REMINDER_COOLDOWN_MINUTES,
      180,
    ),
    pendingRequestTtlHours: readNumber(process.env.NOTIFICATION_PENDING_REQUEST_TTL_HOURS, 72),
  },
  helpRequests: {
    guestCreateEnabled: (process.env.HELP_REQUEST_GUEST_CREATE_ENABLED || 'true').toLowerCase() === 'true',
    guestMatchingEnabled: (process.env.HELP_REQUEST_GUEST_MATCHING_ENABLED || 'false').toLowerCase() === 'true',
    guestTokenTtl: process.env.HELP_REQUEST_GUEST_TOKEN_TTL || '2h',
  },
};

module.exports = {
  env,
};
