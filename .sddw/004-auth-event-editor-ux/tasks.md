# SDDW 004 — Tasks

**Status: Not yet authorized. Requirements review first.**

- [ ] Approve [requirements.md](requirements.md).
- [x] Record user decisions: existing administrators complete profile at next sign-in; staging whitelist is email-only; first and last names are editable.
- [x] Confirm `config/admins.yaml` remains email-only for administrator authorization; first/last names, date of birth, and verified email belong to D1 profiles.
- [ ] Review/approve remaining registration and deletion requirements; design a no-lockout administrator profile-completion transition.
- [ ] Decide date-of-birth correction permissions, directory visibility, privacy, retention and migration; validate a calendar date without inferring age limits.
- [ ] Design account schema, migrations, verification, self-deletion/session revocation, staging allowlist policy and tests, and how existing admins transition.
- [ ] Review/approve the separate Attendee and Administrator view requirements and design accessible switching and route authorization.
- [ ] Design authentication and account-menu interactions in [design.md](design.md); review and approve.
- [ ] Specify Create Event as a dedicated page and choose a consistent Edit Event page design, navigation, dirty-form safeguards, and tests.
- [ ] Design dedicated email-first login page, eight-digit code/magic link verification, and eligible first-login account creation without a standalone Create User page.
- [ ] Design inline, post-verification first-login required name/date-of-birth completion, subsequent own-profile edits, and admin-only Users directory/Edit User page for existing users, including ownership checks, eligibility, duplicate prevention, search, and regression tests.
- [ ] Design date/time picker choice, progressive disclosure, duration algorithm, and accessibility; review and approve.
- [ ] Break approved design into small implementation/test slices.
- [ ] Implement on a separate branch or PR, run automated tests, and merge to `main` only after review.
- [ ] Validate on staging after `main` deployment; resolve defects.
- [ ] Keep production release separately gated.

This is a planning checklist, not permission to implement.
