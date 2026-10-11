# SDDW 004 — Core-Flow Technical Design

**Status: Proposed; implementation not approved.** Derived from [requirements.md](requirements.md).

## Existing stack and boundaries

Retain React/Vite/MUI, Cloudflare Worker, D1, Resend and current events APIs. Reuse the existing authentication infrastructure. Public event reads remain anonymous. Keep `config/admins.yaml` email/enabled for administrator authorization and a distinct private server-side staging email allowlist for account creation/activation. Do not introduce lifecycle status flags, account deletion or recovery services.

## Routes and access

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Upcoming/past events and attendee landing |
| `/login` | Public / limited verified session | Code or magic-link login, inline profile and agreement completion |
| `/profile` | Verified owner | Edit names; view read-only email and DOB |
| `/admin` | Eligible administrator | Separate admin workspace |
| `/admin/users` | Eligible administrator | Paginated name/email directory |
| `/admin/users/:id/edit` | Eligible administrator | Edit names, audited DOB correction |
| `/admin/events/new` | Eligible administrator | Create or duplicate-prefilled event |
| `/admin/events/:id/edit` | Eligible administrator | Edit existing event |

All privileged APIs independently verify authenticated session, verified email, complete profile, current agreement and role. Incomplete or outdated accounts may access only completion/reacceptance/logout; do not expose privileged endpoints through direct navigation.

## Authentication and persistence

1. Normalize and validate email server-side. Check staging eligibility without revealing whether an account or allowlist entry exists. Send the existing eight-digit code and magic link; exchange link tokens once via POST automatically, scrub URL/history, and enforce expiration, replay protection, origin validation and rate limiting.
2. Resolve a verified email to a stable user ID or idempotently initialize an incomplete profile. Existing configured admins complete the same flow.
3. D1 user record: stable ID, unique normalized email, first/last name, DOB as calendar date, email-verification timestamp, immutable `created_at`, `updated_at`, nullable `terms_accepted_at`, and accepted Terms/Privacy version references.
4. Append-only acceptance history stores user ID, accepted versions and timestamp. Compare accepted versions against server-configured required versions. Missing/outdated acceptance is an access gate, not account deactivation or a lifecycle transition. Do not create `is_active`, deactivation APIs or recovery keys.
5. Show one unchecked Terms/Privacy acknowledgment when needed, including reacceptance after version changes, without reentering valid personal details. Publication and version-management procedure must precede onboarding.

## Account experience

Top-right MUI app-bar account controls replace bottom auth. Default to Attendee mode; admins can switch workspaces. Owner profile edits names only; DOB/email display read-only. Admin-only paginated directory excludes DOB from list responses. Admin edit permits names and audited DOB correction; omit raw DOB from logs. Never infer authorization from hidden UI controls.

## Event experience

Dedicated Create and Edit pages share field controls and validation. Start date is prominent; Start/End time are equal-width clock-capable accessible controls with nearby live Duration. End date/time zone are collapsed; end date follows start until override. Use IANA `America/Los_Angeles` by default, with DST and multiday validation. Duplicate opens Create with editable fields only, strips source ID/version/timestamps, and persists a new event only on explicit Save. Preserve optimistic concurrency, draft/error retention, unsaved-navigation safeguards and public listing behavior.

## Test and rollout plan

Verify auth token replay/expiry, eligibility non-enumeration, current agreement/profile restrictions, administrator transition, owner isolation and attendee Users API denial, DOB audit, mobile keyboard access, duplication/new ID and event DST/overnight cases. Review migrations and agreement publication first; CI and staging verification follow approved implementation. No automatic production registration/deployment.

## Deferred design

Do not design or implement email changes, account deactivation controls, deletion, anonymized signup history or recovery keys in this SDDW. Preserve future considerations only in [deferred-account-lifecycle.md](deferred-account-lifecycle.md).

**Before coding:** choose picker library and finalize Terms/Privacy publication/versioning procedure.
