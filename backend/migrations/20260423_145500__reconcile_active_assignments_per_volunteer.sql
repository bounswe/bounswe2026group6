BEGIN;

WITH deleted_closed_request_assignments AS (
  DELETE FROM assignments a
  USING help_requests hr
  WHERE a.request_id = hr.request_id
    AND a.is_cancelled = FALSE
    AND hr.status IN ('RESOLVED', 'CANCELLED')
  RETURNING a.request_id, a.volunteer_id
),
ranked_active_assignments AS (
  SELECT
    a.assignment_id,
    a.request_id,
    ROW_NUMBER() OVER (
      PARTITION BY a.volunteer_id
      ORDER BY a.assigned_at ASC, a.assignment_id ASC
    ) AS volunteer_rank
  FROM assignments a
  JOIN help_requests hr ON hr.request_id = a.request_id
  WHERE a.is_cancelled = FALSE
    AND hr.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS')
),
deleted_assignments AS (
  DELETE FROM assignments a
  USING ranked_active_assignments ranked
  WHERE a.assignment_id = ranked.assignment_id
    AND ranked.volunteer_rank > 1
  RETURNING a.request_id
),
surviving_active_requests AS (
  SELECT DISTINCT ranked.request_id
  FROM ranked_active_assignments ranked
  WHERE ranked.volunteer_rank = 1
),
affected_requests AS (
  SELECT request_id FROM deleted_closed_request_assignments
  UNION
  SELECT request_id FROM deleted_assignments
)
UPDATE help_requests hr
SET status = CASE
  WHEN hr.status = 'IN_PROGRESS' THEN 'IN_PROGRESS'::request_status
  WHEN EXISTS (
    SELECT 1
    FROM surviving_active_requests sar
    WHERE sar.request_id = hr.request_id
  ) THEN 'ASSIGNED'::request_status
  ELSE 'PENDING'::request_status
END
WHERE hr.request_id IN (
  SELECT DISTINCT affected_requests.request_id
  FROM affected_requests
)
  AND hr.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS');

COMMIT;
