'use strict';

function useTestEnv(name, fallback) {
  const testName = `TEST_${name}`;
  process.env[name] = process.env[testName] || process.env[name] || fallback;
}

process.env.NODE_ENV = 'test';
useTestEnv('POSTGRES_HOST', 'localhost');
useTestEnv('POSTGRES_PORT', '5432');
useTestEnv('POSTGRES_DB', 'neph_test_db');
useTestEnv('POSTGRES_USER', 'neph_user');
useTestEnv('POSTGRES_PASSWORD', 'neph_pass');

afterAll(async () => {
  try {
    const { pool } = require('../../src/db/pool');
    await pool.end();
  } catch (_error) {
    // Pool may not be initialized in isolated runs.
  }
});
