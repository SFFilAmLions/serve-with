# SDDW-006 — Technical Design

**Status:** Proposed for review; no implementation authorized by this document.
**Scope:** One milestone with three workstreams. [Requirements](./requirements.md) are authoritative for product behavior.

## Baseline and boundaries

The current Cloudflare Worker (`src/worker.ts`) handles paths manually and uses D1, cookie sessions, email magic links, Resend and Turnstile. The React app currently calls the existing HTTP API. Retain its public URLs, security guarantees and staging/production isolation during migration. Existing profile completion requires verified email, first/last name, valid age-eligible DOB and current Terms/Privacy acknowledgement. The current admin capability is an allowlist; do not infer organization-scoped roles.

Workstreams: **A. API contract and generators**, **B. participation and identity**, **C. quotas and UI polish**. Distinct workstreams are not separate SDDWs or independent production releases.

## A. OpenAPI-first API architecture

### Source of truth and artifact flow

`openapi/openapi.yaml` (OpenAPI 3.1) is edited and reviewed by humans. All endpoint paths, operation IDs, inputs, statuses, errors, JSON schemas, auth/security declarations and synthetic examples live there. A pinned, reproducible `npm run api:generate` produces:
- Browser-compatible, typed React API client with cookie-based same-origin credentials.
- TypeScript server operation signatures, DTOs and routing/adaptor contracts for Cloudflare Workers.
- `/api/openapi.json` from the canonical YAML, rendered by Scalar at `/api/docs`.

Handwritten handlers implement authentication, authorization, data persistence, validations and error handling *behind* generated server interfaces. Generated files have generated headers and must not be manually modified. No independently authored duplicate endpoint types or divergent TS route definitions.

### Required generator proof-of-concept before selection

Evaluate **OpenAPI Generator** (TypeScript fetch client + TypeScript server interface option, if suitable), and/or **openapi-typescript + openapi-fetch** for browser bindings with a **separately generated typed server operation adapter**. A typed client generator by itself **does not meet** the server-generation requirement. Prefer a toolchain that fully supports OpenAPI 3.1 without flattening security schemes or losing nullable schema semantics. Evaluate actual versions and licenses during the spike; pin exact versions thereafter. Do not treat a generated Express/Node runtime as Cloudflare-compatible merely because its types compile.

Acceptance for the spike: one existing public event GET and one authenticated mutating endpoint are driven from YAML through generated client and server signature/dispatch, run in a Worker test environment, enforce cookie auth/origin checks and actual runtime request validation, and preserve current response/status behavior. Document findings/selection in this file before full migration. If no candidate meets the requirement, stop for design review rather than silently reverting to handwritten server routing.

### Leading candidate and proof requirements (research, not approval)

The leading proof-of-concept stack is **OpenAPI YAML → openapi-typescript generated TypeScript operation types → openapi-fetch browser client**, plus **OpenAPI Backend** as an OpenAPI 3.1-driven router/validator, coupled to **generated typed server handler contracts and an operation binding layer** that run in Cloudflare Workers. OpenAPI Backend supplies runtime dispatch and request validation, **not** generated server implementation; generate the missing server bindings rather than presenting a handwritten handler map as generated code. Avoid Node-only adapters.

Run the proof before selecting or pinning versions: generate code from the YAML, compile with existing Worker/Vite toolchain, exercise `GET /api/events/{id}` and `POST /api/admin/events` against a Worker-compatible test harness, verify handler parameter types, secure-cookie behavior, same-origin Origin/Fetch Metadata, role gate, invalid input behavior, exact 201/error schema, and that OpenAPI-derived runtime validation neither inadvertently coerces nor rejects previously valid payloads. Measure startup/bundle size and ensure YAML compilation into bundled JSON does not rely on filesystem access at runtime.

If runtime validation conflicts with current handler-side trimming or lenient extra fields, document an explicit contract/migration choice instead of silently altering production semantics. Server operation bindings must be generated and drift-tested; a client-only generation demonstration is insufficient to mark T003 complete.

### Confirmed schema compatibility issue (T003)

The event creation Worker currently trims `title` and `location`, rejects values that become blank after trimming, and ignores unknown JSON request keys. The initial `EventCreateInput` YAML has `additionalProperties: false` and only `minLength: 1`; enabling direct AJV validation as an early gate would therefore **reject currently accepted payloads** with extra keys while **accepting whitespace-only strings** (which the Worker later rejects). The runtime spike now explicitly tests both mismatches.

**Decision needed before production wiring:** Preserve legacy request semantics in a compatibility adapter/normalization step, with the OpenAPI schema documenting accepted raw input versus canonical normalized values, or explicitly approve a breaking validation change. Keep authorization and same-origin/CSRF checks before any write, and never allow schema coercion to bypass these checks. Do not label the schema-driven Worker boundary production-ready until real integration tests demonstrate parity for known edge cases.

### Contract migration and publication

Inventory *all* existing API routes/methods, including authentication and profile gates, before writing schemas. Freeze observed payloads/status codes as characterization tests, then migrate route by route without changing behavior unexpectedly. Publish docs/schema publicly (staging then production through existing release process); API example data must be fictitious, and interactive “try” operations do not bypass auth/CSRF checks. Coordinate SPA fallback to avoid serving `index.html` at API docs/schema routes.

CI: YAML syntax and OpenAPI structural lint, generation repeatability/drift, TypeScript compilation, runtime request/response contract tests, compatibility diff against main, and test of generated client -> Worker handler integration. Explicit approval required for incompatible API changes.

## B. Participation and identity

### Data model

D1 migration adds `events.capacity INTEGER NULL` with `CHECK(capacity IS NULL OR capacity >= 0)` as appropriate for SQLite migration capabilities. Existing event editing validates that a lowered finite capacity is not below current active signups.

```sql
CREATE TABLE event_signups (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE UNIQUE INDEX event_signups_active_unique
  ON event_signups(event_id,user_id) WHERE deleted_at IS NULL;
CREATE INDEX event_signups_event_history ON event_signups(event_id,created_at);
CREATE INDEX event_signups_user_history ON event_signups(user_id,created_at);
```

Only active rows (`deleted_at IS NULL`) count toward capacity. A withdrawal timestamps the current row; rejoining inserts a new UUID row. No signup status column, event-attendance conclusion, separate audit table or actor field. Confirm referential handling for archived events and users before migration.

For stub users, introduce a **minimal explicit unclaimed state** or equivalent flag, nullable normalized email, optional DOB, required first/last names and no recorded agreement. Inspect current user constraints/indexes and write a safe data migration before choosing exact column DDL. Preserve stable user IDs and email uniqueness; unclaimed records are never automatically privileged. Stub profile/consent rules are distinct from full-account readiness.

### Transactional signup algorithm

All signup mutations verify authentication, identity eligibility/approved admin delegation, event existence, and `server_now < start_at`. For a finite-capacity event, enforce occupancy atomically *in the database* rather than counting then inserting in separate unprotected requests. Preferred design: one conditional `INSERT INTO event_signups ... SELECT ... WHERE event is open AND (capacity IS NULL OR (SELECT COUNT(*) ... active) < capacity)` within a D1 write statement, protected by the partial unique index. Prove D1 concurrent request semantics with actual Worker/D1 integration tests before relying on this pattern; if it cannot guarantee correct capacity under contention, choose a documented serializing approach supported by D1. Never depend on frontend counts or non-atomic D1 read-then-write. Distinguish full, already-signed-up, and started outcomes without leaking identities. Withdraw using conditional `UPDATE ... SET deleted_at = ? WHERE deleted_at IS NULL AND event start > server_now`; report conflict or cutoff correctly. The same cutoff applies to admins.

### Read permissions and API shape (provisional; encode in YAML)

- `GET /api/events`, `GET /api/events/{eventId}`: anonymous list/detail, aggregate active count, capacity and remaining when finite.
- `POST /api/events/{eventId}/signups`: authenticated self signup; idempotent UI intent, unique database enforcement.
- `DELETE /api/events/{eventId}/signups/me`: withdraw current signup before start.
- `GET /api/me/signups`: own active and withdrawn history.
- `GET /api/events/{eventId}/participants`: names-only active roster, available only to a current active participant; avoid DOB/email/withdrawn history.
- `GET /api/admin/events/{eventId}/signups`, `POST /api/admin/events/{eventId}/signups` and admin withdrawal operation: admin roster/history and on-behalf-of actions.
- `POST /api/admin/users`: admin-only name-required stub creation; retain existing admin search and profile correction behavior.
- Public event routes must be identical for administrators and non-administrators.

These endpoints are proposals, not already implemented. Reuse existing paths wherever necessary to avoid collisions. Define stable status/error envelopes (400, 401, 403, 404, 409, 422, 429) in YAML after comparing current responses.

### Anonymous sign-up continuation

Keep an opaque, non-sensitive **event ID signup intent** across login/magic link and profile completion. Prefer same-origin session storage with a validated, bounded-life intent; determine cross-device magic-link behavior explicitly during implementation. Never put session tokens, untrusted redirect URLs, or private profile information in intent. Resume once only after verified login + all required fields + current agreements. Server still decides capacity/cutoff at submission; mark intent completed/consumed and resist remount/reload double POST. Network ambiguity requires safe idempotency/active-row reconciliation.

### Admin-created stubs and claiming

Admin event page includes existing-user search and Create user action; new-user form shares registration field components, first/last name required, others optional, and no admin-imputed policy consent. After creation, return to admin signup with the stub selected, requiring explicit confirmation.

Claiming uses **ordinary verified-email sign-in and account creation/reactivation**: an unclaimed stub with that verified email resolves to the same user ID, subject to collision checks. Without an email, it cannot be claimed. All standard required profile fields and the current user's own Terms/Privacy acceptance are mandatory before normal access. Do not match by names; prevent concurrent double-claims and do not send auth to an email not verified through the ordinary challenge flow. Review eligibility and age implications before deploying stub signups.

### Navigation and UI

- Standard event detail retains the canonical route, self-signup button (`Sign up` anonymous; `Sign up as {first name}` authenticated), public availability, and single-unit relative time (`In 2 days`). Signed-up participants see minimal current participant names; admin does not acquire extra controls on the standard page.
- Choose a distinct admin route (proposed `/admin/events/:id/signups`) without conflicting with existing editor URLs. This route hosts admin roster/history, user selection, stub creation entry and delegated mutations.
- Non-admin navigation to an admin event route redirects to the same public event, with a one-time accessible Material Snackbar warning; admin API still returns forbidden.
- `My signups` offers upcoming/past active and withdrawn history; historical active signup must never be labeled confirmed attendance.
- UI visual refinements use Material Symbols Rounded sizes and gold/orange/pill conventions from requirements; preserve light/dark, focus and responsive behavior.

## C. Administrator usage and quotas

Proposed `/admin/usage` UI and admin-protected read-only API defined in YAML. Backend provider adapters retrieve Cloudflare Workers/D1 analytics, Resend sending usage, and Turnstile metrics *only to the extent presently supported by the account's plan and APIs*. Validate actual API/plan access in a spike before promising every metric. Query credentials live in Worker secrets, preferably scoped separately from transactional email credentials; no client secrets. A 5–15 minute cache reduces rate/cost; provide `collectedAt`, `stale`, `source`, `scope`, `unit`, `period`, `used`, and nullable `limit`/`remaining` with clear unknown semantics. Avoid replacing failed readings with zero. Do not combine account-wide totals with per-Worker totals under one label. Warn at 80%/95% only when a valid denominator exists. Provider failures do not block signup or login. No automated alerts in this increment.

## Risks and required proofs

1. **Highest:** OpenAPI 3.1 server interface generation must actually work in a Cloudflare Worker and support runtime validation; resolve before refactoring existing endpoints.
2. **Highest:** Verify D1 capacity concurrency with parallel Worker requests and atomic statement; partial unique index alone does *not* prevent over-capacity across different users.
3. **High:** Existing schema's email uniqueness/nullability, profile readiness and email verification must support stubs without weakening ordinary login. Avoid double identity creation.
4. **High:** Provider API availability, account-wide quotas, scope of credentials and provider cost are variable; mark unsupported values unavailable.
5. **Moderate:** Magic-link round-trips, SPA route redirects, and accessible toast/countdown states need browser tests.

## Implementation / approval boundaries

Complete [tasks](./tasks.md) in small PRs, verify staging, then request explicit release approval. This document does not authorize merging, production changes, migrations or third-party credential creation. Workstream tasks may proceed in separate PRs under the **single SDDW-006** milestone after technical choices are approved.

## Batch 1 architecture implementation decision (October 11, 2026)

**Chosen incremental direction:** `openapi/openapi.yaml` remains the only editable HTTP contract. Repository generators produce typed browser helpers (`scripts/generate-openapi-client.mjs`), a Cloudflare Fetch API operation registry/dispatcher (`scripts/generate-openapi-operations.mjs`), and selected JSON-schema-derived body validation functions (`scripts/generate-openapi-validators.mjs`). The build also emits `public/api/openapi.json` from YAML and Vite packages Scalar docs from `public/api/docs/index.html`. The existing Worker business handlers retain authentication, per-user rights, CSRF/origin checks, canonical normalization and D1 access. Documented methods flow through generated dispatch and delegate to these existing handlers; unmatched legacy methods retain the existing routing fallback during this transition.

**Trade-off:** The custom generation scripts are currently restricted to the OpenAPI constructs used by this project; the body validator is **not a full JSON Schema 2020-12 implementation** (notably it has limited support for combinators/formats). Do not claim universal OpenAPI 3.1 schema compliance or rely on it as the only server-side security control. Existing handler validation remains authoritative while compatibility is established. The optional off-the-shelf `openapi-typescript@7.13.0` generation spike remains a comparison fixture rather than a committed second source of truth.

**Release boundaries:** These changes remain on the SDDW-006 branch. `/api/openapi.json` and `/api/docs/` become publicly accessible **only after the branch is merged and an authorized deployment is made**. Scalar uses version-pinned third-party CDN JavaScript; consider bundling or CSP pinning before production authorization. Deployment and merging are expressly unapproved. Keep the PR draft pending full endpoint parity, security testing, contract completeness and CI sign-off.
