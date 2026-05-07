BEGIN;

ALTER TABLE help_requests
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;

ALTER TABLE help_requests
  DROP CONSTRAINT IF EXISTS chk_help_request_cancelled_at;

ALTER TABLE help_requests
  ADD CONSTRAINT chk_help_request_cancelled_at
  CHECK (
    cancelled_at IS NULL
    OR cancelled_at >= created_at
  );

COMMIT;
