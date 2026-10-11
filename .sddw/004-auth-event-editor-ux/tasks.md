# SDDW 004 — Core-Flow Tasks

**Status: Specification draft; implementation and deployment require separate approval.**

## Specification cleanup

- [x] Consolidate issues #10–#12 into core sign-in/registration, account navigation/management and event editor flows.
- [x] Preserve future account lifecycle concepts in [deferred-account-lifecycle.md](deferred-account-lifecycle.md), outside current acceptance criteria.
- [x] Separate immutable `created_at`, version-aware `terms_accepted_at` and acceptance audit from any account lifecycle state; exclude `is_active`.
- [x] Document current staging/production URLs and distinguish proposed from implemented features in README.

## Decisions and prerequisites

- [ ] Approve requirements and design; verify MUI X Date and Time Pickers dependency/license.
- [ ] Publish Terms/Privacy, define required version identifiers and reacceptance procedure.
- [ ] Review D1 migration and existing administrator transition; confirm staging allowlist behavior.

## Implementation slices (not yet authorized)

- [ ] **A — Login and registration:** D1 profile/acceptance history, staging allowlist, existing-admin transition, email-first code/magic login, automatic one-time link exchange, inline profile completion and version-aware acknowledgment.
- [ ] **B — Account navigation and management:** top-right account menu with Attendee/Administrator switch; visually distinct, explicitly labeled Administrator app bar with light/dark variants; persistent Light/Dark/System appearance controls including signed-out access; Administrator Events/Users tabs; canonical `/users/:id` and `/users/:id/edit` pages with pencil/X/check Material actions and no `/profile` or admin-specific user editor; Google Contacts/Gmail-style Users list with separate responsive First/Last/Email columns, horizontal row separators, sortable names, server-backed search, sticky accessible A–Z navigation with letter-targeted/incremental retrieval, preserved directory position, audited DOB correction and server-side access gates.
- [ ] **C — Event UX:** `/admin/events` management list; dedicated Create/Edit pages; MUI X date/time controls and duration; collapsed end date/zone; duplicate via navigation state to `/admin/events/new` with source notice and new-ID save; list-level confirmed Delete; existing CRUD/concurrency protections.
- [ ] **D — Verification:** automated auth/replay/eligibility/terms/profile tests; attendee-denied Users APIs; audit, responsive accessibility, duplicate and DST regression; green CI.

## Release gates

- [ ] Review implementation PR(s); merge only after approval.
- [ ] Validate on staging including email and D1 behavior; update README based on deployed state.
- [ ] Obtain separate approval for production registration policy and release.

**Not tasks for SDDW 004:** email changes, deactivation/reactivation controls, account deletion/erasure, historical signup anonymization, recovery keys or ownership re-claim, attendee signups. Do not implement them incidentally.
