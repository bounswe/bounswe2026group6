BEGIN;

ALTER TABLE assignments
  DROP CONSTRAINT IF EXISTS assignments_request_id_key;

CREATE INDEX IF NOT EXISTS idx_assignments_request_id
  ON assignments(request_id);

COMMIT;
