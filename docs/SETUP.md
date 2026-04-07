# Setup and Run Guide

This document explains how to build and run the NEPH project for evaluation and development. It is written for someone who is familiar with common development tools but is new to this repository.

The project has three main parts:

- **backend**: API and business logic
- **web**: Next.js frontend
- **android**: mobile client
- **postgres**: local database used by the Dockerized stack

## Recommended evaluation path

For the easiest end-to-end setup, use the **Dockerized local stack** for:

- PostgreSQL
- backend
- web

The Android app is built and run separately.

---

## 1. Prerequisites

### For the recommended Dockerized setup
Install:

- Docker Desktop, or Docker Engine with the Compose plugin

Verify:

```bash
docker --version
docker compose version
```

### For optional non-Docker module development
Install:

- Node.js
- npm

Verify:

```bash
node -v
npm -v
```

### For Android development and mobile build
Install:

- Android Studio
- Android SDK required by the project
- a working Android emulator or physical Android device

---

## 2. Repository layout

Main folders:

- `backend/` — backend API
- `web/` — web frontend
- `android/` — Android application
- `infra/` — PostgreSQL bootstrap SQL and related infra files
- `docs/` — reports and project documents

Important Docker-related files:

- `docker-compose.yml`
- `backend/Dockerfile`
- `web/Dockerfile`
- `infra/docker/postgres/init.sql`

---

## 3. Environment files

Do **not** commit real secrets or private credentials.

### Backend environment
Start from:

- `backend/.env.example`

Create:

- `backend/.env`

Typical backend variables include:

- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL` if the backend supports a single connection string
- `JWT_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `APP_URL`
- `FRONTEND_URL`

Important note:

- Signup and email-verification flows require **real SMTP credentials**.
- Placeholder SMTP values from the example file are not enough for real email sending.

### Web environment
Start from:

- `web/.env.example`

Create, if needed:

- `web/.env.local`

Typical web variables include:

- `NEXT_PUBLIC_API_BASE_URL`
- `API_BASE_URL`

### Compose overrides
The root `docker-compose.yml` already contains sensible local defaults.
If you want to override them, you can export variables in your shell or use a local root `.env` file before running Compose.

Common Compose override variables:

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

---

## 4. Dockerized local setup for web + backend + database

This is the main path for local evaluation.

### Step 1 — go to the repository root

```bash
cd bounswe2026group6
```

### Step 2 — review environment examples

Review:

- `backend/.env.example`
- `web/.env.example`

If your backend needs a local env file even when using Compose, create it from the example:

```bash
cp backend/.env.example backend/.env
```

If your web module needs a local env file outside Compose, create it as needed:

```bash
cp web/.env.example web/.env.local
```

### Step 3 — start the local stack

From the repository root:

```bash
docker compose up --build
```

This starts:

- PostgreSQL on `localhost:5432`
- backend on `http://localhost:3000`
- web on `http://localhost:3001`

### Step 4 — verify that services are running

Open:

- web app: `http://localhost:3001`
- backend API base: `http://localhost:3000/api`
- backend health check: `http://localhost:3000/health`

Expected behavior:

- PostgreSQL is initialized from `infra/docker/postgres/init.sql`
- backend waits for PostgreSQL health before starting
- web connects to the backend through the configured local API URLs

### Step 5 — stop the stack

```bash
docker compose down
```

To stop and also remove volumes:

```bash
docker compose down -v
```

### Useful rebuild commands

Rebuild and restart:

```bash
docker compose up --build
```

Start in detached mode:

```bash
docker compose up -d --build
```

View logs:

```bash
docker compose logs -f
```

View logs for a single service:

```bash
docker compose logs -f backend
docker compose logs -f web
docker compose logs -f postgres
```

---

## 5. What is Dockerized and what is not

### Included in Docker Compose
- PostgreSQL
- backend API
- web application

### Not included in Docker Compose
- Android application
- release workflows
- external deployment infrastructure

The Android client is part of the same repository, but it is built and run separately.

---

## 6. Optional non-Docker development

If you want to run modules directly on your machine instead of using Compose, use the module-specific setup.

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### Web

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

### Notes
- In non-Docker mode, make sure backend and web environment variables point to the correct host URLs.
- If you run PostgreSQL outside Docker, update database connection values accordingly.

---

## 7. Android setup and mobile build

The Android application lives in `android/`.

### Important API base URL note
For Android emulator-based local development, the backend is typically reached through:

```text
http://10.0.2.2:3000
```

This is the emulator bridge address for the host machine.

### Option A — run from Android Studio
1. Open the `android/` project in Android Studio.
2. Sync Gradle.
3. Make sure the API base URL points to the local backend.
4. Start the backend locally or through Docker Compose.
5. Run the app on an emulator or physical device.

### Option B — build from the command line
From the Android project directory:

```bash
cd android
./gradlew assembleDebug
```

For a release build:

```bash
./gradlew assembleRelease
```

Generated APKs are typically placed under:

```text
android/app/build/outputs/apk/
```

### Install the APK
You can install the debug APK through Android Studio or with `adb`:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

If you are using a release APK, install the correct generated release file instead.

---

## 8. Mobile evaluation path

For mobile evaluation, use one of these paths:

### Path A — use the built APK
- Obtain the generated APK from the Android build output or the release assets
- Install it on an emulator or Android device
- Make sure the backend is reachable from the app

### Path B — build locally
- Open the Android module in Android Studio
- sync Gradle
- run a debug build or release build
- install and test on emulator or device

---

## 9. Build consistency and release note

The repository includes Android build automation separately from the local Docker setup.

For local evaluator setup:

- web + backend + database are run through Docker Compose
- Android is built and installed separately

This keeps the main evaluation path simple while still supporting mobile build workflows.

---

## 10. Troubleshooting

### Backend starts but signup fails
Most likely cause:

- SMTP settings are still placeholders

Fix:

- set real `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS`

### Web cannot reach backend
Check:

- backend is running on `localhost:3000`
- `NEXT_PUBLIC_API_BASE_URL` points to `http://localhost:3000/api`
- `API_BASE_URL` is correct for server-side requests

### Backend cannot connect to PostgreSQL
Check:

- PostgreSQL container is healthy
- database env values match the Compose configuration
- if using Docker Compose, backend should connect to host `postgres`, not `localhost`

### Android app cannot reach the local backend
Check:

- backend is running
- emulator uses `http://10.0.2.2:3000`
- physical device is on the same network and uses the correct reachable host/IP

---

## 11. Quick verification checklist

A correct local setup should allow you to do the following:

- start PostgreSQL, backend, and web with `docker compose up --build`
- open the web app at `http://localhost:3001`
- reach the backend at `http://localhost:3000/api`
- confirm backend health at `http://localhost:3000/health`
- build the Android app from Android Studio or Gradle
- install the APK on an emulator or device
- connect the mobile app to the running backend

---

## 12. Summary

### Recommended evaluator path
- use Docker Compose for PostgreSQL + backend + web
- build and run Android separately

### Main commands

Start local stack:

```bash
docker compose up --build
```

Stop local stack:

```bash
docker compose down
```

Build Android debug APK:

```bash
cd android
./gradlew assembleDebug
```

Build Android release APK:

```bash
cd android
./gradlew assembleRelease
```

This setup provides a clear path for building and running both the web stack and the mobile client from the repository.