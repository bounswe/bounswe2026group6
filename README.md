# Neighborhood Emergency Preparedness Hub

CMPE354 Group 6 repository.

## Project Overview

**Domain:** Disaster preparedness, community resilience

**Description:** Helps individuals prepare for emergencies and connects neighbors for mutual aid; works offline during actual disasters.

**Technical Challenges:**

- Offline-first architecture with service workers
- Data synchronization conflicts
- Progressive web app optimization
- Battery-efficient design
- Intermittent connectivity handling

**Bridging Effect:** Connects those with resources/skills (medical training, generators) to those in need during emergencies; builds neighborhood resilience networks.

## Project Structure

```text
.
├── web/        # Web app
├── android/    # Android mobile app
├── backend/    # API and server logic
├── docs/       # Reports, notes, and documentation
├── infra/      # Docker, compose, nginx, scripts, and infrastructure-related files
└── .github/    # Issue templates and workflows
```

## Team Notes

- For shared backend API rules and the error contract, refer to the `Shared API Conventions` section in `backend/README.md`.

## Current Runnable Scope

- PostgreSQL is runnable via Docker Compose from `infra/dcompose`.
- Backend scaffold is runnable locally with Node.js from `backend/`.
- `web/` and `android/` are currently project skeletons.

## Prerequisites

- Git
- Docker Desktop (or Docker Engine + Compose plugin)
- Node.js 20 LTS (recommended) and npm

## Quick Start (Project)

1. Clone and enter repository.
2. Start database with Docker Compose:

```bash
cd infra/dcompose
cp .env.example .env
docker compose -f docker-compose-dev.yml up -d
```

3. Start backend API in another terminal:

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

4. Verify service health:

```text
GET http://localhost:3000/health
```

## Common Notes For Everyone

- Keep secrets in local `.env` files; never commit real credentials.
- Database schema source of truth: `infra/docker/postgres/init.sql`.
- Default ports:
  : backend `3000`
  : postgres `5432`
- Backend API conventions and error contract live in `backend/README.md` under `Shared API Conventions`.
