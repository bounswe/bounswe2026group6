# Android offline-first architecture

The Android client now treats local persistence as the canonical read source for NEPH's emergency-critical mobile flows. Network calls synchronize Room state with the backend; Compose screens render cached Room data and queue writes locally before WorkManager pushes them.

## Implemented data ownership

| Domain | Local source of truth | Offline writes | Sync/conflict policy |
| --- | --- | --- | --- |
| Help requests | `help_requests` Room table | Create request, mark request resolved | Local writes are queued as `sync_operations`. Creates keep a client `local_*` id until the server id arrives. Status conflicts with terminal server state become `CONFLICTED` instead of silently overwriting local intent. |
| Helper availability | `availability_state` Room table | Toggle available/unavailable | Toggles are recorded locally and batched through `/availability/sync`. Latest local intent remains visible until sync succeeds. |
| Assigned request | `assigned_requests` Room table | Release/cancel assignment | Release is queued as durable WorkManager-backed work. The assigned request remains visible with pending/failed sync state until backend reconciliation. |
| Sync queue | `sync_operations` Room table | All queued mutations | Operations are replayed oldest-first. Stale `IN_PROGRESS` operations are reset to `PENDING` at sync start after a 15-minute recovery timeout so interrupted workers do not strand queued writes. |

## Runtime flow

1. `MainActivity` initializes `NephDatabaseProvider`, repositories, and WorkManager sync without blocking startup on Room reads.
2. Screens observe Room-backed `Flow`s, so cached content renders immediately.
3. User actions write to Room first with `PENDING_CREATE`, `PENDING_UPDATE`, or `PENDING_DELETE` metadata.
4. `OfflineSyncScheduler` enqueues unique WorkManager work with connected-network constraints and exponential backoff.
5. `OfflineSyncWorker` first recovers stale `IN_PROGRESS` rows older than 15 minutes back to `PENDING`, then drains the queue, pushes pending writes, and pulls fresh help requests, availability, assigned request state, and guest-tracked requests.
6. Sync failures keep cached data visible and surface `FAILED`/`CONFLICTED` state in the UI with retry affordances where critical.
7. Auth expiry (`401`) clears the local access token through an observable session store, keeps auth-required queued operations pending, and lets protected routes redirect back to login instead of silently failing.

## Battery and disaster-use choices

- One-time sync work is unique and delayed briefly to batch reconnect/toggle bursts.
- Periodic sync runs every 30 minutes only when connected and battery is not low.
- Critical writes do not block on network availability.
- Cached data is not cleared when refresh fails.

## Database and migration notes

- New Room database: `neph-offline.db`, schema version `1`.
- Existing SharedPreferences availability state is migrated into Room on first initialization.
- There was no prior Room schema, so no Room migration class is required for this change.
- New Gradle dependencies: Room runtime/ktx/compiler via KSP, WorkManager runtime-ktx, and unit-test dependencies.

## Tests

New unit tests cover:

- local help request entity creation and backend JSON payload mapping
- conflict policy for remote terminal-state mismatches
- retry policy for transient vs non-retryable sync failures
- stale `IN_PROGRESS` recovery policy for interrupted sync attempts

Run from `android/`:

```bash
# Unit tests use the e2e build type because androidTest is pinned to the
# fake-backend E2E variant in `android/app/build.gradle`.
./gradlew :app:testE2eUnitTest
./gradlew :app:compileDebugKotlin
```

## Known limitations

- Profile editing still uses the existing SharedPreferences-backed profile repository and online save path. The disaster-critical help request, availability, and assignment flows are Room/WorkManager offline-first.
- There is no advanced conflict-resolution UI yet; conflicted records are preserved locally and labelled for review rather than discarded.
