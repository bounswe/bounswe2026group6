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
  appPort: readNumber(process.env.APP_PORT, 3000),
  database: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: readNumber(process.env.POSTGRES_PORT, 5432),
    database: process.env.POSTGRES_DB || 'neph_db',
    user: process.env.POSTGRES_USER || 'neph_user',
    password: process.env.POSTGRES_PASSWORD || 'neph_pass',
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
};

module.exports = {
  env,
};