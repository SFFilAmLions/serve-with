# Tasks — SDDW 003 Basic Event Management

**Status: Event APIs, React public/admin UI and core browser tests implemented in PR #6. Branding/theme development is now authorized and underway; staging deployment and merging remain unapproved.**

References: [requirements.md](requirements.md) (approved); [design.md](design.md) (approved by user on 2026-10-10). Target is **Serve With SF Fil-Am Lions**. Retain the existing Vite / Cloudflare Workers / D1 architecture, with React + MUI and a Material 3-inspired theme.

## Gate 0 — Review and readiness

- [x] Review and approve this task breakdown before any code changes, migrations, dependency installation, or deployments.
- [x] Check current `main` and outstanding PRs before implementation; working in PR #6 alongside its existing magic-link fix.
- [ ] Verify official club logo provenance/permission and official `#F1C232` color from club-owned source. Ubuntu uses Canonical's Ubuntu Font Licence 1.0; Alata and Ubuntu fonts loaded from Google Fonts with system fallbacks, avoiding bundled font binaries. Confirm precise Alata licensing and logo before checking this task.
- [ ] Verify maintained Temporal polyfill compatibility with Cloudflare Workers, strict `disambiguation: 'reject'` behavior, and build/bundle impact; pin an appropriate dependency.
- [ ] Validate the planned light/dark MUI color tokens for WCAG contrast, including focus states and interaction states.

## Slice 1 — Event schema and public read API

- [x] Add versioned additive D1 migration (expected `0003_events.sql`, after checking existing migrations): UUID ID, title, location, IANA time zone, UTC start/end instants, created/updated/deleted timestamps, and integer event `version` initialized to 1.
- [x] Add DB constraints for trimmed nonblank title/location, positive version, and `end_at > start_at`; add initial list-query indexes (query-plan tuning pending).
- [x] Implement anonymous `GET /api/events?view=upcoming|past` with only non-deleted event fields and version; default to upcoming, reject unsupported view values, return no private admin data.
- [x] Classify upcoming by `end_at > now` (including in progress), past by `end_at <= now`; sort by `start_at, id` ascending for upcoming and descending for past; use a fixed test clock.
- [x] Add Worker/D1 integration tests for empty state payloads, stable ordering, exact end-time boundary, in-progress events, and exclusion of soft-deleted records (CI passed).

**Review checkpoint:** Public events can be read anonymously; no administrative mutation route or frontend change is needed to verify this slice.

## Slice 2 — Validated, protected event writes

- [x] Add a common event input validator: trimmed title (max 200 characters), location (max 500), required local start/end date/time and IANA zone defaulted to `America/Los_Angeles` by the editor; enforce server-side.
- [x] Use Temporal/polyfill to convert event-local times to unambiguous UTC instants, reject DST gaps and overlaps with field-level HTTP 422 errors, allow overnight events, reject end <= start.
- [x] Add server-side admin-only `POST /api/admin/events`, `PUT /api/admin/events/:id`, and `DELETE /api/admin/events/:id` (soft deletion). Reuse SDDW 002 session/allowlist and same-origin CSRF protections; never rely on hidden UI controls for authorization.
- [x] Require expected `version` for PUT and DELETE with conditional atomic updates. Perform atomic conditional updates/soft deletes and increment version; return HTTP 409 on stale versions without overwriting the current record. Define missing/deleted IDs and malformed precondition response codes consistently.
- [x] Correct local datetime regex so valid `YYYY-MM-DDTHH:mm` inputs reach Temporal validation (verified by GitHub CI).
- [x] Add additional API tests for time zones, overnight events, event input bounds, missing records and version preconditions (CI passed for initial additions).
- [ ] Complete API test coverage: authorized CRUD on future and past events, anonymous/unauthorized denial, input bounds, invalid/ambiguous DST times, multi-zone and overnight intervals, missing IDs, 409 conflicts, replayed delete, DB retention after soft deletion, and safe error responses.

**Review checkpoint:** API behavior and concurrency are testable without a UI; never deploy production.

## Slice 3 — React shell, club identity, and public event list

- [x] Migrate vanilla frontend entry to React + React DOM with Vite, Worker asset serving, existing auth flows and build footer (CI verification pending).
- [ ] Complete centralized MUI brand theme: `src/theme.ts` now provides contrast-oriented light/dark tokens, MUI shapes and Ubuntu/Alata typography; official club logo provenance and visual approval are still pending (CI pending).
- [ ] Follow `prefers-color-scheme` automatically, including changes at runtime, without a manual toggle or startup theme flash. Added Chromium system-switching test and explicit focus outlines in `a957b4e` (CI pending); contrast audit and flash check remain.
- [x] Set visible header and browser title/description to **Serve With SF Fil-Am Lions**; keep URLs unchanged (CI/UI verification pending).
- [x] Implement initial responsive Upcoming/Past tabs with event cards showing event-local start/end instants, time zone, and location (CI/UI verification pending).
- [x] Implement friendly public empty states, loading indicators, retries, and failure feedback independently of login (UI verification pending).
- [ ] Preserve OTP sign-in and logout, explicit POST magic-link confirmation and token removal from browser history; integrate pending magic-link fix when appropriately merged instead of independently changing its behavior here.
- [x] Implement club-handbook-style footer and explicit build metadata for staging/production (CI and browser acceptance pending): repository link in all views; staged deployed commit hash linking to commit; production approved release version linking to GitHub release; local-development fallback, explicitly supplied by build workflows.
- [ ] Complete frontend tests for public browsing, loading/error/empty states, responsive layout, system-driven light/dark theme, and auth regression. Extracted event editor validation/time formatting into `src/event-form.ts` with passing unit tests; initial Chromium UI tests added to CI, pending verification.

**Review checkpoint:** Anonymous visitors can browse events on the landing page without signing in.

## Slice 4 — Administrator event dialogs

- [x] Implement initial Add Event, Edit, and Delete controls for authenticated admins, including empty states and past events; backend retains authorization enforcement (CI/UI verification pending).
- [ ] Complete accessible Add/Edit dialog: IANA time-zone autocomplete, form validation, edit prefill, and preserved server errors implemented; keyboard/focus interaction tests pending.
- [ ] Complete save feedback: duplicate saves blocked, field-level errors and success Snackbar implemented; browser-level interaction tests pending. Corrected stale-event reload so it does not incorrectly announce a successful edit (`102edc8`; CI pending).
- [ ] Guard Cancel, close icon, Escape, and backdrop: unsaved-change confirmation implemented and keyboard focus restoration, accessible dialog descriptions, and nested confirmation close guards added; actual browser keyboard/focus and screen-reader checks still pending.
- [x] Implement a separate Delete confirmation naming the event, refreshing on soft-delete and preserving the event on error (CI/UI verification pending).
- [x] Handle HTTP 409 version conflicts by preserving unsaved edits, explaining the conflict, and offering a reload action with explicit discard confirmation (automated interaction tests still pending).
- [ ] Add comprehensive browser interaction tests for Add/Edit/Delete, past event management, unsaved-change guards, duplicate submission, version conflicts, focus restoration, error states, and authorization visibility. Initial source-contract and executable form tests exist; Chromium/Playwright flows now cover anonymous tab browsing, admin editor, discard confirmation, and mocked Add Event submission with repository/footer verification (CI verification pending). CI passed at `8dc57b4` for Edit/Delete and version-conflict flows and at `04a9217` for Escape/discard guarding. New anonymous retry and failed-delete tests added in `065f1d5` (CI pending); broaden failure states before completion.

**Review checkpoint:** End-to-end CRUD works for an authenticated staging admin; conflicts do not silently discard work.

## Slice 5 — Staging acceptance and production gate

- [ ] Run TypeScript checks, relevant security tests, React interaction tests, and build/size checks; confirm existing authentication and CI are still green. Latest fully verified baseline: GitHub CI `38117468190` at `04a9217`; newer commits pending verification.
- [ ] After code and task approval, deploy **staging only** through the existing GitHub workflow and apply the migration to `serve-with-staging-db`. Validate data and migrations before changes.
- [ ] Verify live `https://servewith-beta.sffilamlions.org/` on desktop/mobile: anonymous Upcoming/Past, timezone boundaries, admin CRUD, in-progress classification, deletion, conflicting edits, empty state, official brand, light/dark system switching, OTP/magic-link regression, and correct environment-specific repo/version-or-commit footer.
- [ ] Document any deviations and update this checklist with evidence/checks; obtain explicit sign-off on staging.
- [ ] **Stop at staging.** Do not merge the Release Please production release PR or deploy `servewith.sffilamlions.org` without a separate, explicit authorization.

## Scope exclusions

No event detail pages/permanent links, volunteer signups, organizations, permissions expansion, recurrence, map/geocoding, notifications, manual dark-mode toggle, or deleted-event restoration in SDDW 003.

**Important:** This file is a proposed implementation plan, **not** approval to execute it. No checkbox should be marked complete until its work has actually been verified.
