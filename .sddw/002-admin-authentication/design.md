# Design — 002 Admin Authentication

## Delivery in small slices
1. Define and validate the committed administrator email allowlist (this PR).
2. Add server-side Cloudflare Worker endpoints, persistent state, and a transactional email service, with both OTP and magic links.
3. Add protected UI, logout, abuse controls and test scenarios; verify on staging.

Never deploy a fake client-side login or hardcoded OTP as a temporary shortcut.

## Allowlist
`config/admins.yaml` stores public administrator email identifiers only, never passwords, OTP codes or secrets. Validation runs in CI and before building. Use full YAML parsing rather than an ad hoc YAML parser; fail closed on invalid data. Normalize addresses to lowercase and reject duplicates. A disabled entry has no privileges. Only a server-side endpoint may decide authorization.

## Threat controls for implementation
- No account-enumeration response or timing distinctions, per-IP/email request throttling.
- Cryptographically secure random, single-use OTP and magic-link tokens stored as keyed hashes with expiration and failed-attempt limits.
- Magic-link GET is read-only; completing sign-in requires an explicit POST interaction to avoid scanner consumption.
- HttpOnly Secure SameSite cookies, CSRF/origin protections, server-side session revocation and expiry.
- Dedicated email provider API key and signing/pepper secrets in Cloudflare Worker secret store, not YAML or GitHub.
- Independent staging and production state storage and email safety controls.
