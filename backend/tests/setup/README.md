# Test Setup

This folder contains Jest setup files used by backend tests.

## Prerequisites

1. Docker Desktop must be running.
2. PostgreSQL test container must be up before running integration tests.
3. Backend dependencies must be installed.

## Start Test Database (Docker)

From repository root:

```powershell
docker compose -f infra/dcompose/docker-compose-dev.yml up -d postgres
```

Check container status:

```powershell
docker compose -f infra/dcompose/docker-compose-dev.yml ps
```

Stop container when you are done:

```powershell
docker compose -f infra/dcompose/docker-compose-dev.yml down
```

## Run Tests

From `backend` folder:

```powershell
npm install
npm run test:unit
npm run test:integration
```

Run both unit and integration tests together:

```powershell
npm run test -- tests/unit/modules/profiles tests/integration/modules/profiles/profiles.integration.test.js
```

If PowerShell blocks npm script execution, use:

```powershell
npm.cmd run test:integration
```

## Notes

- Integration tests use a dedicated test database (`POSTGRES_DB` from test environment settings).
- `global-setup.js` prepares database/schema before integration tests.
- `global-teardown.js` closes DB pool after test run.
