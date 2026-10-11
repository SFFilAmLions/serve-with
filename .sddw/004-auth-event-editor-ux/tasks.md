# SDDW 004 — Core-Flow Tasks

**Status: Specification/design ready for implementation approval; implementation and deployment require separate approval.**

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

## Implementation slices (not yet authorized)

- [ ] **A — Login and registration:** D1 profile/acceptance history, staging allowlist, existing-admin transition, email-first code/magic login, automatic one-time link exchange, inline profile completion and version-aware acknowledgment.
- [ ] **B — Account navigation and management:** top-right account menu with Attendee/Administrator switch; visually distinct, explicitly labeled Administrator app bar with light/dark variants; persistent Light/Dark/System appearance controls including signed-out access; Administrator Events/Users tabs; canonical `/users/:id` and `/users/:id/edit` pages with pencil/X/check Material actions and no `/profile` or admin-specific user editor; Google Contacts/Gmail-style Users list with desktop First/Last/Email columns, intermediate First/Last columns and mobile full-Name display, horizontal row separators, sortable names, server-backed search, sticky accessible A–Z navigation with letter-targeted/incremental retrieval, preserved directory position, audited DOB correction and server-side access gates.
- [ ] **C — Event UX:** `/admin/events` management list with pencil/Edit, copy/Duplicate and trash/Delete actions; dedicated Create/Edit pages with X/check actions; MUI X date/time controls and duration; collapsed end date/zone; duplicate via navigation state to `/admin/events/new` with source notice and new-ID save; list-level confirmed destructive Delete; responsive icon+text to icon-only action collapse; existing CRUD/concurrency protections.
- [ ] **D — Verification:** automated auth/replay/eligibility/terms/profile tests; attendee-denied Users APIs; audit; canonical event navigation; public/admin list behavior; loading/empty/error states; draft preservation; keyboard/focus/icon-label/touch-target/A–Z/theme/reduced-motion accessibility; duplicate, delete-confirmation, concurrency and DST regression; green CI.

## Release gates

- [ ] Review implementation PR(s); merge only after approval.
- [ ] Validate on staging including email and D1 behavior; update README based on deployed state.
- [ ] Obtain separate approval for production registration policy and release.

**Not tasks for SDDW 004:** email changes, deactivation/reactivation controls, account deletion/erasure, historical signup anonymization, recovery keys or ownership re-claim, attendee signups. Do not implement them incidentally.
