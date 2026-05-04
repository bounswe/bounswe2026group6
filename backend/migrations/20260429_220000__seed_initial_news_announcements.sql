-- Seed initial public announcements when at least one administrator exists.
-- The announcements table requires an admin_id, so this migration safely no-ops
-- on environments that do not have an admin row yet.

WITH seed_admin AS (
  SELECT admin_id
  FROM admins
  ORDER BY admin_id
  LIMIT 1
)
INSERT INTO news_announcements (announcement_id, admin_id, title, content, created_at)
SELECT
  seed.announcement_id,
  seed_admin.admin_id,
  seed.title,
  seed.content,
  seed.created_at::timestamp
FROM seed_admin
CROSS JOIN (
  VALUES
    (
      'seed_announcement_preparedness_checklist',
      'Preparedness checklist updated',
      'Review your household emergency bag, contact list, medication details, and nearest gathering area before an emergency occurs.',
      '2026-04-29 12:00:00'
    ),
    (
      'seed_announcement_volunteer_expansion',
      'Community safety volunteers are expanding',
      'New volunteer coordination improvements are being prepared to help communities respond faster during emergencies.',
      '2026-04-29 12:05:00'
    ),
    (
      'seed_announcement_gathering_area',
      'Know your nearest gathering area',
      'Check the gathering areas page and keep your location information up to date so emergency guidance can stay relevant.',
      '2026-04-29 12:10:00'
    )
) AS seed(announcement_id, title, content, created_at)
ON CONFLICT (announcement_id) DO NOTHING;
