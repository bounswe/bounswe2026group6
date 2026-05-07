# Android

This folder contains the Android application project for the Neighborhood Emergency Preparedness Hub.

## Purpose

The Android module is the mobile app codebase for the project.

## Current project status

- Android project structure is present
- Gradle wrapper is included
- local debug API base URL is configured in the app module

## Local development notes

The debug build is configured to talk to the backend through the Android emulator host bridge:

- `http://10.0.2.2:3000/api`

That value is defined in:

- `android/app/build.gradle`

## Open and run

Recommended approach:

1. Open `android/` in Android Studio
2. Let Gradle sync finish
3. Make sure the backend is running locally on port `3000`
4. Run the debug build on an emulator

## Important files

- `app/build.gradle` — Android app module config and API base URL
- `build.gradle` — project-level Gradle config
- `gradlew` / `gradlew.bat` — Gradle wrapper


## Offline-first mobile data layer

The Android app now includes a Room + WorkManager offline-first layer for the emergency-critical mobile flows: help requests, helper availability, assigned requests, and the durable sync queue. Compose screens read these flows from local Room state first; writes are recorded locally and synchronized later by WorkManager when network constraints allow.

Details, entities, conflict policy, and test commands are documented in:

- `../docs/android-offline-first.md`

Migration/config notes:

- Room database name: `neph-offline.db`, schema version `1`
- Existing availability SharedPreferences are migrated into Room on first app start
- No prior Room schema existed, so no migration class is required for this milestone
- Required dependencies are declared in `app/build.gradle` (`room-*`, `work-runtime-ktx`, KSP)

## Notes

- The root quick-start focuses on the database, backend, and web MVP flow first.
- Android setup is available separately for local mobile development.

## Android instrumentation E2E tests

The Android app now includes instrumentation coverage for key mobile journeys:

- continue as guest to the home screen
- forgot-password flow through the reset-password entry screen
- authenticated session navigation to profile and privacy/security flows

Run them with an emulator connected:

```bash
./gradlew :app:connectedE2eAndroidTest
```

Notes:

- The instrumentation suite runs the app against a test-only MockWebServer endpoint (`http://127.0.0.1:13006/api`) so production networking code still performs real HTTP requests while tests stay deterministic.
- The `e2e` build type is used only for instrumentation tests; release builds keep their production API base URL and do not include the fake backend.

## Release CI secrets

`android/app/google-services.json` is intentionally gitignored. The Android release workflow reconstructs it from a GitHub Actions secret at build time.

Required repository secrets for `.github/workflows/android-release.yml`:

- `ANDROID_GOOGLE_SERVICES_JSON_BASE64` (base64 of `google-services.json`)
- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `NEPH_RELEASE_API_BASE_URL`
