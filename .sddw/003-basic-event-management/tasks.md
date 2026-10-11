# Tasks — SDDW 003 Basic Event Management

**Status: Implementation authorized on PR #6. Slice 1 committed for CI review; remaining tasks pending.**

References: [requirements.md](requirements.md) (approved); [design.md](design.md) (approved by user on 2026-10-10). Target is **Serve With SF Fil-Am Lions**. Retain the existing Vite / Cloudflare Workers / D1 architecture, with React + MUI and a Material 3-inspired theme.

## Gate 0 — Review and readiness

- [x] Review and approve this task breakdown before any code changes, migrations, dependency installation, or deployments.
- [x] Check current `main` and outstanding PRs before implementation; working in PR #6 alongside its existing magic-link fix.
- [ ] Verify official club logo provenance/permission, Ubuntu and Alata web-font licenses/distribution, and official `#F1C232` brand color; record accessible fallback if an asset cannot be verified.
- [ ] Verify maintained Temporal polyfill compatibility with Cloudflare Workers, strict `disambiguation: 'reject'` behavior, and build/bundle impact; pin an appropriate dependency.
- [ ] Validate the planned light/dark MUI color tokens for WCAG contrast, including focus states and interaction states.

## Slice 1 — Event schema and public read API

- [x] Add versioned additive D1 migration (expected `0003_events.sql`, after checking existing migrations): UUID ID, title, location, IANA time zone, UTC start/end instants, created/updated/deleted timestamps, and integer event `version` initialized to 1.
- [x] Add DB constraints for trimmed nonblank title/location, positive version, and `end_at > start_at`; add initial list-query indexes (query-plan tuning pending).
- [x] Implement anonymous `GET /api/events?view=upcoming|past` with only non-deleted event fields and version; default to upcoming, reject unsupported view values, return no private admin data.
- [x] Classify upcoming by `end_at > now` (including in progress), past by `end_at <= now`; sort by `start_at, id` ascending for upcoming and descending for past; use a fixed test clock.
- [x] Add Worker/D1 integration tests for empty state payloads, stable ordering, exact end-time boundary, in-progress events, and exclusion of soft-deleted records (CI pending).

**Review checkpoint:** Public events can be read anonymously; no administrative mutation route or frontend change is needed to verify this slice.

## Slice 2 — Validated, protected event writes

- [x] Add a common event input validator: trimmed title (max 200 characters), location (max 500), required local start/end date/time and IANA zone defaulted to `America/Los_Angeles` by the editor; enforce server-side.
- [x] Use Temporal/polyfill to convert event-local times to unambiguous UTC instants, reject DST gaps and overlaps with field-level HTTP 422 errors, allow overnight events, reject end <= start.
- [x] Add server-side admin-only `POST /api/admin/events`, `PUT /api/admin/events/:id`, and `DELETE /api/admin/events/:id` (soft deletion). Reuse SDDW 002 session/allowlist and same-origin CSRF protections; never rely on hidden UI controls for authorization.
- [x] Require expected `version` for PUT and DELETE with conditional atomic updates. Perform atomic conditional updates/soft deletes and increment version; return HTTP 409 on stale versions without overwriting the current record. Define missing/deleted IDs and malformed precondition response codes consistently.
- [x] Correct local datetime regex so valid `YYYY-MM-DDTHH:mm` inputs reach Temporal validation (CI verification pending).
- [ ] Add API test coverage: authorized CRUD on future and past events, anonymous/unauthorized denial, input bounds, invalid/ambiguous DST times, multi-zone and overnight intervals, missing IDs, 409 conflicts, replayed delete, DB retention after soft deletion, and safe error responses.

**Review checkpoint:** API behavior and concurrency are testable without a UI; never deploy production.

## Slice 3 — React shell, club identity, and public event list

- [ ] Migrate only the vanilla frontend entry to React + React DOM while retaining Vite, Worker asset serving, existing auth flows, production/staging hostnames, and version/build footer.
- [ ] Add a centralized MUI theme approximating Material Design 3 (rounded/tonal cards, app bar, accessible controls), adopting official brand colors, approved logo, and Ubuntu/Alata typography.
- [ ] Follow `prefers-color-scheme` automatically, including changes at runtime, without a manual toggle or startup theme flash. Test contrast and reduced-motion/focus behavior in both themes.
- [ ] Set visible header, sign-in surface, browser title, and metadata to **Serve With SF Fil-Am Lions** (not bare Serve With); keep URLs unchanged.
- [ ] Build responsive public Upcoming/Past tabs with event cards showing title, full event-local start/end times, IANA zone abbreviation or clear zone name, and free-text location; handle cross-date ranges visibly.
- [ ] Provide exact agreed friendly empty-state wording, loading indicators, safe retries, and failure feedback. Public events remain visible without login or if auth checks fail.
- [ ] Preserve OTP sign-in and logout, explicit POST magic-link confirmation and token removal from browser history; integrate pending magic-link fix when appropriately merged instead of independently changing its behavior here.
- [ ] Add frontend tests for public browsing, loading/error/empty states, timestamp formatting, responsive layout, system-driven light/dark theme, and auth regression.

**Review checkpoint:** Anonymous visitors can browse events on the landing page without signing in.

## Slice 4 — Administrator event dialogs

- [ ] Show Add Event to authenticated admins including on an empty list; show Edit/Delete on all events, including past events. Hide admin controls from anonymous visitors but keep enforcement server-side.
- [ ] Build accessible MUI Add/Edit dialog with title, start/end date and time, IANA time-zone selector (Pacific default), and free-text location; prefill fields on edit and preserve form values on API errors.
- [ ] Disable duplicate saves; display field-level client/server validation errors, progress, and success status; close and refresh correct view only after confirmed success.
- [ ] Guard Cancel, close icon, Escape, and backdrop: if values changed, ask **Discard unsaved changes?**; otherwise close immediately. Ensure keyboard navigation, trapping/restoring focus, and screen-reader labels.
- [ ] Build a separate Delete confirmation dialog naming the event; on success use soft delete and refresh list, on failure leave event visible.
- [ ] Handle HTTP 409 version conflicts by keeping unsaved edits and explaining that another administrator changed the record; offer a deliberate reload/current-version action that asks before discarding edits.
- [ ] Add UI tests for Add/Edit/Delete, past event management, unsaved-change guards, duplicate submission, concurrency conflict preservation, focus restoration, error states, and authorization visibility.

**Review checkpoint:** End-to-end CRUD works for an authenticated staging admin; conflicts do not silently discard work.

## Slice 5 — Staging acceptance and production gate

- [ ] Run TypeScript checks, relevant security tests, React interaction tests, and build/size checks; confirm existing authentication and CI are still green.
- [ ] After code and task approval, deploy **staging only** through the existing GitHub workflow and apply the migration to `serve-with-staging-db`. Validate data and migrations before changes.
- [ ] Verify live `https://servewith-beta.sffilamlions.org/` on desktop/mobile: anonymous Upcoming/Past, timezone boundaries, admin CRUD, in-progress classification, deletion, conflicting edits, empty state, official brand, light/dark system switching, OTP/magic-link regression, and deployed build SHA.
- [ ] Document any deviations and update this checklist with evidence/checks; obtain explicit sign-off on staging.
- [ ] **Stop at staging.** Do not merge the Release Please production release PR or deploy `servewith.sffilamlions.org` without a separate, explicit authorization.

## Scope exclusions

No event detail pages/permanent links, volunteer signups, organizations, permissions expansion, recurrence, map/geocoding, notifications, manual dark-mode toggle, or deleted-event restoration in SDDW 003.

**Important:** This file is a proposed implementation plan, **not** approval to execute it. No checkbox should be marked complete until its work has actually been verified.
