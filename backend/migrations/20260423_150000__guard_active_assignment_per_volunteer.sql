BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_assignments_active_volunteer_unique
  ON assignments(volunteer_id)
  WHERE is_cancelled = FALSE;

COMMIT;
