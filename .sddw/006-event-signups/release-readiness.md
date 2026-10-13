# SDDW-006 — Staging and release preparation (T025–T026)

**Preparation only.** Approval does not authorize merging, deploying, running migrations, modifying secrets, adding providers, or changing service permissions.

## Before staging authorization
- [ ] All T001–T024 requirements have corresponding automated or manual evidence.
- [ ] Complete a formal schema-level OpenAPI drift review, including role, security and error responses.
- [ ] Check signup capacity and start-time cutoff under actual concurrent Cloudflare D1 requests.
- [ ] Approve migrations 0005 and additive 0006 participation-stub schema; exercise both on a restored staging copy.
- [ ] Verify foreign keys and archived/withdrawn history with the additive participation identity and user-stub tables; no existing users-table rebuild is planned.
- [ ] Verify zero overbookings and no duplicate active signup at event capacity 1 using parallel users.
- [ ] Verify login return intent, magic-link across tabs, full/started/deleted events, error recovery, exactly once continuation.
- [ ] Confirm participant roster reveals names only to active participants and immediately revokes on withdrawal.
- [ ] Verify admin roster and stub claim path with email verification, profile requirements, and separate consent.
- [ ] Verify Scalar docs JSON endpoint resolves to JSON instead of SPA HTML; disable automatic mutating requests.
- [ ] Verify usage data source authorizations and quota provenance without adding unapproved credentials.
- [ ] Verify keyboard interaction, theme contrast, browser layout and screen reader labels.

## Migration/rollback approach
Migrations are forward-only and **must not be applied under this batch's current permissions**. Before staging, create an authorized backup and test restore on a disposable isolated database. Do not drop signup records to roll back a partial release: retain five-column row history and record additive corrections in later migrations. The additive `participation_identities` + `user_stubs` design must preserve existing `users` rows and all existing account/session/agreement/DOB-audit foreign keys, while keeping event signup IDs stable through verified-email claims; run `PRAGMA foreign_key_check` on a representative copy.

## Release record (fill only with actual evidence)
- Staging migration authorization: **not granted**
- Staging deployment authorization: **not granted**
- Production migration authorization: **not granted**
- Production deployment authorization: **not granted**
- CI: [GitHub Actions CI #435](https://github.com/SFFilAmLions/serve-with/actions/runs/38215550077) **passed** for commit `5ca9ba3bb7373122300ac738e2940e5eef524cb6`. [OpenAPI generator spike #142](https://github.com/SFFilAmLions/serve-with/actions/runs/38215550116) and PR-title validation #426 also passed. A green PR build is not staging acceptance; new commits require renewed checks.
- Rollback drill evidence: pending
- Accessibility and security sign-off: pending
- Release notes: pending tested behavior inventory and separately approved release

## Verified test evidence versus pending external proofs (October 12, 2026)

| Gate | Evidence | Remaining verification |
| --- | --- | --- |
| Event capacity edit | Worker/SQLite integration test covers finite/unlimited capacity, stale version 409, below-active-count 409 and unchanged persisted state; form model tests cover blank, zero and invalid capacities | Manual event editor interactions, actual Cloudflare D1 parallel signup/edit races |
| Participant privacy/history | Worker test covers names-only active roster, 401 unauthenticated access, 403 after withdrawal, and retained active/withdrawn history after rejoining | Other-user authorization, simultaneous withdraw/roster reads and browser acceptance |
| Delegated admin operations | Worker test covers duplicate prevention, withdrawn history retention, immutable attendee identity, and rejection after event start | Broader stub-claim authentication and role-isolation scenarios |
| Schema-generated API | OpenAPI generator spike #142 passed | Full route/status/error schema parity and stricter breaking-change comparison |
| Release security | No migrations applied and no production release initiated as part of this batch | Staging backup/restore drill, permissioned deployment and independent signoff |

Do not interpret these SQLite-backed tests as actual parallel D1 request proof. No credentials, staging migrations, deployment or production release are authorized by this record.


## Isolated staging verification runbook (prepared; authorization required)

**Prerequisites:** designated nonproduction D1 binding/database and permissions; an authorized point-in-time export; confirmed restoration target; sign-off for staging writes. Never point the following checks at production. Use a fresh disposable database or restored **staging copy**, not the original asset, for migrations and destructive test fixtures. Record command, source revision and timestamp with each result.

1. Inventory and backup: document current schema and migration journal, download a D1 export using the authorized Cloudflare tooling, retain a separately verified backup, and check the export can be opened as SQLite. Protect any exported personal data. Do not capture emails or secrets in public CI artifacts.
2. Restore to a second isolated test database; confirm row counts for `users`, `sessions`, `agreement_acceptances`, `events`, and any existing signup table. Establish a baseline using `PRAGMA foreign_key_check;` (must return no rows) and `PRAGMA integrity_check;` (must return `ok`). Resolve pre-existing inconsistencies **before** migration.
3. Apply **only to that authorized clone**, in order: `migrations/0005_event_signups.sql` then `migrations/0006_unclaimed_users.sql`. The migrations are forward-only; do not use a downgrade script or delete signup history. Confirm `PRAGMA foreign_key_check;` and `PRAGMA integrity_check;` again and compare pre/post user, session, consent and event counts.
4. Repeat a capacity-one race with two different fully registered test identities and genuinely concurrent Cloudflare D1-backed Worker requests; assert exactly one successful creation, one conflict, and one active row. Verify finite capacity 0, unlimited null, repeated same-identity attempts and simultaneous capacity reductions. Local `node:sqlite` tests do **not** substitute for this evidence.
5. Verify event-start boundary by sending pending requests on both sides of the cutoff, inspecting server-side timestamps, actual persisted rows and denied responses. Verify withdrawal preserves one immutable historical row and rejoin creates a separate one. Confirm no hard-deletes, identity reassignment or original timestamp edits.
6. Exercise claims and delegated operations using dedicated test accounts, including duplicate-email collision, failed verification, eligible verified-email claim, historical signup continuity, access without self-attested consent, and role restriction. Confirm no administrative operation writes acceptance timestamps on behalf of users.
7. Run the browser/keyboard/screen reader checks and compare generated OpenAPI operation IDs, security requirements, errors and response bodies with the deployed staging build. Verify `/api/openapi.json` returns JSON and `/api/docs` shows docs rather than SPA fallback. Disable any mutating API-docs request execution.
8. Review monitoring/limits against documented provider source permissions; unavailable data must remain explicitly unavailable, never `0` or a fabricated budget. Log source, refresh timestamp and cache freshness for each available provider.
9. To recover a failed **staging** migration, stop test traffic, retain the failed DB image and logs, restore the verified pre-migration export into a **new nonproduction database**, run integrity and FK checks, then redirect only staging test bindings once separately approved. Do not roll back by deleting records or mutating the live database. Prepare a corrective forward migration if partially applied state requires remediation.

**Exit criteria:** each step has an owner, evidence artifact, exact commit and database identity, with zero FK errors, zero overbooking, no cross-user roster access, no compromised consent and no unreviewed production or staging changes. Missing evidence is a failing gate, not implied approval.

## Non-deployment finishing batch — October 13, 2026

The following regression additions are committed to the feature branch, but must not be described as passing until CI completes on their exact revision:

- `tests/openapi-contract.test.mjs`: unique operation IDs, anonymous event read contracts, names-only participant roster contract, and authenticated admin usage metrics with nullable unknown values and explicit 401/403 cases.
- `tests/browser/events.test.mjs`: a full event shown to an anonymous viewer has no actionable signup or participant roster and issues neither roster reads nor signup POSTs.
- Prior verified baseline: [CI #470](https://github.com/SFFilAmLions/serve-with/actions/runs/38237670036) passed at `d7e43df`; it predates the above new tests.

### Draft release notes — not yet a release announcement

**Features proposed:** event capacity and signup/withdrawal with preserved history; personal signup history and participant names-only views; administrator delegated signups and unclaimed-user onboarding; OpenAPI-derived client/Worker contracts and API documentation; administrator Usage & Quotas unavailable-state dashboard; Material UI enhancements.

**Privacy/security boundaries:** public endpoints expose aggregate signup numbers, not identities; participant names require active participation; administrator actions require authorization; verified email, profile completion, age and policy gates remain mandatory; capacity/cutoff must be checked server-side. Unknown provider quotas must not be reported as zero.

**Before release:** close remaining branch tests and review precise OpenAPI response/status parity; prove atomic capacity-one races and schema integrity against authorized isolated Cloudflare D1; run browser, accessibility, stub claiming and provider failure checks against an approved staging deployment; record authorization, backup/restore proof and release signoff. No migrations, merge or deployment authorized by this record.

## Contract authorization guardrails — October 13, 2026

Additional branch checks in `tests/openapi-contract.test.mjs` assert that the unclaimed-user creation operation is administrator-authenticated, requires names, allows an absent email, explicitly documents collision and validation errors, and does not expose consent or privilege fields as accepted named input properties. They also assert that self-signup POST and withdrawal DELETE document session authentication, a required Origin header, and 401/403/409 outcomes.

These are **contract-shape tests only**; `additionalProperties` and runtime handler validation must still be assessed before describing unexpected-input rejection as guaranteed. Runtime enforcement, cross-account identity claiming, and real Cloudflare D1 concurrency remain separate acceptance gates. This section records intended test coverage; verify the exact HEAD in CI before claiming it passed.
