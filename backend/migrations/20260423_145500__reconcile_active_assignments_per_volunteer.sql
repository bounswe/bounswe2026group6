BEGIN;

WITH ranked_active_assignments AS (
  SELECT
    a.assignment_id,
    a.request_id,
    ROW_NUMBER() OVER (
      PARTITION BY a.volunteer_id
      ORDER BY a.assigned_at ASC, a.assignment_id ASC
    ) AS volunteer_rank
  FROM assignments a
  WHERE a.is_cancelled = FALSE
),
deleted_assignments AS (
  DELETE FROM assignments a
  USING ranked_active_assignments ranked
  WHERE a.assignment_id = ranked.assignment_id
    AND ranked.volunteer_rank > 1
  RETURNING a.request_id
)
UPDATE help_requests hr
SET status = CASE
  WHEN hr.status = 'IN_PROGRESS' THEN 'IN_PROGRESS'::request_status
  WHEN EXISTS (
    SELECT 1
    FROM assignments a
    WHERE a.request_id = hr.request_id
      AND a.is_cancelled = FALSE
  ) THEN 'ASSIGNED'::request_status
  ELSE 'PENDING'::request_status
END
WHERE hr.request_id IN (
  SELECT DISTINCT deleted_assignments.request_id
  FROM deleted_assignments
)
  AND hr.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS');

COMMIT;
