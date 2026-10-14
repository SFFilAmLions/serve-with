# SDDW-006 acceptance evidence matrix

**Status:** Branch-level evidence inventory, October 14, 2026. This is not staging or production signoff. All links/paths below identify tests to inspect; passing CI is necessary but is not proof of live Cloudflare behavior.

| Area / tasks | Branch-level evidence | Open gate |
| --- | --- | --- |
| Existing route inventory and OpenAPI parity (T001–T009) | `api-inventory.md`, `openapi/openapi.yaml`, `tests/openapi-contract.test.mjs`, `tests/openapi-compatibility.test.mjs`, generated dispatcher and real Worker integration in `tests/events-public.test.mjs` | Complete field-level response/error/status parity for every operation and confirm deployed docs/static assets |
| Capacity and signup history (T010–T013, T017) | `migrations/0005_event_signups.sql`, `migrations/0006_unclaimed_users.sql`, `tests/signups-database.test.mjs`, `tests/events-public.test.mjs` | Independently review additive migration integrity; run real parallel Cloudflare D1 requests in an authorized isolated staging clone |
| Guest continuation and attendee flows (T014, T018) | `tests/browser/events.test.mjs` exercises login, profile gate, full-event behavior and existing-signup no-duplicate continuation; Worker API tests exercise withdraw/rejoin/privacy | Cross-device magic-link continuation, terminal failures, network ambiguity and keyboard/screen-reader acceptance on staging |
| Administrator event management and stubs (T015–T016, T018) | Worker tests cover admin delegated signup, conflicts, name-only active roster and stub creation; browser test covers non-admin deep-link redirect; claim migration test preserves identity/history and no implicit consent | Verify full OTP-based verified-email claim through Worker, identity collisions, policy acceptance, and role isolation end-to-end |
| Usage, quotas, Material UI (T019–T023) | `provider-metrics.md`, `tests/browser/events.test.mjs` unknown-quota and anonymous gate tests, `tests/openapi-contract.test.mjs` | Verify account-specific provider permissions only with separate authorization; review contrast, keyboard use, provider outage isolation and metrics provenance |
| Release reconciliation (T024–T026) | `release-readiness.md`, this matrix and green CI runs on their exact revisions | CI on final branch; staging backup/restore; migrations and deployment only after explicit staging permission; separate production approval |

## Safety and interpretation

- The in-memory SQLite adapter compiles and exercises the real Worker handlers but **does not reproduce distributed Cloudflare D1 concurrency**.
- Database-level stub claim tests show stable IDs and no auto-consent, but **do not prove verified-email OTP claiming end-to-end**.
- Contract-shape assertions are not comprehensive JSON Schema 2020-12 response validation.
- Provider readings without authorized account access must remain unavailable/unknown, never reported as zero.
- No migrations, production credentials, staging deployment, merge, or production release are authorized by this evidence inventory.

## Next verification batch

1. Exercise a verified-email stub claim via OTP with an isolated Worker/SQLite fixture; assert same participant ID, eligibility/consent gate and history continuity.
2. Audit generated contract's successful and error response schemas against actual Worker outputs for all API operations; fix mismatches or document intentional legacy compatibility.
3. Record CI for exact HEAD and perform a final accessibility/privacy review.
4. Seek **separate** staging-only approval before any D1 clone, migration execution, live concurrency probe or deployment.

## October 14 Worker claim verification addition

The new `tests/events-public.test.mjs` regression at `62bd93c` exercises an isolated real-Worker magic-link token claim against the SQLite adapter. It asserts stable participation identity, retained signup, no fabricated policy acceptance, a gated incomplete account, and token replay rejection. CI on the exact test revision must pass before the evidence is marked verified. This does not test live Resend delivery, cross-device user-interface continuation, or Cloudflare D1.

## Verified Worker claim CI — October 14, 2026

Commit [`4f4e942`](https://github.com/SFFilAmLions/serve-with/commit/4f4e9425f311be472278e6bb5a34f902c5a7c3fa) passed [CI run 38527443900](https://github.com/SFFilAmLions/serve-with/actions/runs/38527443900), OpenAPI generation and PR-title validation. The isolated Worker magic-link claim test passes with the existing `0002_auth_rate_limits.sql` table included in its in-memory test harness. The claim preserves signup identity/history, does not grant policy consent, enforces eligibility and rejects replay. This clears the isolated Worker-claim regression only; external email delivery, deployed browser continuation and real D1 are still unverified.
