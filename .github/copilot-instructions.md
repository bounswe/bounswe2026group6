# NEPH Copilot Instructions

These rules apply to all work in this repository unless a task explicitly says otherwise. Follow them before generating code, refactoring, reviewing, or proposing implementation steps.

## 1. General development rules

### Analyze the repository first
- Inspect the existing repository structure, file organization, naming, shared components, services, utilities, and local implementation patterns before making changes.
- Treat the current codebase as the source of truth for how this project is built.
- Infer structure and conventions from the repository instead of introducing new ones.

### Follow the current architecture and project patterns
- Respect the existing monorepo separation between `web`, `android`, `backend`, and infrastructure-related directories.
- Keep code in the correct layer and platform area.
- Do not reorganize folders, rename major modules, or introduce parallel architectural patterns unless explicitly requested.

### Make minimal, targeted, low-risk changes
- Implement only what the task requires.
- Avoid unrelated refactors, cleanup, file movement, dependency changes, speculative improvements, or extra abstractions.
- Keep changes focused, reviewable, and easy to justify in a PR.

### Reuse existing building blocks
- Reuse shared components, layout wrappers, services, validators, helpers, utilities, and design tokens whenever possible.
- Before creating something new, check whether the repository already has an equivalent or extensible solution.
- Prefer extending existing patterns over adding one-off implementations.

### Preserve existing behavior and think across layers
- Do not break working behavior outside the intended scope.
- When changing one layer, consider impact on the others, especially between backend, web, and Android.
- Be careful with request/response shapes, validation behavior, navigation flows, rendering states, and user-facing interactions.

### Keep NEPH product and UI consistency
- Preserve the existing NEPH product language across platforms.
- Prioritize consistency over creativity, simplicity over decoration, and readability over density.
- Follow the current red-white, light, calm, trustworthy UI direction.
- Do not introduce ad hoc colors, spacing, radii, shadows, component variants, or visually inconsistent patterns.
- Reuse shared UI building blocks and tokens instead of inventing one-off UI patterns.

### Match the repository's style and avoid invented output
- Match the naming, coding style, and local conventions used in nearby files.
- Generate code that fits this repository, not generic sample code.
- Do not invent endpoints, fields, routes, files, components, screens, or environment variables that do not clearly belong to the current codebase.
- Prefer clear, practical, maintainable solutions over clever or overly abstract ones.

## 2. Platform-specific expectations

### Web
- Follow the existing Next.js App Router structure, shared layout approach, and reusable component organization.
- Use existing shared layout wrappers, section patterns, and UI components before introducing new ones.
- Keep public pages, authenticated pages, and admin pages clearly separated according to the current project structure.

### Android
- Follow the existing Kotlin/Jetpack Compose structure, navigation setup, theme system, and feature/component organization.
- Reuse shared Compose UI components and theme tokens before creating screen-specific variants.
- Preserve the current navigation and screen organization patterns.
- For Request Help, keep a single `RequestHelpScreen` with guest and logged-in modes. Do not split it into separate guest and authenticated screens unless explicitly instructed.

### Backend
- Follow the current routing, validation, service, database, and error-handling conventions already used in the repository.
- Keep backend changes aligned with existing API contracts unless a contract change is explicitly required.
- Do not duplicate backend business rules on clients unless the repository already does so intentionally.

## 3. Use of standards

Apply recognized standards when a task touches structured data, maps/location data, accessibility, or authentication. Prefer standard-compliant solutions over custom formats, and keep implementations consistent across web, Android, and backend.

### Schema.org with JSON-LD
- Use Schema.org JSON-LD only on public, user-visible web pages where structured data is meaningful.
- Add JSON-LD in `<script type="application/ld+json">` blocks.
- Keep structured data aligned with the visible page content.
- Prefer official Schema.org types and properties. Do not invent custom structured-data fields when a standard field already exists.
- Do not add JSON-LD to authenticated, internal, or admin-only pages unless explicitly required.
- Use appropriate standard types such as `Person`, `NewsArticle`, `AskAction`, `Place`, and `GeoCoordinates` when they match the page content.

### GeoJSON (RFC 7946)
- Use GeoJSON as the default format for map and location-based data when it is sufficient.
- Use `Feature` for a single map item and `FeatureCollection` for multiple items.
- Use `Point` for single-location coordinates unless another geometry type is clearly required.
- Always store and return coordinates in `[longitude, latitude]` order.
- Put non-geometric metadata under `properties`.
- Do not invent custom map response shapes when GeoJSON already fits the use case.

### WCAG 2.1 Level AA
- Treat accessibility as a core requirement, especially because NEPH may be used in stressful or emergency-related situations.
- Use semantic HTML on web and accessible native UI patterns on Android.
- Ensure interactive elements are keyboard accessible where applicable.
- Always provide visible labels for inputs and form controls.
- Keep focus states clearly visible.
- Do not rely on color alone to communicate meaning, status, or urgency.
- Use readable contrast, meaningful error states, adequate touch targets, and simple, readable layouts.
- Prefer accessible shared UI components over one-off custom implementations.
- Use ARIA only when necessary and only in a correct, minimal way.

### JWT (RFC 7519)
- Use JWT as the standard authentication token format unless the existing project flow explicitly requires otherwise.
- Use the `Authorization: Bearer <token>` pattern for authenticated API calls.
- Validate JWTs consistently on protected backend routes.
- Do not hardcode secrets, signing keys, or production-like tokens.
- Do not expose tokens in logs, source code, screenshots, or unsafe examples.
- Follow secure, platform-appropriate storage practices and preserve the existing project authentication model.

### Standard-first rule
- When a task touches structured data, maps, accessibility, or authentication, first check whether one of these standards should shape the implementation.
- Do not replace these standards with custom alternatives unless explicitly instructed.
- Favor consistency and standard compliance over convenience shortcuts.

## 4. Database migrations

Use SQL migration files as the only normal way to change the database schema.

### Migration-first rule
- Any schema change must be made by adding a new SQL migration file under `backend/migrations`.
- Do not make routine schema changes by editing `infra/docker/postgres/init.sql`.
- Treat `init.sql` as bootstrap/reset setup, not as the normal schema-evolution path for feature work.

### Migration file naming and structure
- Name every migration file using this format: `YYYYMMDD_HHMMSS__short_description.sql`
- Use a clear, short, snake_case description.
- Keep each migration focused on one logical change whenever possible.
- Prefer small, reviewable migrations over large mixed schema changes.

### Never rewrite migration history
- Do not modify an existing migration file after it has been committed or shared.
- If a previous migration was wrong or incomplete, create a new migration that corrects it.
- Treat committed migration files as append-only project history.

### Write safe, additive migrations by default
- Prefer additive-safe changes such as creating new tables, adding new columns, adding indexes, or introducing new constraints carefully.
- Avoid destructive or risky schema changes unless they are explicitly required by the task.
- Do not remove or rename existing schema elements casually if web, Android, or backend code may still depend on them.
- Consider backward compatibility for existing API consumers and running environments before making schema changes.

### Keep migrations aligned with application code
- When a migration changes the schema, also update the affected backend code, validations, queries, and tests where needed.
- Do not leave the repository in a state where the migrated schema and backend code disagree.
- Consider downstream impact on both web and Android when changing data shape or field behavior.

### Test migrations locally before merge
- Run and verify migrations locally through the normal project workflow before merging.
- Treat migrations as production-impacting changes, especially for `main`.
- Do not assume a migration is safe without validating that the backend still starts and the affected flows still work.

### Migration review expectations
- Review migrations carefully for correctness, safety, scope, and compatibility.
- Avoid mixing unrelated cleanup or speculative schema redesign into a feature migration.
- Prefer deterministic SQL that fits the repository's current database and migration approach.
- Do not rely on manual database edits outside the migration system.

## 5. Backend quality and testing

For backend tasks, prioritize correctness, compatibility, and regression safety over feature expansion.

### Infer backend impact before changing code
- First identify the affected routes, services, validators, database queries, permissions, request/response shapes, and business rules.
- Consider regression surfaces in existing flows, especially where web and Android clients depend on current backend behavior.
- Treat API contracts and payload shapes as important compatibility boundaries.

### Add only the necessary quality work
- Add or update only the tests and backend fixes that are required by the actual change.
- Prefer updating existing tests when they already cover the affected behavior.
- Do not add redundant, shallow, flaky, or implementation-detail tests.
- Do not expand scope with unrelated backend improvements.

### Choose tests based on behavior and risk
- Determine test coverage from behavior and regression risk, not from file count.
- Add small, high-value tests that cover the changed behavior, including happy path, invalid input, authorization/permission behavior, edge cases, and data integrity where relevant.
- For bug fixes, add or update a regression test that would fail before the fix and pass after it.

### Preserve backend architecture and conventions
- Follow the repository's existing backend structure, naming, validation patterns, error-handling approach, test style, and project organization.
- Reuse existing helpers, fixtures, factories, and test utilities where possible.
- Do not introduce broad refactors, parallel abstractions, or speculative cleanup unless the task clearly requires it.

### Protect API and data consistency
- When relevant, verify validation behavior, permission checks, error handling consistency, request/response correctness, migration alignment, and backward compatibility.
- Do not change working backend behavior outside the intended scope unless it is necessary to fix a clear issue caused by the task.
- When backend behavior changes intentionally, make sure affected clients and dependent flows are considered.

### Keep tests CI-safe
- Keep tests deterministic, maintainable, and consistent with the existing suite.
- Avoid unnecessary slowness, brittleness, environment-dependent assumptions, and flaky timing-based checks.
- Prefer focused coverage that protects real behavior and fits the current CI pipeline.

## 6. Default working mode

When given a task in this repository, follow this order by default:

1. Inspect the relevant existing code and repository structure.
2. Infer the local conventions and shared patterns already in use.
3. Identify the minimum set of changes required.
4. Implement using existing architecture and reusable building blocks.
5. Check whether standards, migrations, backend quality, or cross-layer impacts apply.
6. Avoid unrelated changes and keep the result consistent with NEPH's current product, code, and team conventions.