const { query } = require('../../db/pool');

async function findUserByEmail(email) {
  const result = await query(
    `
      SELECT
        user_id,
        email,
        password_hash,
        is_email_verified,
        created_at,
        is_deleted,
        accepted_terms
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email]
  );

  return result.rows[0] || null;
}

async function findUserById(userId) {
  const result = await query(
    `
      SELECT
        user_id,
        email,
        password_hash,
        is_email_verified,
        created_at,
        is_deleted,
        accepted_terms
      FROM users
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function createUser({ userId, email, passwordHash, acceptedTerms }) {
  const result = await query(
    `
      INSERT INTO users (
        user_id,
        email,
        password_hash,
        accepted_terms
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        user_id,
        email,
        is_email_verified,
        created_at,
        accepted_terms
    `,
    [userId, email, passwordHash, acceptedTerms]
  );

  return result.rows[0];
}

async function markEmailVerified(userId) {
  const result = await query(
    `UPDATE users SET is_email_verified = TRUE
     WHERE user_id = $1 AND is_email_verified = FALSE
     RETURNING user_id, email, is_email_verified`,
    [userId]
  );

  if (!result.rows[0]) {
    const error = new Error('Invalid verification token');
    error.code = 'INVALID_VERIFICATION_TOKEN';
    throw error;
  }

  return result.rows[0];
}

async function updateUserPassword(userId, passwordHash) {
  const result = await query(
    `UPDATE users
     SET password_hash = $2
     WHERE user_id = $1 AND is_deleted = FALSE
     RETURNING user_id, email`,
    [userId, passwordHash]
  );

  return result.rows[0] || null;
}

async function findAdminByUserId(userId) {
  const result = await query(
    `
      SELECT admin_id, user_id, role
      FROM admins
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function listUsers() {
  const result = await query(
    `
      SELECT
        u.user_id,
        u.email,
        u.is_email_verified,
        u.created_at,
        u.is_deleted,
        u.accepted_terms,
        a.admin_id,
        a.role AS admin_role
      FROM users u
      LEFT JOIN admins a ON a.user_id = u.user_id
      ORDER BY u.created_at DESC
      LIMIT 100
    `
  );

  return result.rows;
}

async function listHelpRequests() {
  const result = await query(
    `
      SELECT
        request_id,
        user_id,
        need_type,
        description,
        status,
        created_at,
        resolved_at,
        is_saved_locally
      FROM help_requests
      ORDER BY created_at DESC
      LIMIT 100
    `
  );

  return result.rows;
}

async function listAnnouncements() {
  const result = await query(
    `
      SELECT
        announcement_id,
        admin_id,
        title,
        content,
        created_at
      FROM news_announcements
      ORDER BY created_at DESC
      LIMIT 100
    `
  );

  return result.rows;
}

async function getBasicStats() {
  const [usersResult, helpRequestsResult, announcementsResult, adminsResult] =
    await Promise.all([
      query(`SELECT COUNT(*)::int AS count FROM users WHERE is_deleted = FALSE`),
      query(`SELECT COUNT(*)::int AS count FROM help_requests`),
      query(`SELECT COUNT(*)::int AS count FROM news_announcements`),
      query(`SELECT COUNT(*)::int AS count FROM admins`),
    ]);

  return {
    totalUsers: usersResult.rows[0].count,
    totalHelpRequests: helpRequestsResult.rows[0].count,
    totalAnnouncements: announcementsResult.rows[0].count,
    totalAdmins: adminsResult.rows[0].count,
  };
}

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  markEmailVerified,
  updateUserPassword,
  findAdminByUserId,
  listUsers,
  listHelpRequests,
  listAnnouncements,
  getBasicStats,
};