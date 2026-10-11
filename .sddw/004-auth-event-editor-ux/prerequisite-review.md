# SDDW 004 — Implementation Prerequisite Review

**Status:** Reviewed for planning; no database migration applied, dependencies installed, policy text published, or production behavior changed.

## 1. Date/time picker — resolved at package/license level

The repository uses React 19 and MUI Material 7 and does not yet depend on MUI X or a picker adapter. Select the **MIT-licensed Community** package `@mui/x-date-pickers`, not `@mui/x-date-pickers-pro`. Its individual DatePicker and TimePicker controls meet the design; no paid range picker is needed. Add `dayjs` and `AdapterDayjs` with a single `LocalizationProvider` at implementation time. Retain `@js-temporal/polyfill` for authoritative time-zone conversion and DST rejection on the server. Verify compatible resolved versions and lockfile in CI when installing; this review does not claim a successful install/build.

Official references: https://mui.com/x/react-date-pickers/quickstart/ and https://mui.com/x/introduction/licensing/

## 2. Existing auth/database — reviewed, migration proposed

Current migrations: `0001_auth.sql` creates email-keyed `login_challenges` and `sessions`; `0002_auth_rate_limits.sql` adds hashed rate counters; `0003_events.sql` adds versioned soft-deletable events. **No Users/profile/acceptance tables exist.** `src/worker.ts` checks admin membership using generated `config/admins.yaml` email entries; `/api/auth/me` exposes only authenticated/email. Staging and production have distinct `AUTH_DB` D1 bindings in `wrangler.jsonc`.

Plan additive `0004_users_and_agreements.sql`:
- `users`: stable UUID ID; unique normalized email; nullable first/last name and DOB (YYYY-MM-DD calendar date) until onboarding; email verification timestamp; immutable created_at, updated_at; nullable terms_accepted_at; accepted Terms and Privacy version identifiers.
- `agreement_acceptances`: append-only ID, user ID, Terms version, Privacy version and timestamp (plus minimum audit metadata if approved); no destructive replacement of acceptance history.
- `user_dob_audit`: actor user ID, subject user ID, timestamp and change metadata without raw DOB in logs; decide secure old/new-value handling before implementing.
- Preserve existing sessions/challenges through migration. On verified login or session resolution, idempotently map normalized email to one user row, maintaining stable ID; avoid duplicate user creation under concurrent verification.
- Keep `config/admins.yaml` as administrator authorization only. Existing enabled admins are eligible regardless of whether their user row exists yet, but must complete missing profile/current agreements before mutations. **Do not** prepopulate or infer DOB/name/acceptance from admin config.
- Introduce a **separate server-only staging email allowlist**, including existing enabled admins. Do not embed it in the public client bundle, and do not repurpose the admin role list as registration eligibility. Preserve non-enumerating login request responses and rate limits.
- Add authorization tests for user ID lookup, owner isolation, admin DOB correction, missing/expired agreements and direct API access. No `is_active`, email-change, deletion, signup or recovery-key schema in this migration.

The exact migration SQL, privacy/retention choices, and staging secret provisioning need implementation review. No remote D1 contents or deployed secrets were inspected; source configuration alone cannot establish which migrations are applied remotely.

## 3. Terms and Privacy — mechanism proposed; publication still blocked

No published Terms of Use or Privacy Policy files/routes are present in the repository tree reviewed. Do **not** invent legal terms or claim publication.

Propose public versioned routes `/terms` and `/privacy` for current readable documents, backed by immutable version identifiers (e.g., an approved date or explicit revision string) in server-controlled configuration. Preserve historical approved text per version so acceptance events remain interpretable. Registration links both documents and requires one unchecked acknowledgment; server writes one append-only acceptance event containing both required versions and a timestamp. The user's `terms_accepted_at` is the latest accepted-at value, distinct from immutable account creation. When either required version changes, gate privileged mutations and show a reacceptance-only state. Avoid exposing optional data-processing consent as part of this required acknowledgment.

**Blocking decision:** the organization must supply/review/approve the actual Terms and Privacy text, their effective dates/version identifiers, publication/archival location and change/reacceptance policy before onboarding real attendees. Policy text is not authored or published by this technical review.

## 4. Existing implementation deltas

- The current email template says to open a magic link **then confirm sign-in**; SDDW 004 requires automatic one-time POST exchange and revised copy.
- Existing session lookup is email-based and admin-only; it must be adapted to stable user IDs, registration eligibility and agreement/profile gates without breaking active sessions.
- Existing public events API is list-only; canonical `/events/:id` requires an explicit public detail read API or equivalent validated lookup.
- `src/theme.ts` currently exposes only light/dark theme generation; the UI needs a System preference wrapper and a distinct Administrator app-bar treatment.
- Event time validation already uses Temporal and rejects ambiguous/nonexistent local times. Keep that authoritative behavior when adding MUI X controls.

## Remaining gates

1. Approve and publish Terms/Privacy documents and versions.
2. Approve concrete D1 migration and audit retention choices; confirm deployed staging database state and allowlist secret configuration.
3. During authorized implementation, install Community picker + Day.js, commit lockfile and run build/browser accessibility/DST tests.
4. Keep PR #13 draft and do not merge/deploy or enable production attendee registration without separate approval.
