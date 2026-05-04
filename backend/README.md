# Backend

This folder contains the Node.js + Express backend API for the Neighborhood Emergency Preparedness Hub MVP.

## MVP scope

The backend is the main implementation layer of the current MVP.

Main feature areas:

- `src/modules/auth` — signup, login, email verification, access control
- `src/modules/profiles` — user profile, privacy, health, and location data
- `src/modules/help-requests` — request creation, tracking, and status updates
- `src/modules/availability` — volunteer availability, matching, and assignment-related flows
- `src/modules/location` — country tree, geocoding search, and reverse geocoding support
- `src/modules/gathering-areas` — nearby disaster assembly and shelter points via Overpass

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
npm run migrate
npm run dev
```

Migration files are read from:

- `migrations/`

Team migration rules:

- `migrations/README.md`

### 3. Verify backend health

```text
GET http://localhost:3000/health
```

## Important endpoints

The backend exposes these top-level module paths (concrete endpoints are listed below):

- `GET /health`
- `GET /api`
- `GET /api/auth`
- `GET /api/profiles`
- `GET /api/help-requests`
- `GET /api/availability`
- `GET /api/location`
- `GET /api/gathering-areas`
- `GET /api/notifications`

Location module endpoints:

- `GET /api/location/tree?countryCode=TR`
- `GET /api/location/search?q=<text>&countryCode=TR&limit=10`
- `GET /api/location/reverse?lat=<number>&lon=<number>`

Gathering areas module endpoints:

- `GET /api/gathering-areas/nearby?lat=<number>&lon=<number>&radius=<int>&limit=<int>`
- returns GeoJSON `FeatureCollection` under `collection.features`
- default `radius=2000` (meters), max `10000`
- default `limit=20`, max `50`
- maps provider failures to standard error response:
  - `503 OVERPASS_UNAVAILABLE`
  - `504 OVERPASS_TIMEOUT`

Sample nearby response:

```json
{
  "center": { "lat": 41.01, "lon": 29.01 },
  "radius": 1500,
  "source": "overpass",
  "meta": {
    "requestedLimit": 10,
    "returnedCount": 2
  },
  "collection": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "geometry": {
          "type": "Point",
          "coordinates": [29.011, 41.011]
        },
        "properties": {
          "id": "123456",
          "osmType": "node",
          "name": "Sample Assembly Area",
          "category": "assembly_point",
          "distanceMeters": 145,
          "rawTags": {
            "name": "Sample Assembly Area",
            "emergency": "assembly_point"
          }
        }
      }
    ]
  }
}
```

Location payload compatibility:

- Existing payloads for `PATCH /api/profiles/me/location` and `POST /api/help-requests` remain valid.
- Hybrid payloads are also supported (administrative + coordinate fields together).

Hybrid location payload example:

```json
{
  "location": {
    "country": "turkiye",
    "city": "istanbul",
    "district": "besiktas",
    "neighborhood": "levazim",
    "extraAddress": "Bina B",
    "displayAddress": "Levazim, Besiktas, Bina B",
    "coordinate": {
      "latitude": 41.043,
      "longitude": 29.009,
      "source": "MANUAL_MAP_PIN",
      "capturedAt": "2026-04-18T11:20:00.000Z"
    }
  }
}
```

Help request endpoints:

- `POST /api/help-requests` creates a help request for an authenticated user or guest when guest creation is enabled.
- `GET /api/help-requests` lists the authenticated user's requests.
- `GET /api/help-requests/:requestId` returns an authenticated user's request, or a guest request when `x-help-request-access-token` is provided.
- `PATCH /api/help-requests/:requestId` replaces editable request details with the same payload shape as create. Resolved and cancelled requests cannot be edited. Guest updates must send `x-help-request-access-token`.
- `PATCH /api/help-requests/:requestId/status` updates status to `SYNCED`, `RESOLVED`, or `CANCELLED`. Guest status updates must send `x-help-request-access-token`.
- `GET /api/help-requests/active` lists active visible requests for map/visibility consumers.

Notification module endpoints:

- `POST /api/notifications` (admin-only manual trigger endpoint)
- `GET /api/notifications?limit=<int>&cursor=<base64>&unreadOnly=<bool>`
- `PATCH /api/notifications/:notificationId/read`
- `PATCH /api/notifications/read-all`
- `POST /api/notifications/devices/register`
- `POST /api/notifications/devices/unregister`
- `GET /api/notifications/preferences`
- `PATCH /api/notifications/preferences`
- `GET /api/notifications/preferences/types`
- `PATCH /api/notifications/preferences/types`
- `GET /api/notifications/unread-count`
- `GET /api/notifications/admin/stats` (admin)
- `POST /api/notifications/admin/broadcast/emergency` (admin, location-filtered broadcast)

Notification payload shape (mobile contract):

```json
{
  "id": "8fd6f7fc-35cf-4a25-b12a-c09008d58bc9",
  "type": "HELP_REQUEST_STATUS_CHANGED",
  "title": "Request updated",
  "body": "Your help request is now matched with a volunteer.",
  "isRead": false,
  "createdAt": "2026-04-22T19:47:03.781Z",
  "readAt": null,
  "actorUserId": "user_actor_1",
  "entity": {
    "type": "HELP_REQUEST",
    "id": "request_123"
  },
  "data": {
    "screen": "request-details",
    "requestId": "request_123"
  }
}
```

Push notification infrastructure:

- register device token with `POST /api/notifications/devices/register`
- unregister device token with `POST /api/notifications/devices/unregister`
- each notification write creates an in-app delivery record
- if user has active devices, push delivery attempts are recorded per device
- user push preference is managed via `/api/notifications/preferences`

Push env:

- `PUSH_DELIVERY_MODE=log` (default) logs push attempts without external provider call
- `PUSH_DELIVERY_MODE=disabled` disables push attempts
- `PUSH_DELIVERY_MODE=fcm` enables real FCM push delivery via Firebase Admin SDK
- `FIREBASE_SERVICE_ACCOUNT_PATH=secrets/firebase-service-account.json` points to service account JSON (relative to `backend/`)
- `NOTIFICATION_RETENTION_DAYS=90` controls cleanup horizon for old notifications
- `NOTIFICATION_JOBS_ENABLED=true` enables periodic notification jobs (default is `false`)
- `NOTIFICATION_JOB_INTERVAL_MS=300000` controls job runner frequency
- `NOTIFICATION_JOB_BATCH_SIZE=100` max records processed per cycle
- `NOTIFICATION_AVAILABILITY_REMINDER_MINUTES=120` reminder threshold for available volunteers
- `NOTIFICATION_AVAILABILITY_REMINDER_COOLDOWN_MINUTES=180` minimum time between reminder notifications
- `NOTIFICATION_PENDING_REQUEST_TTL_HOURS=72` auto-cancels stale pending help requests
- `HELP_REQUEST_GUEST_CREATE_ENABLED=true` allows guest help-request creation without auth
- `HELP_REQUEST_GUEST_MATCHING_ENABLED=false` keeps guest-created requests out of auto-matching (recommended)
- `HELP_REQUEST_GUEST_TOKEN_TTL=2h` controls guest access token expiry for guest request read/update

Cleanup job:

- `npm run cleanup:notifications`

## Environment notes

Create a local environment file first:

```bash
cp .env.example .env
```

Important notes:

- when backend runs on host and Postgres runs via Docker on the host machine, use `POSTGRES_HOST=localhost`
- if backend later runs in the same Docker network as Postgres, use `POSTGRES_HOST=postgres`

Location provider and cache env vars:

- `NOMINATIM_BASE_URL` (default: `https://nominatim.openstreetmap.org`)
- `LOCATION_HTTP_TIMEOUT_MS` (default: `4500`)
- `LOCATION_CACHE_TTL_MS` (default: `300000`)
- `LOCATION_CACHE_MAX_ENTRIES` (default: `500`)

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
