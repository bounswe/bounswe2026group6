const path = require('path');

const { pool } = require('../src/db/pool');
const { backendMigrationSource, runMigrations } = require('./apply-migrations');

function demoMigrationSource() {
  return {
    dir: path.resolve(__dirname, '../demo-migrations'),
    keyPrefix: 'backend/demo-migrations',
  };
}

async function run() {
  if (process.env.ENABLE_DEMO_SEED !== 'true') {
    throw new Error('Refusing to apply demo seed data without ENABLE_DEMO_SEED=true');
  }

  await runMigrations([
    backendMigrationSource(),
    demoMigrationSource(),
  ]);
}

run()
  .catch((error) => {
    console.error('Demo migration step failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
