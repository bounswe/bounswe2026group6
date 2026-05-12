# NEPH 1.0.0 Final Release Notes

Live deployment:

- Web application: https://neph.app/
- Backend API: https://api.neph.app/api

Release tag: `final-milestone`

## Summary

NEPH 1.0.0 is the final production release for the emergency help coordination platform. It includes the deployed web admin/dashboard experience, the Android mobile application for requesters and volunteers, production Docker setup, database migrations with final demo seed data, and release-ready setup documentation.

## Highlights

- Web application for administration, deployment monitoring, user management, emergency history, and assignment visibility.
- Android mobile application for onboarding, profile completion, availability, emergency help request creation/editing, assigned requests, resource maps, gathering areas, emergency numbers, and settings.
- Backend API with authentication, profile, help request, volunteer, assignment, notification, map/resource, and admin routes.
- Docker Compose based local deployment with PostgreSQL, backend, and web services.
- Normal migration flow seeds Boğaziçi final demo data so evaluators can log in immediately after setup.
- Environment examples are included for backend, web, Docker Compose overrides, and Android mobile builds.

## Default demo credentials

All listed demo users use password: `DemoPass123!`

- Admin: `bogazici_admin@neph.test`
- Requester: `bogazici_requester_new_hall@neph.test`
- Volunteer/responder: `bogazici_assigned_1@neph.test`
- Additional demo users are documented in the root `README.md`.

## Mobile artifact

Attach the signed Android release APK generated from the Android release workflow or local Gradle release build to this GitHub Release before publishing it as the official, non-pre-release `1.0.0` release.

## Verification checklist before publishing

- The final commit is merged to the default `main` branch.
- The tag `final-milestone` points to the final commit on `main`.
- The GitHub Release name is `1.0.0`.
- The release is marked as an official release, not as a pre-release.
- The signed Android `.apk` is attached to the GitHub Release.
- https://neph.app/ loads successfully.
- https://api.neph.app/health returns a healthy response.
