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

async function promoteUserToAdmin({ userId, role = 'COORDINATOR' }) {
  await withClient((client) =>
    client.query(
      `
        INSERT INTO admins (admin_id, user_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE
        SET role = EXCLUDED.role
      `,
      [`e2e_admin_${userId}`, userId, role]
    )
  );
}

async function seedEmergencyOverviewRecord({
  requestId = `e2e_req_${Date.now()}`,
  status = 'PENDING',
  city = 'istanbul',
  needType = 'first_aid',
  description = 'E2E seeded request',
  createdAtHoursAgo = 2,
  affectedPeopleCount = 2,
  riskFlags = ['injury'],
}) {
  return withClient(async (client) => {
    await client.query(
      `
        INSERT INTO help_requests (
          request_id,
          user_id,
          help_types,
          other_help_text,
          affected_people_count,
          risk_flags,
          vulnerable_groups,
          need_type,
          description,
          blood_type,
          contact_full_name,
          contact_phone,
          contact_alternative_phone,
          consent_given,
          status,
          created_at,
          resolved_at,
          cancelled_at,
          is_saved_locally
        )
        VALUES (
          $1,
          NULL,
          ARRAY[$6]::TEXT[],
          '',
          $4::int,
          $5::TEXT[],
          ARRAY[]::TEXT[],
          $6,
          $7,
          NULL,
          'E2E Contact',
          5551112233,
          NULL,
          TRUE,
          $2::request_status,
          NOW() - ($3 || ' hours')::interval,
          CASE
            WHEN $2 = 'RESOLVED'
              THEN (NOW() - ($3 || ' hours')::interval) + INTERVAL '10 minutes'
            ELSE NULL
          END,
          CASE
            WHEN $2 = 'CANCELLED'
              THEN (NOW() - ($3 || ' hours')::interval) + INTERVAL '7 minutes'
            ELSE NULL
          END,
          FALSE
        )
      `,
      [requestId, status, String(createdAtHoursAgo), affectedPeopleCount, riskFlags, needType, description]
    );

    await client.query(
      `
        INSERT INTO request_locations (
          location_id,
          request_id,
          country,
          city,
          district,
          neighborhood,
          extra_address
        )
        VALUES ($1, $2, 'turkiye', $3, 'besiktas', 'levazim', 'e2e')
        ON CONFLICT (request_id) DO NOTHING
      `,
      [`e2e_loc_${requestId}`, requestId, city]
    );
  });
}

module.exports = {
  findUserByEmail,
  promoteUserToAdmin,
  resetDatabase,
  seedEmergencyOverviewRecord,
  waitForUserByEmail,
};
