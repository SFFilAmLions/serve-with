# Tasks — 002 Admin Authentication

- [x] Specify OTP and magic link authentication.
- [x] Configure two admin emails in YAML and generate server allowlist.
- [x] Implement initial Cloudflare Worker endpoints and D1 schema.
- [x] Add email delivery integration using Resend API.
- [x] Configure staging D1 and Worker secrets (user confirmed).
- [x] Add browser-facing sign-in form, magic-link confirmation and server-checked admin dashboard.
- [x] Add initial IP/email-scoped atomic request and verification throttling.
- [ ] Apply `migrations/0002_auth_rate_limits.sql` to staging before deploying latest PR code.
- [ ] Add comprehensive security and integration tests for both login methods and abuse protection.
- [ ] Verify email delivery, replay/expiry, cookies, logout and staging end-to-end.
- [ ] Establish production resources only when a production release is approved.
