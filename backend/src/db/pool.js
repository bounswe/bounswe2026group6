const { Pool, types } = require('pg');

const { env } = require('../config/env');

const POSTGRES_TIMESTAMP_OID = 1114;

// The app stores API timestamps as UTC ISO strings in PostgreSQL TIMESTAMP
// columns. node-postgres parses TIMESTAMP WITHOUT TIME ZONE as local time by
// default, which shifts values by the server timezone (for example +03:00 in
// Istanbul). Preserve the database wall-clock value as UTC when hydrating rows.
types.setTypeParser(POSTGRES_TIMESTAMP_OID, (value) => new Date(`${value.replace(' ', 'T')}Z`));

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
