BEGIN;

ALTER TABLE help_requests
  ADD COLUMN IF NOT EXISTS urgency_level VARCHAR(20),
  ADD COLUMN IF NOT EXISTS priority_level VARCHAR(20);

UPDATE help_requests
SET
  urgency_level = CASE
    WHEN COALESCE(array_length(risk_flags, 1), 0) >= 2 OR affected_people_count >= 5 THEN 'HIGH'
    WHEN COALESCE(array_length(risk_flags, 1), 0) = 1 OR affected_people_count BETWEEN 3 AND 4 THEN 'MEDIUM'
    ELSE 'LOW'
  END,
  priority_level = CASE
    WHEN COALESCE(array_length(risk_flags, 1), 0) >= 2 OR affected_people_count >= 5 THEN 'HIGH'
    WHEN COALESCE(array_length(risk_flags, 1), 0) = 1 OR affected_people_count BETWEEN 3 AND 4 THEN 'MEDIUM'
    ELSE 'LOW'
  END
WHERE urgency_level IS NULL OR priority_level IS NULL;

ALTER TABLE help_requests
  DROP CONSTRAINT IF EXISTS chk_help_request_urgency_level;

ALTER TABLE help_requests
  ADD CONSTRAINT chk_help_request_urgency_level
  CHECK (
    urgency_level IS NULL
    OR urgency_level IN ('LOW', 'MEDIUM', 'HIGH')
  );

ALTER TABLE help_requests
  DROP CONSTRAINT IF EXISTS chk_help_request_priority_level;

ALTER TABLE help_requests
  ADD CONSTRAINT chk_help_request_priority_level
  CHECK (
    priority_level IS NULL
    OR priority_level IN ('LOW', 'MEDIUM', 'HIGH')
  );

COMMIT;
