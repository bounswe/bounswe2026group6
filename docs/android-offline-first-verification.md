# Android offline-first verification guide

Use this guide to manually prove the NEPH Android app's offline-first behavior against a local backend. The recommended setup is Docker Compose for backend + PostgreSQL, Android Studio for the emulator, and SQL or authenticated `curl` for server-side verification.

This guide is intentionally local-first:

- do **not** use production web or a production admin page
- do **not** depend on any web admin UI
- prefer the Android emulator with `http://10.0.2.2:3000/api`
- verify backend sync with local PostgreSQL queries or authenticated `curl`

## 1. Local backend setup

From the repository root, start the local stack:

```bash
docker compose up --build
```

Expected URLs:

- host machine backend API base: `http://localhost:3000/api`
- Android emulator backend API base: `http://10.0.2.2:3000/api`

To identify the PostgreSQL container:

```bash
docker ps
```

If you need to confirm the database name or user, inspect:

- `docker-compose.yml`
- `backend/.env.example`

Current local defaults are:

- database service: `postgres`
- database name: `neph_db`
- database user: `neph_user`
- database password: `neph_pass`

## 2. Android emulator setup

1. Open `android/` in Android Studio.
2. Let Gradle sync finish.
3. Start an Android emulator.
4. Run the debug app.

The debug API base URL is configured in `android/app/build.gradle` and currently uses:

```text
http://10.0.2.2:3000/api
```

`10.0.2.2` is an Android emulator alias for the host machine's localhost. It does not work on a physical phone.

In the current repo state, the debug API base URL is hardcoded in `android/app/build.gradle`. If the app is unexpectedly calling the wrong backend during verification, update that debug `API_BASE_URL` value and reinstall the debug app before testing again.

The debug package name is:

```text
com.neph
```

## 3. Offline help request verification

This flow proves that a help request can be created offline, survives restart, and syncs after reconnect.

1. Start the backend with Docker Compose.
2. Run the Android debug app on the emulator.
3. Continue as guest or log in.
4. Turn emulator network off.

Preferred commands:

```bash
adb shell svc wifi disable
adb shell svc data disable
```

If you need airplane mode instead, this sometimes works on emulators and some devices, but it is less reliable across Android versions and OEM builds:

```bash
adb shell settings put global airplane_mode_on 1
adb shell am broadcast -a android.intent.action.AIRPLANE_MODE --ez state true
```

5. In the app, tap the large **Create Help Request** button on Home.
6. Expected Android result:
   - a help request draft is accepted locally immediately
   - a generic fatal network error is **not** shown
   - the app opens the existing request-help form for the same local draft
7. Fill the request-help form and submit it.
8. Expected Android result:
   - the form updates the same local request instead of creating a second request
   - if current/profile coordinates were available on the draft, they remain attached to the queued payload
9. Open **My Help Requests**.
10. Expected Android result:
   - the request is still visible while offline
   - its status should be consistent with the offline-first UI, for example pending/local messaging such as `Saved locally. NEPH will sync this change when the network is available.`
11. Force-stop the app:

```bash
adb shell am force-stop com.neph
```

12. Reopen the app while still offline.
13. Expected Android result:
    - the pending request is still visible after restart
14. Turn network back on:

```bash
adb shell svc wifi enable
adb shell svc data enable
```

If you enabled airplane mode, reverse those settings:

```bash
adb shell settings put global airplane_mode_on 0
adb shell am broadcast -a android.intent.action.AIRPLANE_MODE --ez state false
```

15. Wait for WorkManager sync, or open **My Help Requests** again to trigger sync-related refresh.
16. Expected Android result:
    - the pending request eventually leaves the local-only pending state
    - the request appears on the backend when verified with SQL or `curl`

## 4. Offline availability verification

This flow proves that helper availability can be toggled offline, survives restart, and syncs after reconnect.

Prerequisite for auth-required verification:

- availability routes require authentication
- login requires an existing user whose email is already verified
- the authenticated availability flow should use a user with a completed profile, otherwise login can route to profile completion before returning to home
- enable **Remember me** during login if you want the authenticated session to survive `adb shell am force-stop com.neph`
- if you create a local user but do not have working SMTP in your local setup, mark the user verified directly in PostgreSQL before logging in:

```sql
UPDATE users
SET is_email_verified = TRUE
WHERE email = '<EMAIL>';
```

If the user does not already have a profile row, create or complete it before starting the offline availability flow. The app only shows the **Available to Help** card after a successful authenticated path back to `home`.

1. Start the backend.
2. Run the Android debug app on the emulator.
3. Launch the app and go through the real authenticated path:
   - `welcome`
   - `login`
   - tap **Continue with Email**
   - enter email and password
   - check **Remember me**
   - log in until you land on `home`
4. Confirm the **Available to Help** card is visible on the home screen.
5. Turn emulator network off:

```bash
adb shell svc wifi disable
adb shell svc data disable
```

6. Toggle **Available to Help** on or off while offline.
7. Expected Android result:
   - the toggle change is accepted offline
   - the latest availability state remains visible locally
   - the app shows local-save feedback such as `Availability saved locally and will sync when connected.` or `Unavailable status saved locally and will sync when connected.`
   - the app may show pending-sync messaging such as `Pending sync — your latest availability is saved on this device.`
8. Force-stop the app:

```bash
adb shell am force-stop com.neph
```

9. Reopen the app while still offline.
10. Expected Android result:
    - the availability state is preserved locally after restart
    - the app returns to authenticated `home` instead of dropping back to `welcome`, which is why **Remember me** is required for this particular restart check
11. Turn network back on:

```bash
adb shell svc wifi enable
adb shell svc data enable
```

12. Wait for WorkManager sync after reconnect, then return to the home screen to confirm the synced state.
13. Verify the backend state with SQL or authenticated `curl`.

Troubleshooting for the authenticated availability flow:

- If you land on **Complete Profile** instead of `home`, finish the profile once before starting the offline availability scenario.
- If login says the email is not verified, update `users.is_email_verified = TRUE` and try again.
- If the **Available to Help** card is missing, you are not on an authenticated `home` state.
- If force-stop returns you to `welcome`, rerun the flow with **Remember me** enabled.
- If reconnect does not sync an authenticated availability change, log in again before concluding the queue is broken. Auth-required sync work can remain pending after a session-expiry path.

## 5. SQL verification

Use local PostgreSQL queries instead of any admin page.

First, identify the Postgres container:

```bash
docker ps
```

Then open `psql` inside the container, replacing `<POSTGRES_CONTAINER>` if needed:

```bash
docker exec -it <POSTGRES_CONTAINER> psql -U neph_user -d neph_db
```

If your local env overrides the defaults, use the values from `docker-compose.yml` or your local `.env`.

### Help requests

```sql
SELECT request_id, user_id, description, status, created_at
FROM help_requests
ORDER BY created_at DESC
LIMIT 10;
```

### Volunteer availability

```sql
SELECT volunteer_id, user_id, is_available, location_updated_at
FROM volunteers
ORDER BY location_updated_at DESC NULLS LAST
LIMIT 10;
```

```sql
SELECT availability_id, volunteer_id, is_available, stored_locally, synced_at
FROM availability_records
ORDER BY synced_at DESC
LIMIT 20;
```

What to look for:

- the offline-created help request eventually appears in `help_requests`
- the volunteer's latest availability state appears in `volunteers`
- availability sync writes appear in `availability_records`

## 6. Authenticated `curl` verification

Use `curl` when you want API-level confirmation instead of direct SQL.

### Login

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your@email.com",
    "password": "yourpassword"
  }' | jq
```

Notes:

- the user must already exist
- the user's email must already be verified, or login will fail
- if local SMTP is not configured, you can verify a local test user directly in PostgreSQL:

```sql
UPDATE users
SET is_email_verified = TRUE
WHERE email = '<EMAIL>';
```

The response includes `accessToken`.

### List help requests

```bash
curl -s http://localhost:3000/api/help-requests \
  -H "Authorization: Bearer <ACCESS_TOKEN>" | jq
```

### Check availability status

```bash
curl -s http://localhost:3000/api/availability/status \
  -H "Authorization: Bearer <ACCESS_TOKEN>" | jq
```

### Optional guest verification for a guest-created help request

`POST /api/help-requests` is guest-accessible. Guest create responses include a `guestAccessToken`, and guest reads can use `x-help-request-access-token`.

```bash
curl -s http://localhost:3000/api/help-requests/<REQUEST_ID> \
  -H "x-help-request-access-token: <GUEST_ACCESS_TOKEN>" | jq
```

## 7. Local Room database inspection

The Android debug app uses the Room database:

```text
neph-offline.db
```

Optional commands for inspecting the local app database from a debuggable build:

```bash
adb shell run-as com.neph ls databases
adb exec-out run-as com.neph cat databases/neph-offline.db > neph-offline.db
sqlite3 neph-offline.db
```

Example SQLite queries:

```sql
.tables
SELECT localId, remoteId, status, syncStatus, description FROM help_requests;
SELECT * FROM availability_state;
SELECT operationId, entityType, entityId, operationType, status, attemptCount, error FROM sync_operations;
SELECT assignmentId, requestId, syncStatus, pendingError FROM assigned_requests;
```

For availability-focused verification, these local tables are the most useful checkpoints:

- `availability_state` confirms the current local on/off state and sync status
- `sync_operations` confirms that the offline toggle was queued before reconnect

Notes:

- prefer Android Studio Database Inspector when convenient
- `run-as` works for debuggable builds and may not work the same way on every device

## 8. Physical phone APK notes

`10.0.2.2` only works on the Android emulator.

For a physical phone, use one of these options instead:

- your laptop LAN IP
- `adb reverse`
- a staging or production backend, only if you are intentionally doing integration testing there

Get your laptop LAN IP on macOS:

```bash
ipconfig getifaddr en0
```

In the current repo state, the debug API base URL is hardcoded in `android/app/build.gradle`.

For a physical phone test build, temporarily edit the debug `API_BASE_URL` in `android/app/build.gradle` to one of these values, then rebuild:

- `http://<LAPTOP_IP>:3000/api` for LAN testing
- `http://127.0.0.1:3000/api` when using `adb reverse`

Install the APK:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Example reverse port forwarding:

```bash
adb reverse tcp:3000 tcp:3000
```

Rebuild after changing the debug API base URL:

```bash
./gradlew :app:assembleDebug
```

Warnings:

- `adb reverse` is per connected device and disappears after disconnect
- `http://127.0.0.1:3000/api` with `adb reverse` is for a physical device path, while `http://10.0.2.2:3000/api` remains emulator-only
- restore the debug `API_BASE_URL` in `android/app/build.gradle` after a physical-device test build so emulator verification keeps using the intended backend
- do not use production unless you intentionally want production integration testing
- this verification guide is designed for local Docker + emulator first

## 9. Final acceptance checklist

- [ ] Help request accepted offline
- [ ] Request visible as pending
- [ ] Request survives force-stop/reopen
- [ ] Request appears in backend after reconnect
- [ ] Availability toggle accepted offline
- [ ] Availability persists after restart
- [ ] Availability appears in backend after reconnect
- [ ] No production web/admin required
- [ ] Backend state confirmed with local SQL or authenticated `curl`

## 10. Verification after doc changes

Run:

```bash
git diff --check
```

If no Android code changed, no Gradle build is required.

If Android code changes are made in the future, run:

```bash
cd android && ./gradlew :app:compileDebugKotlin
```
