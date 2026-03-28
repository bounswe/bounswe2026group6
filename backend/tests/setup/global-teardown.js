'use strict';

module.exports = async function globalTeardown() {
  try {
    const { pool } = require('../../src/db/pool');
    await pool.end();
  } catch (_error) {
    // Pool may not be initialized in some test runs.
  }
};
