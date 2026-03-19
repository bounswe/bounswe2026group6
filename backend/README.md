# Backend

Minimal shared backend scaffold for the Neighborhood Emergency Preparedness Hub.

## Backend Team

- Rojhat Delibaş
- Mehmet Can Gürbüz
- Alper Kartkaya
- Berat Sayın

## Scope

This is a light initialization layer so the backend subgroup can start from the same structure before splitting implementation work.

For MVP, these areas are meant as practical work split guidelines, not strict architectural boundaries. Keep shared setup and small cross-cutting helpers simple instead of forcing hard separations too early.

Suggested MVP work split:

- `src/modules/auth` - signup, login, email verification, basic access control
- `src/modules/profiles` - profile, privacy, health, and location data
- `src/modules/help-requests` - request creation, request tracking, and status flow
- `src/modules/availability` - volunteer availability, matching, and assignment flow

Shared foundation should stay shared:

- `src/config` and `src/db` for common setup
- `src/routes` for top-level API wiring
- small reusable helpers can stay common if splitting them adds unnecessary complexity

## Run locally

Current recommended development flow is:

- PostgreSQL in Docker (`infra/dcompose`)
- Backend on host with Node.js (`backend/`)

1. Start PostgreSQL first:

```bash
cd infra/dcompose
cp .env.example .env
docker compose -f docker-compose-dev.yml up -d
```

2. Start backend:

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

3. Verify API health:

```text
GET http://localhost:3000/health
```

The server exposes:

- `GET /health`
- `GET /api`
- `GET /api/auth`
- `GET /api/profiles`
- `GET /api/help-requests`
- `GET /api/availability`

## Shared API Conventions

Use these as lightweight team defaults during MVP development.

- Error response format: `{ "code": "SOME_ERROR", "message": "Human readable message" }`
- Common status codes: `400` validation, `401` unauthorized, `403` forbidden, `404` not found, `409` conflict, `500` internal error
- Auth expectation: protected endpoints should read current user from `req.user.userId`
- Naming: prefer kebab-case for route paths (example: `/help-requests`)
- DB ownership rule: never let a user read or update another user's profile data without explicit authorization

## Database note

The shared PostgreSQL schema already lives in `infra/docker/postgres/init.sql`. This scaffold only prepares configuration and a reusable DB pool helper without implementing feature logic yet.

## Environment Notes

- When backend runs on host and DB runs in Docker, set `POSTGRES_HOST=localhost` in `backend/.env`.
- If backend later runs as a Docker service in the same compose network, use `POSTGRES_HOST=postgres`.
