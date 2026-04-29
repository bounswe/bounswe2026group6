BEGIN;

ALTER TABLE help_requests ALTER COLUMN contact_full_name DROP NOT NULL;
ALTER TABLE request_locations ALTER COLUMN neighborhood DROP NOT NULL;

COMMIT;
