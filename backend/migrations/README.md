# Backend migrations

This folder contains SQL migration files owned by backend domain changes.

## Naming convention

Use this format for every file:

`YYYYMMDD_HHMMSS__short_description.sql`

Examples:

- `20260414_101500__add_users_last_login.sql`
- `20260414_103000__create_help_request_index.sql`

Rules:

- use lowercase snake_case in descriptions
- keep one migration concern per file
- never edit an already committed migration file; create a new migration instead

## Data backfill notes

- `20260420_120000__extend_location_profiles_administrative_fields.sql` intentionally backfills only `display_address` from legacy `address`.
- Other structured columns (`country_code`, `district`, `neighborhood`, `extra_address`, `postal_code`, `place_id`) are left nullable for existing rows because legacy schema does not reliably contain those values.
- If historical best-effort enrichment is required later, add a new append-only migration instead of rewriting existing migration history.

## Write migrations safely

- prefer additive changes first (ADD COLUMN, CREATE INDEX)
- for destructive changes (DROP, RENAME), split into multiple deploy-safe migrations when possible
- include `IF EXISTS` / `IF NOT EXISTS` guards where applicable
- wrap complex changes in transactions

## Local run

From `backend/`:

```bash
npm run migrate
```

Or run full stack from repository root:

```bash
docker compose up --build
```

Backend container runs migrations on startup using `scripts/apply-migrations.js`.
