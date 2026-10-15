# SDDW-006 acceptance evidence matrix

**Status:** Branch-level evidence inventory, updated October 15, 2026. This is not staging or production signoff. All links/paths below identify tests to inspect; passing CI is necessary but is not proof of live Cloudflare behavior.

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

## Runtime roster privacy proof — October 14, 2026

The Worker/SQLite test in commit `633bf02` verifies that an eligible participant receives only a names-only roster: `[{name:'Ordinary Member'}]`, without email or date of birth, while a signed-in nonparticipant of another event is denied. This test is pending CI on its own revision as of this entry. **Remaining:** Browser keyboard/screen reader validation, deployed cross-user security checks, and simultaneous roster/withdrawal behavior on approved staging.

## Consolidated pre-staging acceptance tests — October 14, 2026

This batch consolidates pending automatable scenarios rather than treating each test as a separate milestone:

| Test | Scope | Evidence status |
| --- | --- | --- |
| Expired and cross-event pending signup | No signup POST or intent replacement for stale/wrong-event targets | Existing passing CI at `28b2811` |
| Successful signup continuation | Exactly-once POST, accessible confirmation, no duplicate on reload | Existing passing CI at `a391f40` |
| Capacity conflict during continuation | HTTP 409 error visibly reported and pending intent cleared, no automatic replay | Added in `557c768`; require CI on exact HEAD |
| Event-start cutoff | Started event cancels pending intent without a POST | Added in `557c768`; require CI |
| Keyboard-operated signup | Focus + Enter triggers one request; success uses live-region status | Added in `557c768`; require CI and later human assistive-technology review |
| Runtime response/schema parity | Actual Worker public list, detail, and unauthenticated roster response structures checked against OpenAPI required fields/types | Added in `6132dcc`; require CI; remaining operation-specific response schemas still need validation |

**Not claimed:** comprehensive OpenAPI 3.1 / JSON Schema semantics, full client-server failure-injection matrix, real browser-and-email cross-device continuation, independent keyboard/screen-reader audit, provider-permission live checks, real D1 concurrency and migration/restore drill. These remain release/staging gates. No staging or production action is approved here.

## Consolidated additional CI test batch — October 14, 2026

A single batch adds browser cases for malformed pending-signup JSON (clear intent, no mutation), keyboard-based withdrawal (accessible confirmation and roster removal), and a provider usage HTTP 503 (visible error, refresh retry, no fabricated usage). Real-Worker tests now also exercise anonymous 401 JSON error envelopes for participant names, signup state/history, delegated administration and usage metrics, checking them against the documented OpenAPI Error schema.

| Added change | Evidence status |
| --- | --- |
| `52ac0cf` browser failure recovery / keyboard / provider outage | Check CI at final HEAD before sign-off |
| `ae7072f` Worker anonymous error status and OpenAPI schema parity | Check CI at final HEAD before sign-off |

These are isolated unit/Playwright runs, not live Cloudflare D1, external provider account access or a complete WCAG assistive-technology audit. Live D1 races, schema restore, real Resend mail delivery, and independent screen-reader verification remain separate gates requiring explicit permission and/or human review.

## Phase 1 consolidated audit and implementation closeout — October 15, 2026

| Area | New evidence | Remaining acceptance |
| --- | --- | --- |
| All documented API routes | Actual Worker/SQLite authenticated and anonymous characterization tests cover all 27 OpenAPI operations (26 authenticated after excluding logout to retain test fixture); check status, JSON envelope, required keys and recursively declared JSON types | Non-sampled request permutations, live deployed response parity, manual semantic schema review |
| Response contracts | Corrected 14 missing documented JSON 4xx envelopes, added delegated signup/roster 404/422 status contracts, and enforced JSON schemas on every nonempty declared HTTP response | Precision of loosely typed legacy payload objects and full OpenAPI 3.1 semantics |
| Worker request validation | Added numeric and array bounds in generated validator, positive optimistic-version schema for event edit/delete, and a contract test ensuring all meaningful JSON mutations have a production Worker validation boundary | Full JSON Schema 2020-12 format/combinator support is not provided by the deliberately limited adapter |
| Generator and toolchain | `api:generate` alias, lockfile-backed generators and byte-for-byte deterministic outputs, plus baseline breaking-change and protected operation tests | Public docs and assets must be verified in authorized staging |
| Usage & Quotas | Release scope documented in `provider-metrics.md`: show unknown when account permissions or provider totals are unavailable; no new credentials or fake numeric limits | Verify staging UI/provider-isolation behavior; live analytics integration is deferred unless explicitly made a release blocker |

The whole branch-level unit/build/Playwright test pipeline passed at [CI 38716713819](https://github.com/SFFilAmLions/serve-with/actions/runs/38716713819) on the pre-documentation implementation revision `f7c0068`. Record a successful CI check on the final documentation HEAD before calling this signoff evidence final. These tests remain isolated SQLite, not concurrent Cloudflare D1.

**Release boundary:** Phase 1 implementation and contract-hardening changes do not authorize PR merge, staging migration/deployment, Cloudflare permission expansion, Resend full-access tokens, or production release. Stage-only and independent human-review requirements remain explicit.
