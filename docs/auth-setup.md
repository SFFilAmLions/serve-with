# Admin sign-in setup (not activated yet)

The auth implementation requires Cloudflare D1 and verified transactional email before login can work. The Worker returns HTTP 503 to auth endpoints until configured; the landing page remains public.

1. Create **separate** D1 databases for staging and production; apply `migrations/0001_auth.sql` to each.
2. Add the binding `AUTH_DB` in the corresponding Wrangler deployment environment, with the correct database ID. Do not bind staging to production data.
3. Verify a sending domain at [Resend](https://resend.com), create a restricted email API key, and configure Worker secrets `RESEND_API_KEY`, `AUTH_PEPPER` (high-entropy independent secret), and `AUTH_FROM_EMAIL` (verified sender).
4. Retain Cloudflare Workers deployment API secrets in GitHub Actions as before. Never put secret values in source or YAML.
5. Both initial administrator addresses come from `config/admins.yaml` and are normalized by `npm run generate:admins` during build.
6. Do not enable or advertise sign-in until the browser UI, security tests and staging configuration are completed.

The production release remains gated by the separate manual workflow. Release Please release PRs must be approved explicitly.
