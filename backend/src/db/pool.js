const { Pool } = require('pg');

const { env } = require('../config/env');

const poolConfig = env.database.url
  ? {
      connectionString: env.database.url,
      ssl: env.database.ssl ? { rejectUnauthorized: false } : undefined,
    }
  : {
      host: env.database.host,
      port: env.database.port,
      database: env.database.database,
      user: env.database.user,
      password: env.database.password,
      ssl: env.database.ssl ? { rejectUnauthorized: false } : undefined,
    };

const pool = new Pool(poolConfig);

async function query(text, params = []) {
  return pool.query(text, params);
}

module.exports = {
  pool,
  query,
};
