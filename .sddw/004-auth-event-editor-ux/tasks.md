# SDDW 004 — Tasks

**Status: Scope discovery complete; final requirements and design review pending. Implementation not authorized.**

- [x] Complete user-led SDDW 004 feature scoping (no further feature additions requested).
- [ ] Approve [requirements.md](requirements.md) and resolve any remaining policy questions.
- [x] Record user decisions: existing administrators complete profile at next sign-in; staging whitelist is email-only; first and last names are editable.
- [x] Confirm `config/admins.yaml` remains email-only for administrator authorization; first/last names, date of birth, and verified email belong to D1 profiles.
- [ ] Review/approve remaining registration and deletion requirements; design a no-lockout administrator profile-completion transition.
- [x] Approve administrator-only corrections to submitted date of birth; owner can view but not edit it.
- [ ] Design audited admin date-of-birth correction, directory exclusion, privacy, retention and migration; validate a calendar date without inferring age limits.
- [ ] Design account schema, migrations, verification, self-deletion/session revocation, staging allowlist policy and tests, and how existing admins transition.
- [ ] Review/approve the separate Attendee and Administrator view requirements and design accessible switching and route authorization.
- [ ] Design authentication and account-menu interactions in [design.md](design.md); review and approve.
- [ ] Design/test administrator-only Duplicate Event as prefilled Create Event, preserving the original event and generating a new ID on explicit Save.
- [ ] Specify Create Event as a dedicated page and choose a consistent Edit Event page design, navigation, dirty-form safeguards, and tests.
- [ ] Design dedicated email-first login page, eight-digit code/magic link verification, and eligible first-login account creation without a standalone Create User page.
- [ ] Test attendee denial for direct Users page navigation and directory list/search APIs; admin-only directory access.
- [ ] Design inline, post-verification first-login required name/date-of-birth completion, subsequent own-profile edits, and admin-only Users directory/Edit User page for existing users, including ownership checks, eligibility, duplicate prevention, search, and regression tests.
- [ ] Design date/time picker choice, progressive disclosure, duration algorithm, and accessibility; review and approve.
- [x] Refresh README on the SDDW 004 draft branch with current staging status and staging/production URLs.
- [ ] Recheck README accuracy after SDDW 004 is implemented or deployed.
- [ ] Break approved design into small implementation/test slices.
- [ ] Implement on a separate branch or PR, run automated tests, and merge to `main` only after review.
- [ ] Validate on staging after `main` deployment; resolve defects.
- [ ] Keep production release separately gated.

This is a planning checklist, not permission to implement.
