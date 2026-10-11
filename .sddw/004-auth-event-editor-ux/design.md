# SDDW 004 — Simplified Technical Design

**Status: Proposed for review, not approved for implementation.** Source: [requirements.md](requirements.md).

## Architecture and permissions

Keep React/Vite/MUI frontend, Cloudflare Worker, D1, Resend and existing events APIs. Use routed pages and a common application shell. Preserve `config/admins.yaml` as email-only admin authorization, separate from a private server-side staging email-only signup allowlist. The server derives permissions from a verified session, complete profile, current required Terms/Privacy acceptance and current admin allowlist. Public events remain anonymous.

## Routes

| Route | Access | Function |
| --- | --- | --- |
| `/` | Public | Attendee/public upcoming and past events |
| `/login` | Public / limited verification session | Email-first code/magic flow with inline profile/terms completion |
| `/profile` | Verified owner | View verified email/DOB; edit names |
| `/admin` | Active authorized administrator | Admin workspace |
| `/admin/events/new` | Admin | New or duplication-prefilled Create Event |
| `/admin/events/:id/edit` | Admin | Existing-event editor, recommended dedicated page |
| `/admin/users` | Admin | Searchable user directory excluding DOB |
| `/admin/users/:id/edit` | Admin | Edit names and audited DOB correction |

Admins default to Attendee view and may switch modes; the public cannot access admin endpoints through guessed URLs. Users missing profile or current acceptance get a restricted completion state.

## Auth and data model

1. Normalize/validate email server-side, check staging-specific eligibility without exposing identities, then send code and magic link through existing infrastructure. The link exchanges via one-time POST automatically with URL token scrubbing and duplicate-exchange protection.
2. Look up verified email or create an idempotent pending-profile user. Existing admin emails can complete profiles through the same flow.
3. Add a D1 `users` table with stable ID, unique normalized email, first/last name, DOB as YYYY-MM-DD calendar date, verified-email timestamp, `created_at` and `updated_at`, nullable `terms_accepted_at` and accepted terms/privacy version references.
4. Server configuration defines required document version(s). A valid latest acceptance must match those versions, in addition to verified email and complete profile. Keep historical acceptance events in a small append-only table (user ID, document versions, timestamp). New versions or explicit deactivation invalidate current accepted version/timestamp without altering `created_at` or historical events.
5. Display one unchecked required linked Terms/Privacy acknowledgment after verified login when needed. Re-acceptance for deactivated/older-version accounts does **not** require reentering valid PII. Preserve session security, authorization gates, origin checks, rate limits and non-enumeration.

**Note:** a Terms/Privacy acknowledgment is an access condition, not a substitute for separate consent where law requires it. Publication and version-management procedures must exist before enabling registration.

## Account / admin pages

Own profile: names editable, email and DOB read-only. Admin Users: query limited to authorized server-side paginated name/email search, excluding DOB; Admin Edit User: names and admin-only DOB correction, auditing actor/date without raw DOB in logs. No Create User, email change, account deletion, deactivation-key or recovery endpoints in this release.

## Event editor

Share event fields across dedicated Create/Edit pages; duplicate action loads editable values into Create without source identity/version/timestamps and creates only on Save. Prominent start date and equal time inputs, clock/manual accessible pickers, inline elapsed duration, collapsed End date/Time zone with start-date follow-until-override. Preserve IANA/DST handling, overnight/multiday, optimistic version checks, error draft preservation and unsaved navigation guards.

## Verification and rollout

Test sign-in/code/magic expiry and replay, eligibility, admin transition, latest-terms gate, profile ownership, attendee prohibition on Users directory and APIs, audited DOB correction, duplicate create-not-update and date/DST behavior. Run CI; stage and verify after approved merge. README must reflect verified live state; production never automatically gains registration policy or deployment approval.

## Open before implementation

- Confirm Edit Event as a dedicated page and choose the clock/date picker library and placement.
- Prepare actual Terms/Privacy documents and decide how to publish required versions.
- Confirm migration and existing-admin transition. Details of future deletion/recovery are tracked only in [deferred-account-lifecycle.md](deferred-account-lifecycle.md).
