const path = require('path');
const { DB_CONFIG } = require('./config');

const { Client } = require(path.resolve(__dirname, '../../../backend/node_modules/pg'));

const RESET_SQL = `
  TRUNCATE TABLE
    messages,
    assignments,
    availability_records,
    resources,
    volunteers,
    request_locations,
    help_requests,
    news_announcements,
    reports,
    expertise,
    privacy_settings,
    location_profiles,
    health_info,
    physical_info,
    user_profiles,
    admins,
    users
  RESTART IDENTITY CASCADE;
`;

async function withClient(callback) {
  const client = new Client(DB_CONFIG);
  await client.connect();

  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

async function resetDatabase() {
  await withClient((client) => client.query(RESET_SQL));
}

async function findUserByEmail(email) {
  return withClient(async (client) => {
    const result = await client.query(
      `
        SELECT user_id, email, is_email_verified
        FROM users
        WHERE email = $1
      `,
      [email.trim().toLowerCase()]
    );

    return result.rows[0] || null;
  });
}

async function waitForUserByEmail(email, { timeoutMs = 10_000, intervalMs = 250 } = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const user = await findUserByEmail(email);
    if (user) {
      return user;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for user ${email}`);
}

module.exports = {
  findUserByEmail,
  resetDatabase,
  waitForUserByEmail,
};
