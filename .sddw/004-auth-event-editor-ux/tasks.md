# SDDW 004 — Tasks

**Status: Not yet authorized. Requirements review first.**

- [ ] Approve [requirements.md](requirements.md).
- [ ] Review/approve mandatory first and last name, email-based registration, self-deletion, and staging-only allowlist requirements; collect verified existing administrator names before migrating them.
- [ ] Design account schema, migrations, verification, self-deletion/session revocation, staging allowlist policy and tests, and how existing admins transition.
- [ ] Review/approve the separate Attendee and Administrator view requirements and design accessible switching and route authorization.
- [ ] Design authentication and account-menu interactions in [design.md](design.md); review and approve.
- [ ] Design date/time picker choice, progressive disclosure, duration algorithm, and accessibility; review and approve.
- [ ] Break approved design into small implementation/test slices.
- [ ] Implement on a separate branch or PR, run automated tests, and merge to `main` only after review.
- [ ] Validate on staging after `main` deployment; resolve defects.
- [ ] Keep production release separately gated.

This is a planning checklist, not permission to implement.
