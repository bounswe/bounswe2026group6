const { pool, query } = require('../src/db/pool');
const { env } = require('../src/config/env');

async function run() {
  const retentionDays = Number(env.notifications.retentionDays) > 0
    ? Number(env.notifications.retentionDays)
    : 90;

  const result = await query(
    `
      DELETE FROM notifications
      WHERE created_at < CURRENT_TIMESTAMP - ($1::int * INTERVAL '1 day')
    `,
    [retentionDays],
  );

  console.log(`Cleanup complete. Deleted notifications: ${result.rowCount}`);
}

run()
  .catch((error) => {
    console.error('Notification cleanup failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
