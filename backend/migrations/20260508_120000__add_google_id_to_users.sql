-- Add Google OAuth identity column to users table.
-- password_hash is made nullable to support Google-only accounts
-- that were never set up with an email/password credential.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;

ALTER TABLE users
    ALTER COLUMN password_hash DROP NOT NULL;
