# SDDW-006 — Implementation Task Plan

**Status:** Proposed sequencing for approval, not authorization to modify application/deploy.
**References:** [requirements](./requirements.md) · [design](./design.md)
**Milestone:** One SDDW-006 with separate workstream PRs. Checkboxes track completion, not separate releases.

## Gate 0 — Architecture proof and route inventory (first)

- [ ] **T001** Inventory all deployed HTTP endpoints/methods, auth cookies, CSRF/origin requirements, response shapes and error codes; record characterization tests for main.
- [ ] **T002** Write OpenAPI 3.1 YAML skeleton with security schemes, public/admin grouping and existing routes; lint schema and examples.
- [ ] **T003** Spike pinned generation candidates on **one public GET and one authenticated mutation**, generating **both** frontend client and Worker-compatible server operation/dispatch contracts; prove runtime validation and CSRF in Worker tests. Record tool decision and limitations in `design.md`. **Blocker if no qualifying generator**.
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
