const { randomUUID } = require('crypto');
const { query } = require('../../db/pool');

function buildId(prefix) {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`.slice(0, 64);
}

function displayName(row) {
  return [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || null;
}

function mapCircle(row) {
  if (!row) {
    return null;
  }

  return {
    circleId: row.circle_id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    memberCount: Number(row.member_count || 0),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function mapMember(row) {
  return {
    userId: row.user_id,
    displayName: displayName(row),
    emergencyContact: row.phone_number
      ? {
        phoneNumber: row.phone_number,
      }
      : null,
    role: row.role,
    status: row.status || 'unknown',
    note: row.status_note || null,
    shareLocationConsent: Boolean(row.share_location_consent),
    lastCheckedInAt: row.status_updated_at || null,
    location: row.can_see_location && row.latitude != null && row.longitude != null
      ? {
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        accuracyMeters: row.location_accuracy_meters == null ? null : Number(row.location_accuracy_meters),
        source: row.location_source || null,
        capturedAt: row.location_captured_at || null,
      }
      : null,
    joinedAt: row.joined_at || null,
  };
}

function mapInvite(row) {
  if (!row) {
    return null;
  }

  return {
    inviteId: row.invite_id,
    circleId: row.circle_id,
    circleName: row.circle_name || row.name || null,
    inviterUserId: row.inviter_user_id,
    inviterDisplayName: row.inviter_first_name || row.inviter_last_name
      ? [row.inviter_first_name, row.inviter_last_name].filter(Boolean).join(' ').trim()
      : null,
    inviteeUserId: row.invitee_user_id,
    inviteeDisplayName: row.invitee_first_name || row.invitee_last_name
      ? [row.invitee_first_name, row.invitee_last_name].filter(Boolean).join(' ').trim()
      : null,
    status: row.status,
    createdAt: row.created_at || null,
    respondedAt: row.responded_at || null,
  };
}

async function createCircle(ownerUserId, { name }) {
  const circleId = buildId('circle');
  const result = await query(
    `
      WITH created_circle AS (
        INSERT INTO safety_circles (circle_id, owner_user_id, name)
        VALUES ($1, $2, $3)
        RETURNING circle_id, owner_user_id, name, created_at, updated_at
      ),
      owner_member AS (
        INSERT INTO safety_circle_members (circle_id, user_id, role)
        SELECT circle_id, owner_user_id, 'owner'
        FROM created_circle
      )
      SELECT cc.*, 1 AS member_count
      FROM created_circle cc;
    `,
    [circleId, ownerUserId, name],
  );

  return mapCircle(result.rows[0]);
}

async function listCirclesForUser(userId) {
  const result = await query(
    `
      SELECT
        sc.circle_id,
        sc.owner_user_id,
        sc.name,
        sc.created_at,
        sc.updated_at,
        COUNT(scm_all.user_id) AS member_count
      FROM safety_circles sc
      JOIN safety_circle_members scm_self
        ON scm_self.circle_id = sc.circle_id
       AND scm_self.user_id = $1
      LEFT JOIN safety_circle_members scm_all
        ON scm_all.circle_id = sc.circle_id
      GROUP BY sc.circle_id
      ORDER BY sc.updated_at DESC, sc.name ASC;
    `,
    [userId],
  );

  return result.rows.map(mapCircle);
}

async function findCircleForMember(circleId, userId) {
  const result = await query(
    `
      SELECT
        sc.circle_id,
        sc.owner_user_id,
        sc.name,
        sc.created_at,
        sc.updated_at,
        COUNT(scm_all.user_id) AS member_count
      FROM safety_circles sc
      JOIN safety_circle_members scm_self
        ON scm_self.circle_id = sc.circle_id
       AND scm_self.user_id = $2
      LEFT JOIN safety_circle_members scm_all
        ON scm_all.circle_id = sc.circle_id
      WHERE sc.circle_id = $1
      GROUP BY sc.circle_id
      LIMIT 1;
    `,
    [circleId, userId],
  );

  return mapCircle(result.rows[0]);
}

async function listCircleMembers(circleId, viewerUserId) {
  const result = await query(
    `
      SELECT
        scm.user_id,
        scm.role,
        scm.joined_at,
        up.first_name,
        up.last_name,
        up.phone_number,
        uss.status,
        uss.status_note,
        uss.share_location_consent,
        uss.latitude,
        uss.longitude,
        uss.location_accuracy_meters,
        uss.location_source,
        uss.location_captured_at,
        uss.updated_at AS status_updated_at,
        (
          uss.share_location_consent = TRUE
          AND COALESCE(ps.location_sharing_enabled, FALSE) = TRUE
          AND COALESCE(ps.location_visibility::text, 'PRIVATE') <> 'PRIVATE'
        ) AS can_see_location
      FROM safety_circle_members viewer
      JOIN safety_circle_members scm
        ON scm.circle_id = viewer.circle_id
      LEFT JOIN user_profiles up
        ON up.user_id = scm.user_id
      LEFT JOIN privacy_settings ps
        ON ps.profile_id = up.profile_id
      LEFT JOIN user_safety_statuses uss
        ON uss.user_id = scm.user_id
      WHERE viewer.circle_id = $1
        AND viewer.user_id = $2
      ORDER BY
        CASE scm.role WHEN 'owner' THEN 0 ELSE 1 END,
        up.first_name ASC NULLS LAST,
        scm.user_id ASC;
    `,
    [circleId, viewerUserId],
  );

  return result.rows.map(mapMember);
}

async function findUserByIdOrEmail({ inviteeUserId, inviteeEmail }) {
  const result = await query(
    `
      SELECT user_id
      FROM users
      WHERE ($1::varchar IS NOT NULL AND user_id = $1)
         OR ($2::varchar IS NOT NULL AND LOWER(email) = $2)
      LIMIT 1;
    `,
    [inviteeUserId, inviteeEmail],
  );

  return result.rows[0] || null;
}

async function isCircleMember(circleId, userId) {
  const result = await query(
    `
      SELECT 1
      FROM safety_circle_members
      WHERE circle_id = $1
        AND user_id = $2
      LIMIT 1;
    `,
    [circleId, userId],
  );

  return result.rows.length > 0;
}

async function createInvite(circleId, inviterUserId, inviteeUserId) {
  const inviteId = buildId('invite');
  const result = await query(
    `
      INSERT INTO safety_circle_invites (
        invite_id,
        circle_id,
        inviter_user_id,
        invitee_user_id
      )
      VALUES ($1, $2, $3, $4)
      RETURNING invite_id, circle_id, inviter_user_id, invitee_user_id, status, created_at, responded_at;
    `,
    [inviteId, circleId, inviterUserId, inviteeUserId],
  );

  return mapInvite(result.rows[0]);
}

async function listInvitesForUser(userId) {
  const result = await query(
    `
      SELECT
        sci.invite_id,
        sci.circle_id,
        sc.name AS circle_name,
        sci.inviter_user_id,
        inviter_profile.first_name AS inviter_first_name,
        inviter_profile.last_name AS inviter_last_name,
        sci.invitee_user_id,
        invitee_profile.first_name AS invitee_first_name,
        invitee_profile.last_name AS invitee_last_name,
        sci.status,
        sci.created_at,
        sci.responded_at
      FROM safety_circle_invites sci
      JOIN safety_circles sc ON sc.circle_id = sci.circle_id
      LEFT JOIN user_profiles inviter_profile ON inviter_profile.user_id = sci.inviter_user_id
      LEFT JOIN user_profiles invitee_profile ON invitee_profile.user_id = sci.invitee_user_id
      WHERE sci.invitee_user_id = $1
      ORDER BY sci.created_at DESC;
    `,
    [userId],
  );

  return result.rows.map(mapInvite);
}

async function findInviteForUser(inviteId, userId) {
  const result = await query(
    `
      SELECT
        sci.invite_id,
        sci.circle_id,
        sc.name AS circle_name,
        sci.inviter_user_id,
        sci.invitee_user_id,
        sci.status,
        sci.created_at,
        sci.responded_at
      FROM safety_circle_invites sci
      JOIN safety_circles sc ON sc.circle_id = sci.circle_id
      WHERE sci.invite_id = $1
        AND sci.invitee_user_id = $2
      LIMIT 1;
    `,
    [inviteId, userId],
  );

  return result.rows[0] || null;
}

async function respondToInvite(inviteId, userId, decision) {
  const invite = await findInviteForUser(inviteId, userId);
  if (!invite) {
    return null;
  }
  if (invite.status !== 'pending') {
    return mapInvite(invite);
  }

  const nextStatus = decision === 'accept' ? 'accepted' : 'rejected';
  const result = await query(
    `
      WITH updated_invite AS (
        UPDATE safety_circle_invites
        SET status = $3,
            responded_at = CURRENT_TIMESTAMP
        WHERE invite_id = $1
          AND invitee_user_id = $2
          AND status = 'pending'
        RETURNING invite_id, circle_id, inviter_user_id, invitee_user_id, status, created_at, responded_at
      ),
      inserted_member AS (
        INSERT INTO safety_circle_members (circle_id, user_id, role)
        SELECT circle_id, invitee_user_id, 'member'
        FROM updated_invite
        WHERE $3 = 'accepted'
        ON CONFLICT (circle_id, user_id) DO NOTHING
      )
      SELECT
        ui.invite_id,
        ui.circle_id,
        sc.name AS circle_name,
        ui.inviter_user_id,
        ui.invitee_user_id,
        ui.status,
        ui.created_at,
        ui.responded_at
      FROM updated_invite ui
      JOIN safety_circles sc ON sc.circle_id = ui.circle_id;
    `,
    [inviteId, userId, nextStatus],
  );

  return mapInvite(result.rows[0]);
}

async function removeMember(circleId, userId) {
  const result = await query(
    `
      DELETE FROM safety_circle_members
      WHERE circle_id = $1
        AND user_id = $2
        AND role <> 'owner'
      RETURNING circle_id, user_id;
    `,
    [circleId, userId],
  );

  return result.rows.length > 0;
}

module.exports = {
  createCircle,
  listCirclesForUser,
  findCircleForMember,
  listCircleMembers,
  findUserByIdOrEmail,
  isCircleMember,
  createInvite,
  listInvitesForUser,
  respondToInvite,
  removeMember,
};
