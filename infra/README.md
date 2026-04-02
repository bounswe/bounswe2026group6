# Infra

This folder contains local infrastructure files for the Neighborhood Emergency Preparedness Hub MVP.

## Purpose

Infrastructure files in this folder support local development, especially the database runtime used by the backend.

## Included folders

- `dcompose/` — Docker Compose files and local environment setup
- `docker/` — Docker-related assets, including PostgreSQL initialization
- `nginx/` — nginx-related files if reverse-proxy setup is needed later

## Local PostgreSQL setup

The main local infrastructure flow is starting PostgreSQL with Docker Compose.

From `infra/dcompose/`:

```bash
cp .env.example .env
docker compose -f docker-compose-dev.yml up -d
```

This Compose setup:

- starts PostgreSQL 16
- exposes the configured Postgres port to the host
- mounts the schema bootstrap file from:
  - `infra/docker/postgres/init.sql`

## Important files

- `dcompose/docker-compose-dev.yml` — local Postgres container setup
- `docker/postgres/init.sql` — database schema bootstrap script

## Notes

- This folder is part of the local MVP quick-start because the backend depends on the Postgres container.
- If you change database credentials or ports, update both the Compose `.env` file and the backend `.env` file accordingly.
