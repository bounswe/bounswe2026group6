# Neighborhood Emergency Preparedness Hub

Neighborhood Emergency Preparedness Hub (NEPH) is a disaster-preparedness MVP focused on three core flows:

- people can create accounts and sign in
- users can complete and manage their profiles
- users can create and track help requests, while volunteers can manage availability and matching-related flows

This repository already includes a runnable local MVP stack for the backend and web app, plus an Android project and infrastructure files for local PostgreSQL.

## What is included in the MVP

The current MVP includes these implemented or locally runnable parts:

- **Backend API** in `backend/`
  - authentication: signup, login, email verification, current-user lookup
  - profile flows
  - help-request flows
  - volunteer availability and assignment-related flows
- **Web app** in `web/`
  - Next.js frontend for auth and user-facing flows
- **Android app** in `android/`
  - Android project scaffold with local API base URL configuration
- **Infrastructure** in `infra/`
  - Docker Compose setup for local PostgreSQL
  - database schema bootstrap script

## Repository structure

```text
.
├── web/        # Next.js web application
├── android/    # Android application project
├── backend/    # Node.js + Express API
├── docs/       # Reports and project documentation
├── infra/      # Docker Compose, Postgres init, and infra files
└── .github/    # GitHub templates and workflows
```

## Prerequisites

Install these before starting:

- Git
- Docker Desktop (or Docker Engine + Compose plugin)
- Node.js 20 LTS or newer
- npm

To use signup and email-based flows locally, you will also need:

- a working SMTP account or a local/test SMTP service

For Android development, you will also need:

- Android Studio
- Android SDK matching the project configuration

## Quick setup

These steps are the fastest way to run the local MVP.

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd bounswe2026group6
```

### 2. Start PostgreSQL

```bash
cd infra/dcompose
cp .env.example .env
docker compose -f docker-compose-dev.yml up -d
```

This starts the local PostgreSQL container and initializes the schema from:

- `infra/docker/postgres/init.sql`

### 3. Start the backend

Open a new terminal:

```bash
cd backend
cp .env.example .env
npm install
```

Then update `backend/.env`, and after that run `npm run dev`:

- set real or test SMTP credentials for:
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_USER`
  - `SMTP_PASS`
- add:
  - `FRONTEND_URL=http://localhost:3001`

Important:

- signup sends a verification email during account creation
- the placeholder SMTP values from `backend/.env.example` are not usable as-is
- if you keep the example SMTP values, signup will fail with an internal email-delivery error

Start the backend after updating the file:

```bash
npm run dev
```

Backend defaults:

- API base URL: `http://localhost:3000/api`
- health check: `http://localhost:3000/health`

### 4. Start the web app

Open another terminal:

```bash
cd web
printf 'NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api\n' > .env.local
npm install
npm run dev -- --port 3001
```

This keeps the web app on a fixed local port while the backend stays on `3000`.

Local web defaults for this setup:

- web app: `http://localhost:3001`
- backend API: `http://localhost:3000/api`

### 5. Verify the local MVP

Once the database, backend, and web app are running, you should be able to:

- open the web UI at `http://localhost:3001`
- sign up and verify email, as long as valid SMTP credentials are configured
- sign in
- complete a profile
- create and list help requests
- use the currently available volunteer / availability flows exposed by the backend

You can also verify backend health directly:

```text
GET http://localhost:3000/health
```

## Local MVP notes

- The database schema source of truth is `infra/docker/postgres/init.sql`.
- Keep real credentials out of the repository; use local `.env` files.
- The backend is the main source of implemented MVP functionality.
- The web app is the easiest way to exercise the local MVP end to end.
- The Android project is present in the repository, but mobile setup is separate from the main root quick-start flow.
- The web app does not proxy `/api` to the backend by default in this repository, so `NEXT_PUBLIC_API_BASE_URL` should be set explicitly for local development.

## Useful module READMEs

- `backend/README.md` — backend API scope, setup, tests, and conventions
- `web/README.md` — web app purpose and local run steps
- `android/README.md` — Android project purpose and local dev notes
- `infra/README.md` — Docker Compose and database bootstrap notes

## Default local ports

- backend: `3000`
- postgres: `5432`

## Current emphasis

This repository should be read as an **MVP-first project**:

- the main goal is to make the included flows runnable locally
- the backend and database setup are the backbone of the MVP
- the root quick-start is intended to get a new reader running fast
