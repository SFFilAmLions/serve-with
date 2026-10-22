# SDDW-006 — Implementation Task Plan

**Status:** Implementation underway. Completed checkboxes reflect verified branch-level deliverables only; staging acceptance and release are separate gates.
**References:** [requirements](./requirements.md) · [design](./design.md)
**Milestone:** One SDDW-006 with separate workstream PRs. Checkboxes track completion, not separate releases.

## Gate 0 — Architecture proof and route inventory (first)

- [ ] **T001** Inventory all deployed HTTP endpoints/methods, auth cookies, CSRF/origin requirements, response shapes and error codes; record characterization tests for main. **In progress:** static route inventory recorded in [api-inventory.md](./api-inventory.md); runtime characterization tests remain.
- [x] **T002** Write OpenAPI 3.1 YAML skeleton with security schemes, public/admin grouping and existing routes; lint schema and examples. **Completed:** YAML covers the inventoried routes and tests validate contract structure/security declarations; precise response/status parity remains tracked under T001/T005/T009.
- [x] **T003** Complete the generator spike for a public GET and protected mutation with typed browser client, Cloudflare Worker dispatcher, schema-derived canonical request validation, and authorization/origin regression tests. The production Worker uses generated operation routing and preserves legacy normalization. `design.md` records the selected YAML-first toolchain and its JSON Schema subset limitations; complete response-field parity remains under T005/T009 and staging acceptance under T024–T025.
- [ ] **T004** Approve route naming and nonbreaking migration plan (including existing SPA fallback and eventual `/api/docs` and `/api/openapi.json`).

**Suggested PR 1:** Architecture proof + contract/toolchain decision; no mass route rewrite.

## Workstream A — API contract foundation

- [ ] **T005** Author complete existing API contract in `openapi/openapi.yaml`; add shared schemas, errors, security and synthetic examples.
- [x] **T006** Implement the deterministic `api:generate` command, lockfile-backed tooling, generated typed browser client and Worker interfaces/dispatch, and runtime request-body validation. All documented mutations with meaningful JSON bodies have Worker generated-validation boundaries; logout's empty body intentionally needs no schema validation. Broader JSON Schema 2020-12 semantics are explicitly outside the current adapter and still require a separate review if mandated.
- [x] **T007** Migrate React API calls to generated client without behavioral changes; preserve same-origin cookies/session semantics. **Branch-level implementation:** all React API requests use generated operation methods; `tests/openapi-contract.test.mjs` now guards against reintroducing direct fetch calls. Staging verification remains part of T024–T025.
- [ ] **T008** Publish generated JSON and Scalar docs under `/api/openapi.json` and `/api/docs`, staging first. Ensure no auth bypass or accidental SPA HTML response.
- [x] **T009** CI validates YAML references and structure, stable generation on repeated runs, TypeScript/build, conservative breaking-contract diffs, production Worker status/response characterization for all 27 operations, and Playwright browser flows. This is branch-level CI coverage, not a complete formal semantic schema diff or deployed acceptance.

**Suggested PR 2–3:** Existing API contract and generator integration; documentation and CI, depending on review size.

## Workstream B — Participation and identities

- [x] **T010** Verify existing events/users schema; prepare D1 migration for optional event capacity, five-column signup table, partial active uniqueness, and minimally flagged stubs with nullable email; preserve current identities.
- [ ] **T011** Prove D1 atomic capacity correctness under simultaneous different-user signups; implement insert/withdraw and cutoff logic with appropriate error handling.
- [x] **T012** Add event list/detail public capacity aggregates and signed-in self-signup state; no PII on public endpoints.
- [x] **T013** Implement own signup history, withdrawn-row preservation and per-event active participant names; enforce roster access server-side and revocation after withdrawal.
- [ ] **T014** Implement public self-signup button and one-time continuation through login, email verification, profile completion and agreement acceptance; test duplicate prevention, full event and cutoff races.
- [ ] **T015** Build distinct admin event page with search, roster/history, delegated signup/withdrawal and non-admin redirect plus one-time accessible warning toast.
- [ ] **T016** Implement admin Create User stub form/action, email-null stub storage, then integrate ordinary verified-email claim/completion with ID/history preservation and identity collision protection.
- [x] **T017** Update event editor for optional capacity and reject below-active-count edits; validate deletions and archive retention.
- [ ] **T018** Browser/security tests: public/admin page parity, guest funnel, age/policies, privilege gates, names-only roster, DST/cutoff, re-signup history, stub claiming and accessibility.

**Suggested PR 4–7:** Database/server primitives; public participation; admin workflows/stubs; browser acceptance.

## Workstream C — Usage, quotas and UI

- [ ] **T019** Investigate live Cloudflare Workers/D1, Resend and Turnstile usage APIs/permissions for **both environments**. Record which usage/limit/reset values are reliable; seek approval before adding new credentials or billing dependencies.
- [ ] **T020** Add admin-protected read-only usage API in YAML and provider adapters, with scoped secrets, cache, timeouts, stale-source reporting, and account-versus-app labeling.
- [ ] **T021** Implement responsive admin Usage & Quotas dashboard (known/unknown limits, 80%/95% warnings) with accessibility and failure-state tests.
- [ ] **T022** Publish and apply the repository [design system](../../docs/design-system.md): Material Symbols Rounded, pill selectors, color/action hierarchy, page-family anatomy and admin header refinements. Extract shared `AppShell`, `PageHeader`, `SegmentedNavigation`, `EventCard`/`EventFacts`, `ContentState`, `DataTable`, `FormPage` and `StatusMetricCard` primitives where they remove repeated style/structure. Preserve semantics, focus, light/dark themes, routes and permission behavior.
- [ ] **T022a** Migrate attendee browse/detail/My signups, administrator event/users/usage, profile/onboarding/editors and policy pages by family. Apply the shared table-versus-card rule, constrained task/document widths, staging notice treatment and quiet build footer without changing workflows or API behavior.
- [ ] **T023** Test visual parity, admin auth and provider outage isolation; verify no credentials/PII reach browser bundles or docs. Include light/dark and narrow-mobile checks, keyboard/focus/screen-reader coverage, selected-pill contrast, icon-size/label checks, PageHeader/card/table/form states, and functional equivalence for permission-gated controls.

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

## Full implementation batch authorization — execution record

The user subsequently approved implementation of **T001–T024 and T025–T026 preparation** as one coordinated batch. Permitted: code, migrations **as files only**, branches, PRs, tests, documentation. **Not permitted:** merge, applying staging/production migrations, staging/production deployment, new paid services, credential changes or expanded service permissions. Continue committing within the approved work without repeated confirmations. Staging and production acceptance remain separate gates.

**Participation persistence groundwork:** [migration 0005](../../migrations/0005_event_signups.sql) adds optional nonnegative event capacity and the five-column signup table; active uniqueness is enforced by a partial index. An atomic SQLite insert trigger prevents over-capacity writes and additional triggers reject lowering capacity beneath current active signups. [Database regression tests](../../tests/signups-database.test.mjs) exercise capacity, duplicate/rejoin history, unlimited/zero capacity, foreign keys and deleted events. **Do not execute this migration yet.**

**T010 architecture revision:** Preserve `users.email NOT NULL` and all existing session/agreement foreign keys; create additive `participation_identities` and nullable-email `user_stubs` tables instead. The earlier destructive users-table rebuild failed an FK regression and was replaced before staging. **Still required for T010–T011:** implement Worker APIs with server-clock cutoff, verified participant/admin permissions, atomic capacity and business-error translation; prove parallel D1 execution in staging after separate authorization. The SQL trigger cannot replace handler-level event-start and authorization checks.

**Next batches:** event APIs and safe private/public projections (T012–T013); attendee continuation and admin/stub pages (T014–T018); provider-availability assessment without new credentials (T019), dashboard and UI (T020–T023), then acceptance/release artifacts (T024–T026 preparation).

## Participation, user-claiming, usage and UI implementation — ongoing

- **T010–T011:** `0005_event_signups.sql` establishes capacity + unique active signups and `participation_identities` for registered/stub IDs; SQL triggers enforce overbooking and start cutoff, while Worker handlers verify permissions and withdrawal cutoff. `0006_unclaimed_users.sql` creates an additive nullable-email `user_stubs` table instead of rebuilding the referenced `users` table. Both migrations remain **unapplied**.
- **T012–T014:** Self signup/withdrawal, personal history and private names-only roster APIs exist; public events include aggregate count/capacity/remaining spots. Event detail has signup controls and a persisted one-time login return intent; My Signups displays active/withdrawn history. Full browser parity, simultaneous D1 race tests and all funnel failure cases still need acceptance.
- **T015–T017:** Administrator event signup page includes roster/history/search and explicit delegated signup/withdraw; separate Create User page makes optional-email stubs and returns to the event without automatically signing up. Verified OTP reuse of the stub ID with mandatory profile and personal policy acceptance is under integration test. Event editor capacity input/edit and server-side stale-version and below-active-count conflicts have local test coverage (T017 checked); live interaction and concurrency acceptance remain under T018/T024/T025.
- **T019–T021:** [Provider metrics availability](./provider-metrics.md) documents researched APIs, including Resend usage requiring a **new full-access credential (not authorized)**. Admin-only Usage & Quotas route and UI correctly show unknown/unavailable values when no access exists; no fabricated percentages. Live adapters remain blocked by unapproved credentials/account permissions.
- **T022–T023:** Material Symbols Rounded iconography, admin orange title and segmented navigation are implemented. The broader [design system](../../docs/design-system.md), shared page/component primitives, family-by-family migration, and final accessibility/browser visual parity remain open.
- **T024–T026:** [Release readiness](./release-readiness.md) prepares staging test/rollback checklists only. No live migration, merge or deployment is authorized.

**Design caution:** Cloudflare D1 requires foreign keys to remain enforced. Rebuilding existing `users` by dropping the referenced table was shown to fail even when constraints were deferred. Additive participation identity plus unclaimed-stub sidecar storage avoids altering existing registered account foreign keys. Test on actual D1 only after staging migration approval.

## Latest branch review and defensive fixes

After checking current `spec/006-event-signups` (rather than assuming T010–T023 were still absent), additional security/data-integrity regressions were committed:

- `0005_event_signups.sql`: enforce the exact event-start withdrawal cutoff within the SQLite update transaction, not only the Worker precheck, and make withdrawn historical timestamps immutable. Corresponding boundary tests include `deleted_at == start_at`, later withdrawals, and reactivation attempts.
- `0006_unclaimed_users.sql`: protect account/stub email collisions on email **updates**, not just inserts. Tests assert both directions of collision are rejected without changing the original identity.
- Previous branch work already includes self/admin signup APIs, aggregate public capacities, account claiming, attendee/admin UI, Usage & Quotas unavailable-state page, Material UI adjustments, and accessible relative event countdown. Acceptance gates remain open, notably actual D1 concurrency, live staging/browser flows and provider access. Do not reimplement existing features.

Both migration files remain unapplied; CI checks are tracked through the draft feature branch.

## Verified implementation task closeout (October 12, 2026)

The following checkboxes were closed after cross-checking source, migration files and the repository's tests; they represent **implementation deliverables on this branch**, not deployed/staging acceptance:

- **T002:** OpenAPI 3.1 contract skeleton, public/admin paths and security declarations are present in `openapi/openapi.yaml` and exercised by `tests/openapi-contract.test.mjs`. Detailed schema/status parity remains open under T001/T005/T009.
- **T010:** Additive migrations `0005_event_signups.sql` and `0006_unclaimed_users.sql` provide capacity, five-column active-unique history, `participation_identities`, and nullable-email sidecar stubs without rebuilding `users`; database and stub-migration regression tests exist. **Prepared, not applied**; real D1 and restore/integrity acceptance remains T011/T025.
- **T012:** Worker public list/detail return aggregate capacity/remaining counts, and the signed-in own-signup endpoint returns attendee state; `tests/events-public.test.mjs` covers public aggregate shape and own state.
- **T013:** Worker provides personal active/withdrawn history and current-participant names-only roster, denying anonymous and withdrawn-member access; `tests/events-public.test.mjs` covers withdrawn history, rejoin, roster projection and revocation. More adversarial cross-user/browser proof remains T018/T024.
- **T017:** Event editor includes optional capacity; Worker accepts unlimited capacity and enforces stale-version/below-active-count conflicts; `tests/event-form.test.mjs`, `tests/events-public.test.mjs`, and `tests/signups-database.test.mjs` cover invalid edits, deleted/archived behavior and preserved history. Manual UI and true D1 race acceptance remain T018/T025.

Other tasks remain unchecked because at least one stated deliverable or acceptance proof is missing; in particular generated API full parity, end-to-end signup/claim flows, provider access, and live D1 concurrency must not be inferred from local passing tests. No merge, migration execution or deployment was performed by this checklist update.

## T001–T009 coordinated integration pass (October 15, 2026)

- **T001 — partly verified:** The Worker already forwards declared operations through the generated dispatcher. Existing real-Worker SQLite characterization and browser tests cover principal event/auth/admin/signup routes. A full manual audit of every error status and deployed-route behavior is still outstanding; do not mark complete.
- **T002 — complete:** Single YAML contract with generated registry/client/validators; structural validation and endpoint safety tests run in CI.
- **T003 — partly verified:** The selected YAML-driven Fetch dispatcher and canonical request validator run in the production Worker. Selected mutations are validated following legacy-compatible normalization; the custom validator is explicitly not a complete OpenAPI 3.1/JSON Schema 2020-12 engine. Finish remaining operations before declaring full middleware migration.
- **T004 — selected, review gate remains:** `design.md` records the incremental YAML-first route/operation naming and SPA compatibility strategy. Explicit final breaking-change and route-name review remains part of signoff.
- **T005 — in progress:** Directory search parameters, nullable stub directory projections, authentication, event, participant and signup schemas are described and tested. Complete field-level schema parity for all 27 operations, not just core routes.
- **T006 — in progress:** Deterministic generators produce typed client/Worker registry, validators and static OpenAPI/Scalar assets. Validation is integrated for the main event/admin/profile/consent/auth flows but not yet every JSON body.
- **T007 — implementation complete on branch:** Event editor/deletion, administrator status/directory/user profiles, auth and signup flows use generated React API client. No direct `fetch()` remains in `src/main.tsx`; compatibility Playwright tests and explicit source guard cover this migration.
- **T008 — generated, deployment gated:** `/api/openapi.json` and `/api/docs/` assets are generated and tested locally. They cannot be verified on staging without separate deployment approval.
- **T009 — improved, partially complete:** Existing CI tests typecheck, build, browser/Worker behavior and OpenAPI generation. The baseline compatibility gate now checks operation IDs, security regressions, required request fields and response schema property/type regressions, with positive/negative fixtures. Full semantic schema-diff and released-client compatibility review remain manual gates.

**Boundary:** No merge, migration execution, staging or production deployment, credential expansion or paid services authorized by this work. Checked implementation boxes do not imply staging acceptance or release signoff.

## Phase 1 complete implementation pass — October 15, 2026

The remaining pre-staging work was addressed as a coordinated branch-level batch:

- **Validator parity:** Generated Worker JSON body validation now enforces numeric lower/upper bounds and array length bounds; event version `PUT`/`DELETE` schemas require a positive version, consistent with Worker business logic. `tests/openapi-contract.test.mjs` proves positive, zero, negative, nullable capacity and integer constraints.
- **Mutation coverage:** A contract regression enumerates every documented JSON mutation and requires its generated-validation operation to appear in the real Worker, with the empty logout body recorded as an explicit exception.
- **Response/status contracts:** Fourteen previously undocumented JSON error envelopes and missing delegated roster/signup 404/422 statuses have been added to the authoritative YAML. Every declared non-204 response must document JSON.
- **Real-Worker audit:** Isolated Worker/SQLite fixtures invoke all 27 declared operations anonymously and 26 under authenticated administrator context (logout excluded to avoid deleting the shared fixture mid-test). They verify declared HTTP statuses, JSON response envelopes and recursively checked required fields/JSON types. This is comprehensive *route sampling*, not proof of every possible success/error branch or a full JSON Schema 2020-12 validator.
- **Build reproducibility:** `api:generate` is available and CI compares generated client, route registry, validators and public OpenAPI JSON byte-for-byte across regeneration.
- **Usage & Quotas release scope:** The recommended first release retains the admin dashboard with explicit Unknown/Unavailable metrics and no live provider entitlement expansion. Genuine account usage integrations are optional follow-up work requiring separate credential and account authorization. See `provider-metrics.md`.

**Still not a staging signoff:** T001 includes deployed-vs-document verification and hard-to-reach status branches; T004 needs explicit design approval; T005 remains open for complete field-by-field response typing and schema/normalization review; T008 cannot be closed without a separately authorized deployment. Existing code-level checks cannot establish real Cloudflare D1 concurrency, restore integrity, provider access or assistive-technology acceptance. No live database, staging service, production environment or credentials were changed during this pass.
