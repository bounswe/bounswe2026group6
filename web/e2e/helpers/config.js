const path = require('path');

function readNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const E2E_HOST = process.env.E2E_HOST || '127.0.0.1';
const E2E_BACKEND_PORT = readNumber(process.env.E2E_BACKEND_PORT, 3100);
const E2E_WEB_PORT = readNumber(process.env.E2E_WEB_PORT, 3101);
const BACKEND_URL = `http://${E2E_HOST}:${E2E_BACKEND_PORT}`;
const BASE_URL = `http://${E2E_HOST}:${E2E_WEB_PORT}`;
const API_BASE_URL = `${BACKEND_URL}/api`;
const TEST_RESULTS_DIR = path.resolve(__dirname, '../../test-results');
const SERVER_STATE_PATH = path.join(TEST_RESULTS_DIR, 'e2e-runtime.json');

function applyDefaultTestEnv() {
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-secret';
  process.env.TEST_POSTGRES_HOST = process.env.TEST_POSTGRES_HOST || process.env.POSTGRES_HOST || '127.0.0.1';
  process.env.TEST_POSTGRES_PORT = process.env.TEST_POSTGRES_PORT || process.env.POSTGRES_PORT || '5432';
  process.env.TEST_POSTGRES_USER = process.env.TEST_POSTGRES_USER || process.env.POSTGRES_USER || 'neph_user';
  process.env.TEST_POSTGRES_PASSWORD = process.env.TEST_POSTGRES_PASSWORD || process.env.POSTGRES_PASSWORD || 'neph_pass';
  process.env.TEST_POSTGRES_DB = process.env.TEST_POSTGRES_DB || process.env.POSTGRES_DB || 'neph_e2e_db';
}

applyDefaultTestEnv();

const DB_CONFIG = {
  host: process.env.TEST_POSTGRES_HOST,
  port: readNumber(process.env.TEST_POSTGRES_PORT, 5432),
  user: process.env.TEST_POSTGRES_USER,
  password: process.env.TEST_POSTGRES_PASSWORD,
  database: process.env.TEST_POSTGRES_DB,
};

module.exports = {
  API_BASE_URL,
  BACKEND_URL,
  BASE_URL,
  DB_CONFIG,
  E2E_BACKEND_PORT,
  E2E_HOST,
  E2E_WEB_PORT,
  JWT_SECRET: process.env.JWT_SECRET,
  SERVER_STATE_PATH,
  TEST_RESULTS_DIR,
  applyDefaultTestEnv,
};
