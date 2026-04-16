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
