# SDDW 004 — Core-Flow Tasks

**Status: Approved SDDW-004 combined feature batch implemented on the draft PR for CI/review. Policy publication, staging configuration, real-email/D1 validation, acceptance UX, and release approval remain pending.**

## Specification cleanup

- [x] Consolidate issues #10–#12 into core sign-in/registration, account navigation/management and event editor flows.
- [x] Preserve future account lifecycle concepts in [deferred-account-lifecycle.md](deferred-account-lifecycle.md), outside current acceptance criteria.
- [x] Separate immutable `created_at`, version-aware `terms_accepted_at` and acceptance audit from any account lifecycle state; exclude `is_active`.
- [x] Document current staging/production URLs and distinguish proposed from implemented features in README.

## Decisions and prerequisites

- [x] Verify picker license/package selection: MIT Community `@mui/x-date-pickers` + `dayjs`; dependency installation/compatibility tests remain for implementation.
- [x] Complete requirements/design consistency and prerequisite review; specification is ready for explicit implementation approval.
- [x] Define Terms/Privacy publication, immutable version identifiers, archival routes and deterministic reacceptance procedure (see [policy-publication.md](policy-publication.md)).
- [ ] Supply/approve substantive Terms and Privacy text and first effective versions; publish them before attendee onboarding.
- [x] Review existing D1 schema/auth/admin transition and propose additive migration/allowlist architecture (see [prerequisite-review.md](prerequisite-review.md)).
- [x] Resolve concrete D1 migration shape and DOB audit retention: additive `0004`, stable user IDs, active-session transition, append-only agreements, and actor/subject/time-only DOB correction audit (see [migration-plan.md](migration-plan.md)).
- [ ] During authorized implementation, verify deployed staging migration state and configure the separate server-side staging registration allowlist before enabling attendee registration.

## Implementation slices

- [ ] **A — Login and registration (Batch 2 outstanding):** D1 profile/acceptance history, staging allowlist, existing-admin transition, email-first code/magic login, automatic one-time link exchange, inline profile completion and version-aware acknowledgment.
- [ ] **B — Account navigation and management:** top-right account menu with Attendee/Administrator switch; visually distinct, explicitly labeled Administrator app bar with light/dark variants; persistent Light/Dark/System appearance controls including signed-out access; Administrator Events/Users tabs; canonical `/users/:id` and `/users/:id/edit` pages with pencil/X/check Material actions and no `/profile` or admin-specific user editor; Google Contacts/Gmail-style Users list with desktop First/Last/Email columns, intermediate First/Last columns and mobile full-Name display, horizontal row separators, sortable names, server-backed search, sticky accessible A–Z navigation with letter-targeted/incremental retrieval, preserved directory position, audited DOB correction and server-side access gates.
- [ ] **C — Event UX:** `/admin/events` management list with pencil/Edit, copy/Duplicate and trash/Delete actions; dedicated Create/Edit pages with X/check actions; MUI X date/time controls and duration; collapsed end date/zone; duplicate via navigation state to `/admin/events/new` with source notice and new-ID save; list-level confirmed destructive Delete; responsive icon+text to icon-only action collapse; existing CRUD/concurrency protections.
- [ ] **D — Verification:** automated auth/replay/eligibility/terms/profile tests; attendee-denied Users APIs; audit; canonical event navigation; public/admin list behavior; loading/empty/error states; draft preservation; keyboard/focus/icon-label/touch-target/A–Z/theme/reduced-motion accessibility; duplicate, delete-confirmation, concurrency and DST regression; green CI.

## Batch 1 — Foundation & Database (implementation on this branch)

- [x] Add additive `0004_users_and_agreements.sql` including normalized-unique users, immutable creation timestamps, append-only agreement acceptances, DOB-minimized audit and nullable session user references.
- [x] Resolve verified-email sign-ins and existing valid administrator email sessions idempotently to stable IDs without replacing their cookies; keep challenge and rate limits unchanged.
- [x] Add private staging registration eligibility helper independent of administrator role, with enabled admins eligible in staging; do not activate attendee registration.
- [x] Add database, existing-session resolution and staging-eligibility tests.
- [x] Confirm green CI test/build results for Batch 1 implementation commit.
- [ ] Confirm remote staging D1 migration state, configure staging secret, and validate staged migration before any deployment.
- [ ] Implement Batch 2 login/registration experience, profile/current-policy gates, acceptance transaction writes and policy publication after approvals.

## Batch 2 — Backend-only security foundation

- [x] Add server-side staging eligibility enforcement to existing code/magic login, preserving non-enumerating requests and rate limits; existing enabled admins remain eligible.
- [x] Add session-limited initial profile completion and required-version agreement endpoints with server validation and atomic D1 acceptance history/summary persistence.
- [x] Add minimum-account state in `/api/auth/me` and enforce verified profile/current-agreement/admin-role gates before administrator APIs.
- [x] GitHub Actions CI passed for backend implementation commit `09385073` (unit/integration, build and browser tests; [run #38127862126](https://github.com/SFFilAmLions/serve-with/actions/runs/38127862126)).
- [ ] Add/complete email-first UI, automatic magic exchange, published approved policy sources, and configuration for staging before attendee onboarding.
- [ ] Implement owner/admin user profile and directory authorization in the later account-management slice.

## Approved combined implementation batch (code review/CI pending)

- [x] Email-first `/login` with code entry, resend, change-email and automatic one-time magic POST, including browser URL scrubbing.
- [x] Inline registration profile completion for eligible staging accounts and configured administrators; eligibility enforced by the server.
- [x] Top-right account controls, canonical My Profile, logout and Attendee/Administrator workspace navigation.
- [x] Light/Dark/System appearance controls (signed-out and signed-in), client-persisted preference and labeled administrator workspace.
- [x] Canonical user read/edit endpoints and pages; owners edit names and administrators may correct DOB with actor/subject/time-only audit.
- [x] Admin-only paginated Users directory with server search/sort/letter navigation, responsive fields and preserved query/letter preferences.
- [x] Public canonical event details and contextual administrator edit navigation.
- [x] Administrator event navigation and responsive event rows, with Create/Edit/Duplicate/Delete entry points.
- [x] Dedicated event Create/Edit screens using Community MUI X date/time pickers and guarded close/save.
- [x] Duplicate-prefilled Create Event route that creates a distinct ID on explicit save.
- [x] New unit/integration and browser tests added for route, account, agreement gating and event behavior.
- [x] Combined implementation commit `fc08deef` passed GitHub Actions CI (unit/integration, TypeScript/Vite build, and browser tests; [run #38128884247](https://github.com/SFFilAmLions/serve-with/actions/runs/38128884247)).
- [ ] Complete manual accessibility/UX review and remaining real-environment event regression verification before release.
- [ ] Publish reviewed policies, set required Terms/Privacy versions and enable compliant acknowledgment UI (not approved in this selected batch).
- [ ] Inspect remotely applied staging migrations and provision private staging allowlist, then validate real staging auth/D1 behavior after separately approved deployment.

## Release readiness preparation

- [x] Add explicit staging/production Worker environment markers (no invitation addresses or policy versions committed).
- [x] Document remote D1 inspection, sanitized rehearsal, private allowlist provisioning, policy approval, and staged verification in [release-readiness.md](release-readiness.md).
- [ ] Verify remote staging state and policy/source approval before deployment.

## Release gates

- [ ] Review implementation PR(s); merge only after approval.
- [ ] Validate on staging including email and D1 behavior; update README based on deployed state.
- [ ] Obtain separate approval for production registration policy and release.

**Not tasks for SDDW 004:** email changes, deactivation/reactivation controls, account deletion/erasure, historical signup anonymization, recovery keys or ownership re-claim, attendee signups. Do not implement them incidentally.

## Policy and minimum-age preparation (repository only)

- [x] Add approved policy wording as unversioned repository drafts; do not publish until effective date, version identifiers and any legal/factual checks are confirmed.
- [x] Enforce registration minimum age 13 in server-side DOB validation and administrator correction; add regression tests.
- [x] Document manual privacy requests and minimum-necessary event organizer sharing without adding lifecycle APIs or organizer roles.
- [ ] Complete public current/archive policy routes, versioned immutable sources and unchecked acknowledgment UI when publication identifiers are approved.
- [ ] Review age eligibility at initial email verification and cleanup/minimization of rejected incomplete identities.
- [ ] Perform real-device accessibility and staging verification after separately approved deployment.

## Repo-versioned public policies (approved Oct 11, 2026)

- [x] Assign both policy documents version 0.1.0, aligned with package.json, effective October 11, 2026.
- [x] Implement anonymous public /terms and /privacy SPA routes using the approved policy sources; GitHub history is the archive (no in-app archival pages).
- [x] Add initially unchecked version-aware combined acknowledgment UI with server-persisted acceptance and failure handling.
- [ ] Verify CI and review the current policy presentation in a browser; no staging deployment until approved merge.
