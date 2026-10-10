# 002 — Admin-only authentication

Status: in progress; authentication NOT yet deployed.

## Goal
Administrators listed in version-controlled YAML can sign in via email one-time passcode **or** magic link and access a protected dashboard; all other users are denied.

## Acceptance criteria
- [x] Admin allowlist schema and validation, including safe defaults and duplicate detection.
- [ ] Working email OTP delivery and verification (short-lived, one-time, throttled).
- [ ] Working magic link delivery and verification (short-lived, one-time, scanner-safe confirmation).
- [ ] Identical allowlist enforcement for both methods; unauthorized email addresses do not reveal membership.
- [ ] Secure HttpOnly SameSite cookie sessions, logout and CSRF protection.
- [ ] Server-side protected admin dashboard; no trust placed in client-only checks.
- [ ] Persistent token/session storage and replay prevention; isolated staging/production state.
- [ ] Automated positive, negative, expiry, replay and rate-limit tests.
- [ ] Email provider configured with no secrets in source control.
- [ ] Verified on staging before acceptance; no production promotion without explicit approval.

## Scope
Admins only. No general users, events, signups or org roles.
