const { pool, query } = require('../../db/pool');

async function findUserByGoogleId(googleId) {
  const result = await query(
    `
      SELECT
        user_id,
        email,
        google_id,
        is_email_verified,
        is_banned,
        created_at,
        is_deleted,
        accepted_terms
      FROM users
      WHERE google_id = $1
      LIMIT 1
    `,
    [googleId]
  );

  return result.rows[0] || null;
}

async function upsertGoogleUser({ userId, email, googleId }) {
  const result = await query(
    `
      INSERT INTO users (
        user_id,
        email,
        google_id,
        is_email_verified
      )
      VALUES ($1, $2, $3, TRUE)
      ON CONFLICT (google_id) DO UPDATE
        SET email = EXCLUDED.email
      RETURNING
        user_id,
        email,
        google_id,
        is_email_verified,
        is_banned,
        is_deleted,
        accepted_terms,
        created_at
    `,
    [userId, email, googleId]
  );

  return result.rows[0];
}

async function findUserByEmail(email) {
  const result = await query(
    `
      SELECT
        user_id,
        email,
        google_id,
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

async function releaseDeletedUserIdentity(userId) {
  const result = await query(
    `
      UPDATE users
      SET email = CASE
            WHEN email LIKE 'deleted+%@deleted.invalid' THEN email
            ELSE CONCAT('deleted+', md5(user_id || ':' || clock_timestamp()::text), '@deleted.invalid')
          END,
          google_id = NULL,
          password_hash = 'deleted-account-disabled',
          is_email_verified = FALSE,
          accepted_terms = FALSE,
          is_banned = FALSE,
          ban_reason = NULL,
          banned_at = NULL
      WHERE user_id = $1
        AND is_deleted = TRUE
      RETURNING user_id, email, google_id, is_deleted
    `,
    [userId],
  );

  return result.rows[0] || null;
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

async function softDeleteUserAccount(userId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `
        SELECT user_id, is_deleted
        FROM users
        WHERE user_id = $1
        FOR UPDATE
      `,
      [userId],
    );
    const user = userResult.rows[0] || null;

    if (!user || user.is_deleted) {
      await client.query('ROLLBACK');
      return null;
    }

    const ownedOpenRequestsResult = await client.query(
      `
        SELECT request_id
        FROM help_requests
        WHERE user_id = $1
          AND status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS')
      `,
      [userId],
    );
    const ownedOpenRequestIds = ownedOpenRequestsResult.rows.map((row) => row.request_id);

    const assignedActiveRequestsResult = await client.query(
      `
        SELECT DISTINCT a.assignment_id, a.request_id, hr.status
        FROM assignments a
        JOIN volunteers v ON v.volunteer_id = a.volunteer_id
        JOIN help_requests hr ON hr.request_id = a.request_id
        WHERE v.user_id = $1
          AND a.is_cancelled = FALSE
      `,
      [userId],
    );
    const assignedActiveRequestIds = [
      ...new Set(assignedActiveRequestsResult.rows.map((row) => row.request_id)),
    ];
    const volunteerAssignmentIds = assignedActiveRequestsResult.rows.map((row) => row.assignment_id);
    const assignedOpenRequestIds = assignedActiveRequestsResult.rows
      .filter((row) => ['PENDING', 'ASSIGNED', 'IN_PROGRESS'].includes(row.status))
      .map((row) => row.request_id);

    if (ownedOpenRequestIds.length > 0 || volunteerAssignmentIds.length > 0) {
      await client.query(
        `
          UPDATE assignments
          SET is_cancelled = TRUE
          WHERE is_cancelled = FALSE
            AND (
              request_id = ANY($1::varchar[])
              OR assignment_id = ANY($2::varchar[])
            )
        `,
        [ownedOpenRequestIds, volunteerAssignmentIds],
      );
    }

    if (ownedOpenRequestIds.length > 0) {
      await client.query(
        `
          UPDATE help_requests
          SET status = 'CANCELLED',
              cancelled_at = COALESCE(cancelled_at, CURRENT_TIMESTAMP)
          WHERE request_id = ANY($1::varchar[])
        `,
        [ownedOpenRequestIds],
      );
    }

    const requestsToResync = assignedOpenRequestIds.filter(
      (requestId) => !ownedOpenRequestIds.includes(requestId),
    );

    for (const requestId of requestsToResync) {
      await client.query(
        `
          UPDATE help_requests hr
          SET status = CASE
            WHEN EXISTS (
              SELECT 1
              FROM assignments a
              WHERE a.request_id = hr.request_id
                AND a.is_cancelled = FALSE
            ) THEN CASE
              WHEN hr.status = 'IN_PROGRESS' THEN 'IN_PROGRESS'::request_status
              ELSE 'ASSIGNED'::request_status
            END
            ELSE 'PENDING'::request_status
          END
          WHERE hr.request_id = $1
        `,
        [requestId],
      );
    }

    const volunteerResult = await client.query(
      `
        UPDATE volunteers
        SET is_available = FALSE,
            last_known_latitude = NULL,
            last_known_longitude = NULL,
            location_updated_at = NULL,
            available_until = NULL,
            availability_confirmed_at = NULL,
            last_location_accuracy_meters = NULL,
            last_location_source = NULL
        WHERE user_id = $1
        RETURNING volunteer_id
      `,
      [userId],
    );

    for (const volunteer of volunteerResult.rows) {
      await client.query(
        `
          INSERT INTO availability_records (
            availability_id,
            volunteer_id,
            is_available,
            stored_locally,
            synced_at
          )
          VALUES ($1, $2, FALSE, FALSE, CURRENT_TIMESTAMP)
        `,
        [`avr_delete_${volunteer.volunteer_id}`, volunteer.volunteer_id],
      );
    }

    await client.query(
      `
        UPDATE request_locations rl
        SET country = NULL,
            city = NULL,
            district = NULL,
            neighborhood = NULL,
            extra_address = NULL,
            latitude = NULL,
            longitude = NULL,
            is_gps_location = FALSE,
            is_last_known = FALSE
        FROM help_requests hr
        WHERE hr.request_id = rl.request_id
          AND hr.user_id = $1
      `,
      [userId],
    );

    await client.query(
      `
        UPDATE help_requests
        SET user_id = NULL,
            other_help_text = '',
            risk_flags = ARRAY[]::TEXT[],
            vulnerable_groups = ARRAY[]::TEXT[],
            description = NULL,
            blood_type = NULL,
            contact_full_name = NULL,
            contact_phone = NULL,
            contact_alternative_phone = NULL,
            consent_given = FALSE
        WHERE user_id = $1
      `,
      [userId],
    );

    await client.query(
      `
        UPDATE user_profiles
        SET first_name = NULL,
            last_name = NULL,
            phone_number = NULL
        WHERE user_id = $1
      `,
      [userId],
    );

    await client.query(
      `
        UPDATE physical_info pi
        SET age = NULL,
            date_of_birth = NULL,
            gender = NULL,
            height = NULL,
            weight = NULL
        FROM user_profiles up
        WHERE up.profile_id = pi.profile_id
          AND up.user_id = $1
      `,
      [userId],
    );

    await client.query(
      `
        UPDATE health_info hi
        SET medical_conditions = ARRAY[]::TEXT[],
            chronic_diseases = ARRAY[]::TEXT[],
            allergies = ARRAY[]::TEXT[],
            medications = ARRAY[]::TEXT[],
            blood_type = NULL
        FROM user_profiles up
        WHERE up.profile_id = hi.profile_id
          AND up.user_id = $1
      `,
      [userId],
    );

    await client.query(
      `
        UPDATE location_profiles lp
        SET address = NULL,
            city = NULL,
            country = NULL,
            latitude = NULL,
            longitude = NULL,
            district = NULL,
            neighborhood = NULL,
            display_address = NULL,
            extra_address = NULL,
            country_code = NULL,
            postal_code = NULL,
            place_id = NULL,
            coordinate_source = NULL,
            coordinate_captured_at = NULL,
            coordinate_accuracy_meters = NULL,
            last_updated = CURRENT_TIMESTAMP
        FROM user_profiles up
        WHERE up.profile_id = lp.profile_id
          AND up.user_id = $1
      `,
      [userId],
    );

    await client.query(
      `
        UPDATE privacy_settings ps
        SET profile_visibility = 'PRIVATE',
            health_info_visibility = 'PRIVATE',
            location_visibility = 'PRIVATE',
            location_sharing_enabled = FALSE
        FROM user_profiles up
        WHERE up.profile_id = ps.profile_id
          AND up.user_id = $1
      `,
      [userId],
    );

    await client.query(
      `
        UPDATE expertise e
        SET profession = NULL,
            expertise_area = NULL,
            is_verified = FALSE
        FROM user_profiles up
        WHERE up.profile_id = e.profile_id
          AND up.user_id = $1
      `,
      [userId],
    );

    await client.query(
      `
        UPDATE user_safety_statuses
        SET status = 'unknown',
            status_note = NULL,
            share_location_consent = FALSE,
            latitude = NULL,
            longitude = NULL,
            location_accuracy_meters = NULL,
            location_source = NULL,
            location_captured_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
      `,
      [userId],
    );

    await client.query('DELETE FROM user_operational_locations WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM notification_devices WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM notification_preferences WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM notification_type_preferences WHERE user_id = $1', [userId]);
    await client.query(
      `
        UPDATE notification_deliveries
        SET device_token = NULL,
            error_message = NULL
        WHERE user_id = $1
      `,
      [userId],
    );
    await client.query('DELETE FROM notifications WHERE recipient_user_id = $1', [userId]);
    await client.query('UPDATE notifications SET actor_user_id = NULL WHERE actor_user_id = $1', [userId]);
    await client.query('DELETE FROM safety_circle_invites WHERE inviter_user_id = $1 OR invitee_user_id = $1', [userId]);
    await client.query('DELETE FROM safety_circle_members WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM safety_circles WHERE owner_user_id = $1', [userId]);

    const deletedResult = await client.query(
      `
        UPDATE users
        SET is_deleted = TRUE,
            email = CONCAT('deleted+', md5(user_id || ':' || clock_timestamp()::text), '@deleted.invalid'),
            google_id = NULL,
            password_hash = 'deleted-account-disabled',
            is_email_verified = FALSE,
            accepted_terms = FALSE,
            is_banned = FALSE,
            ban_reason = NULL,
            banned_at = NULL
        WHERE user_id = $1
        RETURNING user_id, is_deleted
      `,
      [userId],
    );

    await client.query('COMMIT');

    return {
      userId: deletedResult.rows[0].user_id,
      cancelledRequestCount: ownedOpenRequestIds.length,
      cancelledAssignmentRequestCount: assignedActiveRequestIds.length,
      availabilityCancelled: volunteerResult.rowCount > 0,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  findUserByEmail,
  findUserById,
  findUserAuthStateById,
  createUser,
  releaseDeletedUserIdentity,
  markEmailVerified,
  updateUserPassword,
  findAdminByUserId,
  softDeleteUserAccount,
  findUserByGoogleId,
  upsertGoogleUser,
};
