const { query } = require('../../db/pool');

async function findUserByEmail(email) {
  const result = await query(
    `
      SELECT
        user_id,
        email,
        password_hash,
        is_email_verified,
        is_banned,
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
        is_banned,
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

async function findUserAuthStateById(userId) {
  const result = await query(
    `
      SELECT
        user_id,
        email,
        is_deleted,
        is_banned
      FROM users
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId],
  );

  return result.rows[0] || null;
}

module.exports = {
  findUserByEmail,
  findUserById,
  findUserAuthStateById,
  createUser,
  markEmailVerified,
  updateUserPassword,
  findAdminByUserId,
};
