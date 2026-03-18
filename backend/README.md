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

1. Copy `backend/.env.example` to `backend/.env`
2. Install dependencies with `npm install`
3. Start the server with `npm run dev`

The server exposes:

- `GET /health`
- `GET /api`
- `GET /api/auth`
- `GET /api/profiles`
- `GET /api/help-requests`
- `GET /api/availability`

## Database note

The shared PostgreSQL schema already lives in `infra/docker/postgres/init.sql`. This scaffold only prepares configuration and a reusable DB pool helper without implementing feature logic yet.
