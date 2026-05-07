'use strict';

const fs = require('fs');
const path = require('path');

const { query } = require('../../../src/db/pool');

const cleanupMigrationSql = fs.readFileSync(
  path.resolve(__dirname, '../../../migrations/20260423_145500__reconcile_active_assignments_per_volunteer.sql'),
  'utf8',
);
const guardMigrationSql = fs.readFileSync(
  path.resolve(__dirname, '../../../migrations/20260423_150000__guard_active_assignment_per_volunteer.sql'),
  'utf8',
);

async function resetTables() {
  await query(`
    TRUNCATE TABLE
      assignments,
      availability_records,
      volunteers,
      request_locations,
      help_requests,
      expertise,
      user_profiles,
      users
    RESTART IDENTITY CASCADE;
  `);
}

async function seedActiveUser(userId, email = `${userId}@example.com`) {
  await query(
    `
      INSERT INTO users (
        user_id,
        email,
        password_hash,
        is_email_verified,
        is_deleted,
        accepted_terms
      )
      VALUES ($1, $2, 'hash', TRUE, FALSE, TRUE);
    `,
    [userId, email],
  );
}

async function seedVolunteer(volunteerId, userId) {
  await query(
    `
      INSERT INTO volunteers (volunteer_id, user_id, is_available)
      VALUES ($1, $2, FALSE);
    `,
    [volunteerId, userId],
  );
}

async function seedHelpRequest(requestId, userId, status) {
  await query(
    `
      INSERT INTO help_requests (
        request_id,
        user_id,
        help_types,
        affected_people_count,
        need_type,
        description,
        status,
        contact_full_name,
        contact_phone
      )
      VALUES ($1, $2, ARRAY['fire_brigade']::TEXT[], 1, 'fire_brigade', 'Need help', $3, 'Test Person', 5550000000);
    `,
    [requestId, userId, status],
  );
}

async function seedAssignment(assignmentId, volunteerId, requestId, assignedAt) {
  await query(
    `
      INSERT INTO assignments (assignment_id, volunteer_id, request_id, assigned_at, is_cancelled)
      VALUES ($1, $2, $3, $4, FALSE);
    `,
    [assignmentId, volunteerId, requestId, assignedAt],
  );
}

beforeEach(async () => {
  await resetTables();
  await query('DROP INDEX IF EXISTS idx_assignments_active_volunteer_unique;');
});

afterEach(async () => {
  await resetTables();
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_assignments_active_volunteer_unique
      ON assignments(volunteer_id)
      WHERE is_cancelled = FALSE;
  `);
});

describe('active-assignment-per-volunteer migration safety', () => {
  test('cleanup migration deterministically keeps one active assignment, resyncs affected requests, and unblocks the guard index', async () => {
    await seedActiveUser('user_volunteer_duplicate');
    await seedVolunteer('vol_duplicate', 'user_volunteer_duplicate');

    await seedActiveUser('user_req_keep');
    await seedActiveUser('user_req_drop_assigned');
    await seedActiveUser('user_req_drop_progress');
    await seedActiveUser('user_req_after_guard');

    await seedHelpRequest('req_keep', 'user_req_keep', 'ASSIGNED');
    await seedHelpRequest('req_drop_assigned', 'user_req_drop_assigned', 'ASSIGNED');
    await seedHelpRequest('req_drop_progress', 'user_req_drop_progress', 'IN_PROGRESS');
    await seedHelpRequest('req_after_guard', 'user_req_after_guard', 'PENDING');

    await seedAssignment('asg_000_keep', 'vol_duplicate', 'req_keep', '2026-04-23T08:00:00.000Z');
    await seedAssignment('asg_100_drop_assigned', 'vol_duplicate', 'req_drop_assigned', '2026-04-23T08:00:00.000Z');
    await seedAssignment('asg_200_drop_progress', 'vol_duplicate', 'req_drop_progress', '2026-04-23T08:05:00.000Z');

    await query(cleanupMigrationSql);
    await query(guardMigrationSql);

    const survivingAssignments = await query(
      `
        SELECT assignment_id, request_id
        FROM assignments
        WHERE volunteer_id = $1 AND is_cancelled = FALSE
        ORDER BY assigned_at ASC, assignment_id ASC;
      `,
      ['vol_duplicate'],
    );

    expect(survivingAssignments.rows).toEqual([
      {
        assignment_id: 'asg_000_keep',
        request_id: 'req_keep',
      },
    ]);

    const requestStatuses = await query(
      `
        SELECT request_id, status
        FROM help_requests
        WHERE request_id = ANY($1::VARCHAR(64)[])
        ORDER BY request_id ASC;
      `,
      [['req_drop_assigned', 'req_drop_progress', 'req_keep']],
    );

    expect(requestStatuses.rows).toEqual([
      {
        request_id: 'req_drop_assigned',
        status: 'PENDING',
      },
      {
        request_id: 'req_drop_progress',
        status: 'IN_PROGRESS',
      },
      {
        request_id: 'req_keep',
        status: 'ASSIGNED',
      },
    ]);

    await expect(
      seedAssignment('asg_300_blocked_after_guard', 'vol_duplicate', 'req_after_guard', '2026-04-23T08:10:00.000Z'),
    ).rejects.toMatchObject({ code: '23505' });
  });

  test('cleanup migration removes stale closed-request assignments before ranking open ones', async () => {
    await seedActiveUser('user_volunteer_stale');
    await seedVolunteer('vol_stale', 'user_volunteer_stale');

    await seedActiveUser('user_req_closed');
    await seedActiveUser('user_req_open');
    await seedActiveUser('user_req_after_cleanup');

    await seedHelpRequest('req_closed', 'user_req_closed', 'RESOLVED');
    await seedHelpRequest('req_open', 'user_req_open', 'ASSIGNED');
    await seedHelpRequest('req_after_cleanup', 'user_req_after_cleanup', 'PENDING');

    await seedAssignment('asg_000_closed', 'vol_stale', 'req_closed', '2026-04-23T08:00:00.000Z');
    await seedAssignment('asg_100_open', 'vol_stale', 'req_open', '2026-04-23T08:05:00.000Z');

    await query(cleanupMigrationSql);
    await query(guardMigrationSql);

    const survivingAssignments = await query(
      `
        SELECT assignment_id, request_id
        FROM assignments
        WHERE volunteer_id = $1 AND is_cancelled = FALSE
        ORDER BY assigned_at ASC, assignment_id ASC;
      `,
      ['vol_stale'],
    );

    expect(survivingAssignments.rows).toEqual([
      {
        assignment_id: 'asg_100_open',
        request_id: 'req_open',
      },
    ]);

    const requestStatuses = await query(
      `
        SELECT request_id, status
        FROM help_requests
        WHERE request_id = ANY($1::VARCHAR(64)[])
        ORDER BY request_id ASC;
      `,
      [['req_closed', 'req_open']],
    );

    expect(requestStatuses.rows).toEqual([
      {
        request_id: 'req_closed',
        status: 'RESOLVED',
      },
      {
        request_id: 'req_open',
        status: 'ASSIGNED',
      },
    ]);

    await expect(
      seedAssignment('asg_200_blocked_after_guard', 'vol_stale', 'req_after_cleanup', '2026-04-23T08:10:00.000Z'),
    ).rejects.toMatchObject({ code: '23505' });
  });
});
