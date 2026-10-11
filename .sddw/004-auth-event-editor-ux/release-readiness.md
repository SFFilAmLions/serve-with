# SDDW-004 — Release Readiness and Environment Checklist

**Status:** Repository configuration prepared. **No deployment, remote D1 inspection, secret provisioning, or legal-policy approval has occurred.** PR #13 remains draft.

## Confirmed from repository source

- Staging Worker is `serve-with-staging`; D1 binding `AUTH_DB` targets `serve-with-staging-db`.
- Production Worker is `serve-with`; its `AUTH_DB` uses a separate production database.
- `migrations/0004_users_and_agreements.sql` adds users, immutable agreement history, DOB audit, and nullable session user ID.
- The deployment workflow applies D1 migrations **before** deploying staging Worker code when main is updated. Do **not** merge until the policy/profile access-gate rollout has a safe plan.
- `ENVIRONMENT` is now explicitly `staging` or `production` in Worker configuration; the private invitation list is **not** committed.
- Current required Terms/Privacy version values and published policy text are absent. Privileged routes intentionally fail closed without them.

## Manual remote staging checks — not yet performed

Use a trusted operator with scoped Cloudflare access, without pasting credentials or user data into the PR.

1. Confirm Cloudflare project/account and the target staging Worker/D1 binding.
2. Inspect remote migration state, e.g. `npx wrangler d1 migrations list serve-with-staging-db --env staging --remote`. Check whether 0001–0003 are applied, and whether 0004 is pending. **Do not apply a migration as part of this inspection.**
3. Take an approved backup/snapshot or equivalent recovery measure; test 0004 against a representative *sanitized* copy of staging data and verify that valid sessions retain their token/expiry.
4. Verify private Worker bindings `AUTH_PEPPER`, `RESEND_API_KEY`, `AUTH_FROM_EMAIL`; do not print their values.
5. Provision `STAGING_REGISTRATION_EMAILS` in staging Worker secrets only after agreeing the allowed addresses. Never add it to `wrangler.jsonc`, a Vite environment variable, or a client bundle.
6. Verify mail-sender/domain behavior and authorized-code/magic-link replay and rate limiting in a separately approved staging test.
7. Confirm no production attendee invitation list exists; the registration helper rejects non-admin registration outside staging.

## Policy approval and activation — blocked

An organizational approver must supply **both** substantive policy documents and separately approve their effective dates/version identifiers, contact details, archival location and reacceptance behavior. Do not fabricate text or enable acceptance until this happens.

For an approved policy release:
1. Commit immutable versioned policy source files and publicly readable current/archive routes.
2. Verify those public routes work for anonymous visitors and include effective date/version.
3. Wire an initially unchecked combined Terms/Privacy acknowledgment, with links to the *actual* public texts, to `/api/auth/agreements`.
4. Configure `REQUIRED_TERMS_VERSION` and `REQUIRED_PRIVACY_VERSION` **in the same approved deployment** as corresponding published documents; validate stale-pair rejection, transaction rollback and reacceptance.
5. Retest legacy administrator sessions: profile and agreement completion must be available before introducing privileged mutation gates in a released environment.

## Required sign-offs

- [x] Actual Terms of Use wording approved by project requester; substantive legal review remains outstanding
- [x] Actual Privacy Policy wording approved by project requester; substantive legal review remains outstanding
- [ ] Initial Terms and Privacy version identifiers approved
- [ ] Remote staging migration inventory reviewed
- [ ] Staging backup/sanitized migration rehearsal reviewed
- [ ] Private staging allowlist provisioned and verified
- [ ] UX/accessibility and real D1/email flows checked in staging
- [ ] Separate merge/deployment approval
- [ ] Separate production registration approval

**Important:** CI tests/mock browser runs do not validate remote D1 state, published policies, SMTP provider behavior, or real-user accessibility.
