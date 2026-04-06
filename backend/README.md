# Backend

This folder contains the Node.js + Express backend API for the Neighborhood Emergency Preparedness Hub MVP.

## MVP scope

The backend is the main implementation layer of the current MVP.

Main feature areas:

- `src/modules/auth` — signup, login, email verification, access control
- `src/modules/profiles` — user profile, privacy, health, and location data
- `src/modules/help-requests` — request creation, tracking, and status updates
- `src/modules/availability` — volunteer availability, matching, and assignment-related flows

## Structure

```text
src/
  modules/
    <feature>/
      routes.js
      controller.js
      service.js
      repository.js
      validators.js
```

Layer responsibilities:

- `routes` — endpoint wiring
- `controller` — request/response handling
- `service` — business logic
- `repository` — SQL and database access
- `validators` — payload validation helpers

## Run locally

### 1. Start PostgreSQL first

From repository root:

```bash
cd infra/dcompose
cp .env.example .env
docker compose -f docker-compose-dev.yml up -d
```

### 2. Start the backend

From this folder:

```bash
cp .env.example .env
npm install
npm run dev
```

### 3. Verify backend health

```text
GET http://localhost:3000/health
```

## Important endpoints

The backend exposes these top-level paths:

- `GET /health`
- `GET /api`
- `GET /api/auth`
- `GET /api/profiles`
- `GET /api/help-requests`
- `GET /api/availability`

## Environment notes

Create a local environment file first:

```bash
cp .env.example .env
```

Important notes:

- when backend runs on host and Postgres runs via Docker on the host machine, use `POSTGRES_HOST=localhost`
- if backend later runs in the same Docker network as Postgres, use `POSTGRES_HOST=postgres`

## Shared API conventions

- error response format:
  - `{ "code": "SOME_ERROR", "message": "Human readable message" }`
- common status codes:
  - `400` validation
  - `401` unauthorized
  - `403` forbidden
  - `404` not found
  - `409` conflict
  - `500` internal error
- protected endpoints should read current user from `req.user.userId`
- prefer kebab-case for route paths such as `/help-requests`

## Help request status notes

Current MVP help-request status behavior:

- `PENDING_SYNC` — request stored as local-only
- `SYNCED` — request exists on backend and is not local-only
- `MATCHED` — derived from assignment-side internal states such as `ASSIGNED` or `IN_PROGRESS`
- `RESOLVED` — request is marked resolved and receives `resolved_at`

## Tests

From this folder:

```bash
npm run test:unit
npm run test:integration
```

Additional backend test setup notes live in:

- `tests/setup/README.md`

## Database note

The shared PostgreSQL schema source of truth is:

- `../infra/docker/postgres/init.sql`
