'use strict';

const { query } = require('../../../../src/db/pool');
const { expireStalePendingHelpRequests } = require('../../../../src/modules/notifications/repository');

beforeEach(async () => {
  await query(`
    TRUNCATE TABLE
      notification_deliveries,
      notification_devices,
      notification_type_preferences,
      notification_preferences,
      notifications,
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
  `);
}, 15000);

describe('notification jobs repository integration', () => {
  test('expireStalePendingHelpRequests cancels stale pending requests and sets cancelled_at', async () => {
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
        VALUES ('job_user_1', 'job1@example.com', 'hash', TRUE, FALSE, TRUE);
      `,
    );

    await query(
      `
        INSERT INTO help_requests (
          request_id,
          user_id,
          need_type,
          contact_full_name,
          contact_phone,
          status,
          created_at
        )
        VALUES
          ('job_req_stale_1', 'job_user_1', 'food', 'Job User', 5000000001, 'PENDING', CURRENT_TIMESTAMP - INTERVAL '100 hour'),
          ('job_req_fresh_1', 'job_user_1', 'food', 'Job User', 5000000002, 'PENDING', CURRENT_TIMESTAMP - INTERVAL '1 hour');
      `,
    );

    const expired = await expireStalePendingHelpRequests({ ttlHours: 72, limit: 10 });

    expect(expired).toHaveLength(1);
    expect(expired[0]).toMatchObject({
      request_id: 'job_req_stale_1',
      user_id: 'job_user_1',
    });

    const staleRow = await query(
      `
        SELECT status, cancelled_at
        FROM help_requests
        WHERE request_id = 'job_req_stale_1'
      `,
    );
    const freshRow = await query(
      `
        SELECT status, cancelled_at
        FROM help_requests
        WHERE request_id = 'job_req_fresh_1'
      `,
    );

    expect(staleRow.rows[0].status).toBe('CANCELLED');
    expect(staleRow.rows[0].cancelled_at).toBeTruthy();
    expect(freshRow.rows[0].status).toBe('PENDING');
    expect(freshRow.rows[0].cancelled_at).toBeNull();
  });
});
