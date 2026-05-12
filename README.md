# Neighborhood Emergency Preparedness Hub (NEPH)

NEPH is an MVP-focused disaster preparedness platform. This repository contains the backend API, web application, and Android client for core emergency support flows such as authentication, profile management, help requests, and volunteer availability.

For local evaluation, the recommended path is the Dockerized web + backend + PostgreSQL setup. The Android project lives in the same repository, but it is built and run separately from Docker Compose.

## Current scope

This repository currently includes the main pieces of the MVP:

- authentication flows such as signup, login, email verification, and current-user access
- profile and privacy-related flows
- help-request creation, listing, and status handling
- volunteer availability and related backend flows
- web pages for core product flows and supporting informational pages
- an Android client in the same monorepo

This should be read as a runnable MVP rather than a finished production system.

## Repository structure

```text
.
├── backend/   Backend API, tests, environment examples, Dockerfile
├── web/       Next.js web application, environment examples, Dockerfile
├── android/   Android application project
├── infra/     PostgreSQL bootstrap SQL and related infrastructure files
├── docs/      Project documents and reports
├── .github/   Workflows and repository templates
└── README.md  Top-level project guide
```

## Tech stack

### Backend

- Node.js
- Express
- PostgreSQL
- JWT-based authentication
- Nodemailer
- Jest and Supertest

### Web

- Next.js
- React
- TypeScript

### Android

- Kotlin
- Jetpack Compose
- Gradle

### Local tooling

- Docker Compose
- PostgreSQL

## Prerequisites

For the recommended local setup:

- Docker Desktop, or Docker Engine with the Compose plugin

For module-level development outside Docker:

- Node.js
- npm

For Android development:

- Android Studio
- Android SDK compatible with the project

## Live deployment

- Web app: `https://neph.app/`
- Backend API: `https://api.neph.app/api`

## Environment variables

Keep secrets and real credentials out of the repository. Use local env files or shell overrides.

### Backend

Example file:

- `backend/.env.example`

Important variables include:

- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL` if the backend uses a single connection string
- `JWT_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `APP_URL`
- `FRONTEND_URL`

Notes:

- Email-based flows require valid SMTP credentials.
- Placeholder SMTP values in the example file are not usable as-is.
- In Docker Compose, the backend connects to PostgreSQL through the internal service name `postgres`.
- Production deployments must use real database credentials and secure secrets. `JWT_SECRET` must not remain at the default value in production.

### Web

Example file:

- `web/.env.example`

Important variables include:

- `NEXT_PUBLIC_API_BASE_URL`
- `API_BASE_URL`

Notes:

- `NEXT_PUBLIC_API_BASE_URL` is the browser/client-side API base.
- `API_BASE_URL` is the server-side Next.js rewrite target.
- `/api` works for Docker and Next.js rewrite usage.
- `http://localhost:3000/api` works for direct backend access outside the rewrite path.

### Docker Compose overrides

The root `docker-compose.yml` provides sensible local defaults. If needed, you can override values from your shell or from a local root `.env` file before starting Compose.

Common overrides include:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_PORT`
- `JWT_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `NEXT_PUBLIC_API_BASE_URL`
- `INTERNAL_API_BASE_URL`

## Local development

### Recommended path: Docker Compose

From the repository root, run:

```bash
docker compose up --build
```

This starts:

- PostgreSQL on `localhost:5432`
- backend on `http://localhost:3000`
- web on `http://localhost:3001`

Useful URLs:

- web app: `http://localhost:3001`
- backend API base: `http://localhost:3000/api`
- backend health check: `http://localhost:3000/health`

Notes:

- PostgreSQL is initialized from `infra/docker/postgres/init.sql`
- backend automatically applies SQL migrations from `backend/migrations/` on container start
- the backend waits for PostgreSQL to become healthy before starting
- the web container is configured to talk to the backend in the local Docker setup

### Backend setup

To run the backend directly:

```bash
cd backend
cp .env.example .env
npm install
npm run migrate
npm start
```

Use real database credentials and secure secrets for production. `JWT_SECRET` must not remain at the default value in production.

### Web setup

To run the web app directly:

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
npm run build
npm run start
```

Use `NEXT_PUBLIC_API_BASE_URL=/api` with the Next.js rewrite, including Docker. Use `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api` when the browser should call the backend directly.

### Mobile setup

To build the Android app:

```bash
cd android
cp .env.example .env
cp keystore.properties.example keystore.properties
./gradlew :app:assembleDebug
./gradlew :app:assembleRelease
```

Debug Android emulator builds use `http://10.0.2.2:3000/api` to reach the host backend. Do not use `localhost` from inside the emulator for the host backend. Release builds use `NEPH_RELEASE_API_BASE_URL`, defaulting to `https://api.neph.app/api`.

`android/.env.example` is included for submission documentation. Local Gradle builds read release values from `keystore.properties`, environment variables, or Gradle properties. Before running `./gradlew :app:assembleRelease`, replace the placeholder values in `keystore.properties` with real signing values and make sure the keystore file exists at `ANDROID_KEYSTORE_PATH`. Do not include real secrets in the repository.

The signed release APK must be attached to the GitHub Release manually or by the release workflow.

### Final Boğaziçi demo data

Final demo data is stored in the normal backend migration flow:

- `backend/migrations/20260512_120000__seed_bogazici_final_demo_data.sql`

It is applied by the normal backend migration runner. In Docker Compose, backend migrations run automatically on startup, so no separate `ENABLE_DEMO_SEED=true npm run seed:demo` command is needed for the Boğaziçi final demo data after migrations run. The old `backend/demo-migrations/` flow is optional legacy demo data only.

Boğaziçi final demo accounts:

| Email | Password |
| --- | --- |
| `bogazici_reserve_1@neph.test` | `DemoPass123!` |
| `bogazici_reserve_2@neph.test` | `DemoPass123!` |
| `bogazici_reserve_3@neph.test` | `DemoPass123!` |
| `bogazici_reserve_4@neph.test` | `DemoPass123!` |
| `bogazici_assigned_1@neph.test` | `DemoPass123!` |
| `bogazici_assigned_2@neph.test` | `DemoPass123!` |
| `bogazici_requester_new_hall@neph.test` | `DemoPass123!` |

### Optional legacy demo data seed

Additional legacy demo-ready data is stored as SQL seed migrations under `backend/demo-migrations/`, but it is not applied by the normal backend migration flow. This keeps regular `npm run migrate` and `start:with-migrations` safe for normal environments.

To apply the demo dataset intentionally, run the regular migrations first and then run the guarded demo seed command:

```bash
cd backend
npm run migrate
ENABLE_DEMO_SEED=true npm run seed:demo
```

The demo seed is clearly marked with `[DEMO]` in user-facing records and uses deterministic `demo_*` IDs so local and deployment demo databases get the same presentation dataset. The demo seed command refuses to run unless `ENABLE_DEMO_SEED=true` is set. It includes 24 demo people: 1 admin, 9 requesters, 9 volunteers, and 5 additional community residents.

Demo login password for `*@neph.test` users:

```text
DemoPass123!
```

Demo accounts:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin_demo@neph.test` | `DemoPass123!` |
| Requester | `requester_ayse@neph.test` | `DemoPass123!` |
| Requester | `requester_mert@neph.test` | `DemoPass123!` |
| Requester | `requester_fatma@neph.test` | `DemoPass123!` |
| Requester | `requester_orhan@neph.test` | `DemoPass123!` |
| Volunteer | `volunteer_elif@neph.test` | `DemoPass123!` |
| Volunteer | `volunteer_can@neph.test` | `DemoPass123!` |
| Volunteer | `volunteer_sarp@neph.test` | `DemoPass123!` |
| Volunteer | `volunteer_zeynep@neph.test` | `DemoPass123!` |
| Mixed requester/volunteer/resident demos | `resident_nazan@neph.test` through `resident_lale@neph.test` | `DemoPass123!` |

### Optional non-Docker development

If you want to run modules directly on your machine instead of Docker Compose, use the module-specific setup inside each folder:

- `backend/`
- `web/`
- `android/`

In that mode, copy the example env files inside `backend/` and `web/`, then run the modules with npm or Android Studio as appropriate.

## Docker usage

The Dockerized setup in this repository is intentionally focused on local development and evaluation.

Included in Docker Compose:

- PostgreSQL
- backend API
- web application

Not included in Docker Compose:

- Android application
- deployment infrastructure
- release workflows

Relevant files:

- `docker-compose.yml`
- `backend/Dockerfile`
- `web/Dockerfile`
- `infra/docker/postgres/init.sql`

## Production setup

Production deployment requires backend production environment values for database credentials or `DATABASE_URL`, a secure `JWT_SECRET`, SMTP values if email flows are used, Google OAuth values if Google Sign-In is used, and push notification values if push delivery is enabled. It also requires web production values for `NEXT_PUBLIC_API_BASE_URL` and `API_BASE_URL`.

Use secure secrets instead of demo/default values. Start the backend with the normal migration-enabled startup flow so SQL migrations are applied before serving traffic.

Before final release, verify the backend health endpoint, the backend API base at `https://api.neph.app/api`, and the deployed web URL. The signed Android APK must be attached to the GitHub Release.

## Deployment note

The deployed backend API base is `https://api.neph.app/api`. The deployed web URL must be filled into this README and the GitHub Release notes before final submission if it is not already known.

## Final release checklist

- Code is merged to `main`.
- Tag `final-milestone` points to the final `main` commit.
- GitHub Release name is `1.0.0`.
- GitHub Release is official, not a pre-release.
- Release notes include the deployed web URL.
- Signed APK is attached to the GitHub Release.

## Development notes

- keep documentation and env examples in sync with the actual setup
- prefer the root Docker flow for quick end-to-end verification

## End-to-end tests

The repository now includes browser-based end-to-end coverage for the main web + backend user journeys:

- guest navigation and protected-route redirects
- signup, email verification, and profile completion
- profile/privacy updates after login
- forgot-password and reset-password flows

Run them from `web/`:

```bash
npm run test:e2e
```

Notes:

- Playwright global setup starts the backend and web app automatically for the test run.
- The suite expects a PostgreSQL server reachable through `TEST_POSTGRES_*` variables. In CI this is provided by a service container; locally you can use your own PostgreSQL instance or Docker.
- The backend runs in `NODE_ENV=test` during E2E, so auth emails are stubbed instead of being sent to a real SMTP provider.
- keep local configuration out of version control
