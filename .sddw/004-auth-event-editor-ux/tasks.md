# SDDW 004 — Core-Flow Tasks

**Status: Specification draft; implementation and deployment require separate approval.**

## Specification cleanup

- [x] Consolidate issues #10–#12 into core sign-in/registration, account navigation/management and event editor flows.
- [x] Preserve future account lifecycle concepts in [deferred-account-lifecycle.md](deferred-account-lifecycle.md), outside current acceptance criteria.
- [x] Separate immutable `created_at`, version-aware `terms_accepted_at` and acceptance audit from any account lifecycle state; exclude `is_active`.
- [x] Document current staging/production URLs and distinguish proposed from implemented features in README.

## Decisions and prerequisites

- [ ] Approve requirements and design; select accessible date/time picker.
- [ ] Publish Terms/Privacy, define required version identifiers and reacceptance procedure.
- [ ] Review D1 migration and existing administrator transition; confirm staging allowlist behavior.

## Implementation slices (not yet authorized)

- [ ] **A — Login and registration:** D1 profile/acceptance history, staging allowlist, existing-admin transition, email-first code/magic login, automatic one-time link exchange, inline profile completion and version-aware acknowledgment.
- [ ] **B — Account navigation and management:** top-right account menu, Attendee/Admin switch, owner profile, administrator-only Users search and Edit User, audited DOB correction, server-side access gates.
- [ ] **C — Event UX:** dedicated Create/Edit pages, shared time/date controls and duration, collapsed end date/zone, duplicate-to-new-ID flow, existing CRUD and concurrency protections.
- [ ] **D — Verification:** automated auth/replay/eligibility/terms/profile tests; attendee-denied Users APIs; audit, responsive accessibility, duplicate and DST regression; green CI.

## Release gates

- [ ] Review implementation PR(s); merge only after approval.
- [ ] Validate on staging including email and D1 behavior; update README based on deployed state.
- [ ] Obtain separate approval for production registration policy and release.

**Not tasks for SDDW 004:** email changes, deactivation/reactivation controls, account deletion/erasure, historical signup anonymization, recovery keys or ownership re-claim, attendee signups. Do not implement them incidentally.
