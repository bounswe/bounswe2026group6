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

### Web

Example file:

- `web/.env.example`

Important variables include:

- `NEXT_PUBLIC_API_BASE_URL`
- `API_BASE_URL`

Notes:

- `NEXT_PUBLIC_API_BASE_URL` is used for browser-facing requests.
- `API_BASE_URL` can be used for server-side requests inside the Docker network.

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
- the backend waits for PostgreSQL to become healthy before starting
- the web container is configured to talk to the backend in the local Docker setup

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

## Mobile note

The Android application lives in `android/`.

- local debug builds are expected to reach the backend through the emulator bridge at `http://10.0.2.2:3000`
- Android is not part of the root Docker Compose workflow
- mobile build and release steps are handled separately from the local Docker setup

## Deployment note

This README focuses on local development and evaluation. Deployment- and release-related files may exist elsewhere in the repository, but the top-level guide is intentionally centered on how to build and run the project locally.

## Development notes

- keep documentation and env examples in sync with the actual setup
- prefer the root Docker flow for quick end-to-end verification
- keep local configuration out of version control