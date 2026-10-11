# SDDW 004 — Simplified Tasks

**Status: Scope trimmed; design and implementation await approval.** Full deletion/recovery and email changes are **not** implementation tasks here.

- [x] Complete user-led scope review and retain core registration, account, navigation and event UX.
- [x] Move email-change, account deletion, anonymized history and optional recovery ideas to [deferred-account-lifecycle.md](deferred-account-lifecycle.md).
- [x] Record required Terms/Privacy checkbox with `terms_accepted_at`, immutable `created_at` and version-aware reacceptance; **no `is_active` boolean**.
- [x] Refresh README with current staging/production URLs and project status.
- [ ] Approve [requirements.md](requirements.md) and [design.md](design.md); confirm dedicated Edit Event page and picker choice.
- [ ] Publish Terms of Use and Privacy Policy, set required version identifiers and reacceptance policy.
- [ ] Slice A: migrate D1 users + agreement history, staging-only email allowlist and existing-admin profile transition; verify role separation.
- [ ] Slice A: dedicated email-first code/magic login, auto token exchange, inline required name/DOB and linked unchecked agreement.
- [ ] Slice B: account menu, Attendee/Admin mode switch, self-profile editing and restricted incomplete/outdated agreement flow.
- [ ] Slice B: admin-only Users listing/search and Edit User with audited DOB correction; deny attendee direct URLs and APIs.
- [ ] Slice C: dedicated Create/Edit Event pages, shared date/time controls, duration, advanced end date/zone, Duplicate Event creating a new ID.
- [ ] Slice D: comprehensive automated auth, privacy, permissions, mobile, DST and event regression tests; review PR and green CI.
- [ ] Upon approved merge, test staging including real email and D1 changes, reconcile README with actual deployed features.
- [ ] Keep production registration policy and release separately gated.

**No implementation or deployment approval is implied by scope cleanup.**
