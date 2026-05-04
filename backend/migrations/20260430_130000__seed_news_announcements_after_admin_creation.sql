-- Ensure initial public announcements are still seeded in environments where the
-- original seed migration ran before any administrator existed.
--
-- The seed remains safe and idempotent:
-- - no admin row means no announcement row is inserted yet
-- - the first later admin insert triggers the same seed
-- - fixed announcement ids prevent duplicates
-- - existing announcements are never overwritten

CREATE OR REPLACE FUNCTION seed_initial_news_announcements_for_admin(seed_admin_id VARCHAR)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF seed_admin_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO news_announcements (announcement_id, admin_id, title, content, created_at)
  VALUES
    (
      'seed_announcement_preparedness_checklist',
      seed_admin_id,
      'Preparedness checklist updated',
      'Review your household emergency bag, contact list, medication details, and nearest gathering area before an emergency occurs.',
      '2026-04-29 12:00:00'
    ),
    (
      'seed_announcement_volunteer_expansion',
      seed_admin_id,
      'Community safety volunteers are expanding',
      'New volunteer coordination improvements are being prepared to help communities respond faster during emergencies.',
      '2026-04-29 12:05:00'
    ),
    (
      'seed_announcement_gathering_area',
      seed_admin_id,
      'Know your nearest gathering area',
      'Check the gathering areas page and keep your location information up to date so emergency guidance can stay relevant.',
      '2026-04-29 12:10:00'
    )
  ON CONFLICT (announcement_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION seed_initial_news_announcements_after_admin_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM seed_initial_news_announcements_for_admin(NEW.admin_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_initial_news_announcements_after_admin_insert ON admins;

CREATE TRIGGER trg_seed_initial_news_announcements_after_admin_insert
AFTER INSERT ON admins
FOR EACH ROW
EXECUTE FUNCTION seed_initial_news_announcements_after_admin_insert();

WITH seed_admin AS (
  SELECT admin_id
  FROM admins
  ORDER BY admin_id
  LIMIT 1
)
SELECT seed_initial_news_announcements_for_admin(admin_id)
FROM seed_admin;
