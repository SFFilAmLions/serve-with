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
