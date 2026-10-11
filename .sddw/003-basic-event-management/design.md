# SDDW 003 — Basic Event Management: Technical Design

Status: **Proposed for review only — implementation not authorized.** All four technical design decisions recorded; overall design awaits final approval.
Requirements: [requirements.md](requirements.md). This design adopts **React + Material UI (MUI)** with a **Material Design 3-inspired custom theme**; it does not claim native/full Material 3 compliance.

## 1. Architectural overview

Keep the existing Vite + TypeScript + Cloudflare Worker + D1 deployment architecture. Replace only the existing vanilla DOM-based client shell with React; do not migrate backend infrastructure, authentication storage, or hosting.

- **Frontend:** React + React DOM + MUI, with a centralized custom theme. Vite builds static assets served by the current Worker assets binding.
- **Backend:** Existing Cloudflare Worker extended with public event-reading endpoints and protected event mutation endpoints. Reuse `sessionEmail()`, admin allowlist, session cookies, and origin checks from SDDW 002; all write decisions are made server-side.
- **Storage:** Existing **staging** D1 database, with an additive, versioned migration for events. Production remains separately controlled.
- **Scope discipline:** Event list, event dialogs, admin sign-in/out, no volunteer or organization functionality yet.

## 2. Material 3-inspired visual system

### Naming and site identity

- **Production hostname:** `servewith.sffilamlions.org` (URL is not the display name). The staging hostname remains `servewith-beta.sffilamlions.org`; the deployment environment is named `staging`.
- **User-facing product name:** include the Lions identity: **Serve With SF Fil-Am Lions** (approved). Do not present bare **Serve With** as the main app title.
- Use the approved product name consistently in the app header, HTML document title, sign-in screen, and metadata; use the full club name as secondary identity where appropriate. Preserve existing production release controls.


The current handbook uses Material for MkDocs, but its configured red/amber colors are **not** definitive club branding. Use Google Sites' documented club visual identity for the logo and typography; use Material 3 for surfaces, elevation, spacing, shapes, and interaction patterns.

- **Components:** MUI `AppBar`, `Container`, `Tabs`, `Card`/`CardContent`, `Button`, `TextField`, `Dialog`, `DialogTitle`, `DialogContent`, `DialogActions`, `Snackbar`/`Alert`, `CircularProgress`. Choose accessible MUI primitives over custom widgets.
- **Theme (approved, decision 4):** Define coordinated light and dark palettes in one MUI theme module. Follow the visitor's operating-system `prefers-color-scheme` preference automatically, including changes while the page is open; no manual appearance toggle in this milestone. Use official club yellow `#F1C232` as a brand accent, with appropriate distinct tonal/surface/on-color tokens for each mode and verified WCAG text/control contrast. Use generous Material 3-like rounded corners and responsive typography. Do not use raw yellow indiscriminately on backgrounds or text. Avoid a flash of the wrong theme on startup.
- **Typography (approved, decision 1):** Club name in Ubuntu Bold, subtitle in Ubuntu Condensed, body in Alata, with explicit local/system fallbacks and verified font licensing/distribution. Avoid committing uncertain-licensed font binaries.
- **Identity (approved, decision 1):** Use the official club logo with verified source and usage rights, plus the official yellow accent `#F1C232`; do not substitute a fabricated logo. Asset sourcing/licensing is a prerequisite to implementation.
- **Layout:** Mobile-first public landing page, compact branded top app bar with sign-in/user action; Upcoming/Past tabs; readable event cards containing all specified details; no drawer or event detail route.
- **Admin affordances:** Authenticated admins see Add Event and per-card Edit/Delete. Unauthenticated users see the same public list without mutation controls.
- **M3 limitations:** MUI's standard components are not full official Material 3 implementations. Customize theme/variants deliberately; document differences, rather than claiming strict specification compliance.

## 3. UI states and workflows

1. On load fetch public event list and `GET /api/auth/me` independently; show list even if auth is unavailable, and prevent protected controls until auth is positively established.
2. Upcoming is selected by default; switching to Past updates list and empty state. Fetch fresh results on view switch and after successful mutation. Show an inline loading indicator and meaningful retry message on failure.
3. Add/Edit opens an accessible MUI dialog with title, start date, start time, end date, end time, time zone, and free-text location. Edit prepopulates values. Default new events to `America/Los_Angeles`.
4. Save disables duplicate submissions, validates client-side for immediate feedback, submits to API, keeps the dialog and values open on error, and refreshes the list on success with success feedback.
5. Cancel, close icon, Escape, and backdrop all invoke a single close guard: unchanged form closes directly; changed form presents a separate discard confirmation. Restore focus to the triggering control after closing.
6. Delete opens a confirmation dialog naming the event, calls the protected delete endpoint, and refreshes the list on success; a failed delete leaves the event visible with an error.
7. Preserve SDDW 002 code login and explicit POST magic-link confirmation, including stripping magic tokens from browser history. Auth UI remains accessible as a dialog or single-purpose view without hiding public events.

## 4. Event storage and ordering

Add migration `0003_events.sql` (name subject to migration numbering at implementation review):

| Column | Type | Purpose |
|---|---|---|
| `id` | TEXT PRIMARY KEY | UUID generated on server |
| `title` | TEXT NOT NULL | Trimmed title |
| `location` | TEXT NOT NULL | Trimmed free text |
| `timezone` | TEXT NOT NULL | IANA zone identifier |
| `start_at` | INTEGER NOT NULL | UTC epoch milliseconds |
| `end_at` | INTEGER NOT NULL | UTC epoch milliseconds, > start |
| `created_at` | INTEGER NOT NULL | UTC epoch milliseconds |
| `updated_at` | INTEGER NOT NULL | UTC epoch milliseconds |
| `version` | INTEGER NOT NULL DEFAULT 1 | Monotonically incremented on every update and soft deletion for optimistic concurrency |
| `deleted_at` | INTEGER NULL | UTC epoch milliseconds for soft deletion |

Enforce nonempty strings and chronological ordering with DB CHECK constraints as defense in depth; API performs all semantic validation. Index `(deleted_at, end_at, start_at, id)` or query-specific partial indexes after inspecting SQLite query plans. Keep event times in UTC and original IANA zone; format event-local wall times from these values. Event values never rely on the viewer's clock zone.

Classification at request time (server UTC `now`):
- Upcoming: `deleted_at IS NULL AND end_at > now`, ascending `start_at, id`; includes events in progress.
- Past: `deleted_at IS NULL AND end_at <= now`, descending `start_at, id`.
- Stable tie-breaking by `id`.
A newly edited event may naturally move between views.

## 5. Date and time-zone resolution

The form submits local start/end date and time strings and an IANA zone; the Worker **resolves and validates** them to UTC instants. Never rely on the Worker machine time zone or `Date.parse` of an offsetless string.

- Validate the IANA zone against supported runtime time zones.
- Resolve each local wall-clock time using a timezone-aware library/algorithm that can identify **zero, one, or multiple** matching UTC instants.
- **Zero** (DST gap) or **multiple** (DST overlap) matches produce field-specific 422 validation errors, instructing the admin to choose a different unambiguous local time; do not silently choose an offset.
- Ensure `end_at > start_at` after conversion. Overnight/multiday intervals are permitted.
- Read/edit round-trips reconstruct local fields using the retained zone. Test Pacific DST transitions, at least one non-Pacific zone, and cross-midnight events.
- **Approved decision 2:** Use the Temporal API with a polyfill where native Temporal is unavailable. Convert local date/time plus IANA time zone with explicit `disambiguation: 'reject'` semantics so DST gaps and overlaps are rejected. Verify Cloudflare Workers runtime compatibility, the chosen polyfill's maintenance status, and bundle size during task planning before implementation.

## 6. API proposal

All JSON responses set `Cache-Control: no-store` initially to prevent stale public classifications while iterating.

| Method | Path | Auth | Behavior |
|---|---|---|---|
| GET | `/api/events?view=upcoming\|past` | Public | Returns only active events, sorted as above, including ID and display fields |
| POST | `/api/admin/events` | Admin session | Create validated event; 201 |
| PUT | `/api/admin/events/:id` | Admin session | Replace editable fields; 200 |
| DELETE | `/api/admin/events/:id` | Admin session | Set `deleted_at`; no hard delete; 204 |

- Return JSON validation errors with stable field codes and generic safe messages; 400 for malformed requests, 401 for unauthenticated writes, 403 for non-authorized users when appropriate, 404 for absent/deleted IDs, 422 for invalid fields/time resolution, 409 for edit/delete conflicts due to optimistic concurrency.
- Bound title and location lengths (proposed max 200 and 500 characters), restrict JSON body size, validate time inputs, and treat unexpected properties conservatively.
- Require same-origin POST/PUT/DELETE and protect against CSRF using existing origin/SameSite controls. Do not expose raw SQL or provider exceptions.
- **Approved decision 3:** Include an event `version` in public/admin event reads. Require an expected version on PUT and DELETE. Use an atomic conditional D1 update (`WHERE id=? AND version=? AND deleted_at IS NULL`) that increments the version. Return HTTP 409 if stale; never silently overwrite other edits. Preserve the unsaved form contents, explain the conflict, and offer to reload current event details (with explicit confirmation before discarding edits).

## 7. File/module organization (proposed, not created)

- `src/main.tsx` React entry; `src/App.tsx` routing between public list and sign-in UI.
- `src/theme.ts` MUI theme and brand tokens.
- `src/components/EventList.tsx`, `EventCard.tsx`, `EventEditorDialog.tsx`, `ConfirmDialog.tsx`.
- `src/lib/api.ts` typed fetch client; `src/lib/event-time.ts` display formatting.
- `src/worker.ts` routes and authorization; extract handlers into small modules if needed.
- `migrations/0003_events.sql`; extend existing Worker integration tests and add frontend interaction tests.
- Keep build-SHA footer visibility from the existing deployment workflow.

## 8. Verification and release constraints

Tests cover anonymous list reads, authentication boundaries, CRUD, replay/soft deletion behavior, view classification at exact end instant, deterministic ties, DST nonexistent/ambiguous times, multi-zone formatting, overnight intervals, form guards, keyboard behavior, loading/errors and focus restoration. UI tests also verify light and dark palettes, system preference changes, and accessible contrast.

Only after design approval: break work into small tasks and a separate implementation PR, pass CI, run D1 migration against staging, and verify mobile and desktop in staging. **Do not merge a production release PR or deploy production without explicit user approval.**

## 9. Open design review items

1. Verify approved club logo and brand-font asset sourcing and whether to load fonts remotely or bundle suitably licensed copies.
2. **Resolved:** Temporal with a polyfill, explicit rejection of DST gaps/folds; Cloudflare Workers compatibility and bundle size remain implementation verification criteria.
3. **Resolved:** Require optimistic concurrency with event versions and 409 stale-write conflicts, preserving unsaved form values.
4. **Resolved:** Automatically follow system light/dark preference with two contrast-checked Material 3-inspired palettes; no manual toggle. Final color token accessibility verification remains an implementation acceptance criterion.

This document is a design proposal, not permission to implement.
