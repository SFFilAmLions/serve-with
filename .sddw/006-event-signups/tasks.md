# SDDW-006 — Implementation Task Plan

**Status:** Proposed sequencing for approval, not authorization to modify application/deploy.
**References:** [requirements](./requirements.md) · [design](./design.md)
**Milestone:** One SDDW-006 with separate workstream PRs. Checkboxes track completion, not separate releases.

## Gate 0 — Architecture proof and route inventory (first)

- [ ] **T001** Inventory all deployed HTTP endpoints/methods, auth cookies, CSRF/origin requirements, response shapes and error codes; record characterization tests for main. **In progress:** static route inventory recorded in [api-inventory.md](./api-inventory.md); runtime characterization tests remain.
- [ ] **T002** Write OpenAPI 3.1 YAML skeleton with security schemes, public/admin grouping and existing routes; lint schema and examples. **In progress:** initial [openapi.yaml](../../openapi/openapi.yaml) contains public events routes; auth/admin schemas and remaining routes still pending; `scripts/validate-openapi.mjs` and `tests/openapi-contract.test.mjs` now provide initial structural and security-declaration checks via the existing `npm test` CI path.
- [ ] **T003** Spike pinned generation candidates on **one public GET and one authenticated mutation**, generating **both** frontend client and Worker-compatible server operation/dispatch contracts; prove runtime validation and CSRF in Worker tests. Record tool decision and limitations in `design.md`. **Blocker if no qualifying generator**. **Type generation proof passed in GitHub Actions:** Pinned `openapi-typescript@7.13.0` generates typed API operations, and the YAML-driven prototype `scripts/generate-server-contract.mjs` generates Cloudflare Fetch API handler signatures/route metadata that compile against them ([passing run](https://github.com/SFFilAmLions/serve-with/actions/runs/38181278052)). **Fetch API spike added:** [tests/openapi-dispatch-spike.test.mjs](../../tests/openapi-dispatch-spike.test.mjs) compiles and executes generated route metadata, exercising mock public and admin handlers with origin, cookie and role fixtures; this tests a *test-only dispatcher*, not production Worker code. **Real Worker characterization now exercised:** [tests/events-public.test.mjs](../../tests/events-public.test.mjs) uses YAML-generated route metadata to forward public GET and admin POST to the actual compiled `src/worker.ts` with SQLite fixtures; it checks session requirements, origin and Fetch Metadata rejection, 201 and public GET. This is an **integration adapter test**, not replacement of the production Worker's manual route dispatcher. **Additional spike passed:** [OpenAPI generator spike](https://github.com/SFFilAmLions/serve-with/actions/runs/38182418415) executed a callable `openapi-fetch` client against a synthetic Fetch endpoint and validated the YAML event creation input with AJV 2020-12, including an invalid-time-format rejection ([spike script](../../scripts/openapi-runtime-spike.mjs)). **Compatibility issue discovered and characterized:** The Worker trims event title/location and tolerates extra keys. The YAML currently forbids extra keys and permits whitespace-only names. A dedicated runtime spike assertion checks these mismatches (see [design.md](./design.md)). **Compatibility adapter prototype added:** [normalize-openapi-spike.mjs](../../scripts/normalize-openapi-spike.mjs) trims known title/location fields and drops unknown event-create keys before YAML-schema validation; the runtime spike asserts legacy-accepted payloads remain accepted and whitespace-only names fail. This is **test-only** and not yet wired to production. **Real-handler compatibility characterization added:** `tests/events-public.test.mjs` now submits normalized legacy event inputs to the real compiled Worker with D1/SQLite fixtures and asserts 201, trimmed data, 400 for CSRF failures, 422 for blank titles and no unexpected writes. **Generated dispatch + actual Worker integration:** `tests/events-public.test.mjs` now drives public and protected admin operations through the YAML-derived `dispatchOperation` function into actual compiled `src/worker.ts`, preserving 401/400/201 outcomes in D1/SQLite fixtures ([CI](https://github.com/SFFilAmLions/serve-with/actions/runs/38192962547)). **Still outstanding:** use generated dispatch in the production Worker request path, enforce schema-driven runtime validation in that path with backward compatibility, assess response/status parity across all routes, and select the final toolchain. These tests do not prove production routing is migrated. Do not mark T003 complete.
- [ ] **T004** Approve route naming and nonbreaking migration plan (including existing SPA fallback and eventual `/api/docs` and `/api/openapi.json`).

**Suggested PR 1:** Architecture proof + contract/toolchain decision; no mass route rewrite.

## Workstream A — API contract foundation

- [ ] **T005** Author complete existing API contract in `openapi/openapi.yaml`; add shared schemas, errors, security and synthetic examples.
- [ ] **T006** Add deterministic `api:generate`, pinned tooling, generated frontend client, generated Worker-side interfaces and runtime request validation adapter; migrate existing handlers incrementally.
- [ ] **T007** Migrate React API calls to generated client without behavioral changes; preserve same-origin cookies/session semantics.
- [ ] **T008** Publish generated JSON and Scalar docs under `/api/openapi.json` and `/api/docs`, staging first. Ensure no auth bypass or accidental SPA HTML response.
- [ ] **T009** CI: OpenAPI lint/validation, generation drift, TypeScript, contract tests, breaking-change review, browser tests.

**Suggested PR 2–3:** Existing API contract and generator integration; documentation and CI, depending on review size.

## Workstream B — Participation and identities

- [ ] **T010** Verify existing events/users schema; prepare D1 migration for optional event capacity, five-column signup table, partial active uniqueness, and minimally flagged stubs with nullable email; preserve current identities.
- [ ] **T011** Prove D1 atomic capacity correctness under simultaneous different-user signups; implement insert/withdraw and cutoff logic with appropriate error handling.
- [ ] **T012** Add event list/detail public capacity aggregates and signed-in self-signup state; no PII on public endpoints.
- [ ] **T013** Implement own signup history, withdrawn-row preservation and per-event active participant names; enforce roster access server-side and revocation after withdrawal.
- [ ] **T014** Implement public self-signup button and one-time continuation through login, email verification, profile completion and agreement acceptance; test duplicate prevention, full event and cutoff races.
- [ ] **T015** Build distinct admin event page with search, roster/history, delegated signup/withdrawal and non-admin redirect plus one-time accessible warning toast.
- [ ] **T016** Implement admin Create User stub form/action, email-null stub storage, then integrate ordinary verified-email claim/completion with ID/history preservation and identity collision protection.
- [ ] **T017** Update event editor for optional capacity and reject below-active-count edits; validate deletions and archive retention.
- [ ] **T018** Browser/security tests: public/admin page parity, guest funnel, age/policies, privilege gates, names-only roster, DST/cutoff, re-signup history, stub claiming and accessibility.

**Suggested PR 4–7:** Database/server primitives; public participation; admin workflows/stubs; browser acceptance.

## Workstream C — Usage, quotas and UI

- [ ] **T019** Investigate live Cloudflare Workers/D1, Resend and Turnstile usage APIs/permissions for **both environments**. Record which usage/limit/reset values are reliable; seek approval before adding new credentials or billing dependencies.
- [ ] **T020** Add admin-protected read-only usage API in YAML and provider adapters, with scoped secrets, cache, timeouts, stale-source reporting, and account-versus-app labeling.
- [ ] **T021** Implement responsive admin Usage & Quotas dashboard (known/unknown limits, 80%/95% warnings) with accessibility and failure-state tests.
- [ ] **T022** Apply Material Symbols Rounded, pill selectors, button hierarchy and admin header refinements across existing and new surfaces. Preserve semantics, focus, light/dark themes and routes.
- [ ] **T023** Test visual parity, admin auth and provider outage isolation; verify no credentials/PII reach browser bundles or docs.

**Suggested PR 8–9:** Usage backend/frontend; UX polish (can overlap participation PRs).

## Gate 1 — Validation and release

- [ ] **T024** Reconcile every requirement with a test or documented manual acceptance; run static, API, D1 concurrency, browser, keyboard and security checks.
- [ ] **T025** Apply migrations **in staging only after explicit approval**; deploy staged candidate; verify API docs and feature flows including full-event/magic-link/stub claiming/usage dashboard.
- [ ] **T026** Obtain signoff, review migration rollback/forward strategy and release notes, then request separate approval for production release and production credentials/migrations.

## Definition of done

The SDDW milestone completes only when requirements and design are reconciled, all workstreams and contract checks pass, staging acceptance is recorded, and an explicitly approved release is complete. PR merges, staging deployments and production deployment are separate actions.

## Known questions to resolve at Gate 0 / design review

- Select and pin a YAML-to-client **and** YAML-to-Worker-server generation toolchain only after Worker compatibility is proven.
- Verify SQLite/D1 conditional-insert concurrency behavior rather than assuming the uniqueness index prevents capacity races.
- Determine minimal stub DB transition schema based on current user constraints and existing email login.
- Confirm detailed admin API paths and what provider metrics/limits are genuinely available for this account.

## Approved OpenAPI bulk batch — implementation record

The user authorized T001–T009 in one batch. **Commits and draft PR updates are authorized; merges, staging deployments, production deployments, database migrations, new paid services and credential changes are not.**

| Tasks | Implementation now in the branch | Remaining acceptance gate |
| --- | --- | --- |
| T001 | Static route inventory and existing route/auth characterization tests | Confirm parity for all methods and statuses, including obscure authorization errors |
| T002 | The YAML now declares all **17 currently inventoried Worker methods** | Audit precise response schemas, optional query inputs, format semantics and per-operation security/status accuracy |
| T003 | Generated operation registry used by actual Worker; normalized event-create requests checked with generated schema after existing auth/business validation | Extend schema runtime validation consistently to remaining JSON operations, complete status parity and robust Worker integration tests |
| T004 | Design records YAML-first generators, generated routing and known limitations | Approve final validation/toolchain tradeoffs and resolve all schema mismatches |
| T005–T007 | Build generates typed client, server registry, validators; React event list/detail, session and Turnstile reads use generated client | Migrate remaining admin mutations, authentication and user/profile interactions; eliminate handwritten endpoint DTO duplication |
| T008 | Build generates `public/api/openapi.json`; Scalar reference page at `public/api/docs/index.html`; Worker redirects `/api/docs` to `/api/docs/` | Verify deployed assets and documentation interactively **after separately approved deployment** |
| T009 | Structural test suite, generation as part of build/test, schema/asset tests and baseline path/status CI gate | Verify deterministic generated artifact drift and stronger schema-level breaking-change comparison |

The generated request validator intentionally supports only the JSON Schema keywords used by current request bodies. It is **not a complete OpenAPI 3.1 / JSON Schema 2020-12 validator**; ordinary Worker handlers still enforce business rules. These tasks should not be checked complete solely because CI passes the intermediate integration work.

**Scope rule:** This remains a draft branch. No merge or deployment without separate user authorization.
