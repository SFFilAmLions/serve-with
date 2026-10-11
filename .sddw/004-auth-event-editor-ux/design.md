# SDDW 004 — Core-Flow Technical Design

**Status: Proposed; implementation not approved.** Derived from [requirements.md](requirements.md).

## Existing stack and boundaries

Retain React/Vite/MUI, Cloudflare Worker, D1, Resend and current events APIs. Reuse the existing authentication infrastructure. Public event reads remain anonymous. Keep `config/admins.yaml` email/enabled for administrator authorization and a distinct private server-side staging email allowlist for account creation/activation. Do not introduce lifecycle status flags, account deletion or recovery services.

## Routes and access

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Upcoming/past events and attendee landing |
| `/login` | Public / limited verified session | Code or magic-link login, inline profile and agreement completion |
| `/events/:id` | Public | Canonical event detail route; detail-page expansion may be deferred |
| `/users/:id` | Owner or eligible administrator | Canonical user profile; public visibility is a future enhancement |
| `/users/:id/edit` | Owner or eligible administrator | Canonical editor; fields vary by permission |
| `/admin` | Eligible administrator | Redirect to `/admin/events` |
| `/admin/events` | Eligible administrator | Event management; default Administrator tab |
| `/admin/users` | Eligible administrator | Paginated name/email directory |
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

Top-right MUI app-bar account controls replace bottom auth. Default to Attendee mode. For eligible admins, the account/user menu contains the Attendee/Administrator workspace switch; Administrator mode exposes exactly two primary tabs, **Events** (`/admin/events`) and **Users** (`/admin/users`), with Events as the default. The switch navigates to workspace URLs rather than maintaining an independent workspace flag. All `/admin/*` routes use a distinct administrator app-bar palette with light- and dark-theme variants and display **Administrator** text so workspace identity is not conveyed by color alone.

The account menu includes **Light**, **Dark** and **System** appearance choices. Persist the selection client-side rather than as account profile data; System follows `prefers-color-scheme` and reacts to changes. Signed-out visitors receive an equivalent compact appearance control in the app bar because no profile menu is available. Theme selection changes presentation only and does not alter authorization or workspace state.

There is no `/profile` route and no admin-specific user-detail/edit route. **My Profile** links directly to `/users/{currentUserId}`. Selecting a person in `/admin/users` navigates to `/users/:id`; editing uses `/users/:id/edit`. Owner editing permits names only while email/DOB are read-only; administrators additionally may correct DOB with actor/time audit. The canonical user view uses a Material pencil icon button to enter `/users/:id/edit`. The editor uses an X icon to close and a check icon to save; X immediately exits when clean and invokes the existing discard-changes confirmation when dirty, while successful save returns to `/users/:id`. All icon-only actions require accessible labels/tooltips.

The admin Users directory is a dense Google Contacts/Gmail-style list rather than cards. Use subtle horizontal separators between rows, no vertical grid lines, and separate aligned First name, Last name and Email columns on desktop. Hide Email first as width contracts. On constrained mobile layouts, replace the separate First name and Last name display columns with a single full **Name** column; this is presentation-only and stored/edited first and last names remain separate. Email remains searchable and is available on the user page. Rows are fully clickable/tappable and need no avatar, checkbox or View button in this scope. First name and Last name headers support sorting; default to Last name ascending, and toggling the active heading reverses direction. A sticky A–Z rail on the right follows the active First/Last name sort and lets pointer/touch users jump directly to a letter section; provide equivalent keyboard/screen-reader navigation. The API must support letter-targeted/incremental retrieval so alphabetical navigation does not depend on preloading the whole directory. Search is server-backed across first name, last name, full name and email. Preserve directory search/sort/position when an administrator opens a user and returns. The Users directory excludes DOB from list responses and remains admin-only. User profile visibility to the general public is deferred, but the canonical non-admin URL is intentionally future-compatible with public profiles. Never infer authorization from hidden UI controls.

## Event experience

`/admin/events` retains Upcoming/Past event management with a prominent **Create event** action and per-event pencil/Edit, copy/Duplicate and trash/Delete actions. Deletion stays on the management list with confirmation rather than becoming an ordinary Edit-form action and uses destructive/error treatment.

Dedicated Create and Edit pages share field controls and validation. Both use X in the editor app bar to close/discard and a check mark to validate/save, matching the user editor. Use MUI X Date and Time Pickers (subject to dependency/license verification) instead of browser `datetime-local`: prominent full-width Start date; equal-width Start/End time controls; nearby live Duration. End date/time zone are collapsed under More options; end date follows start until override. Use IANA `America/Los_Angeles` by default, with DST and multiday validation. Duplicate navigates to `/admin/events/new` using client navigation state to prefill editable fields, visibly identifies the source event, strips source ID/version/timestamps, and persists a new event only on explicit Save. Preserve optimistic concurrency, draft/error retention, unsaved-navigation safeguards and public listing behavior.

## Test and rollout plan

Verify auth token replay/expiry, eligibility non-enumeration, current agreement/profile restrictions, administrator transition, owner isolation and attendee Users API denial, DOB audit, mobile keyboard access, duplication/new ID and event DST/overnight cases. Review migrations and agreement publication first; CI and staging verification follow approved implementation. No automatic production registration/deployment.

## Deferred design

Do not design or implement email changes, account deactivation controls, deletion, anonymized signup history or recovery keys in this SDDW. Preserve future considerations only in [deferred-account-lifecycle.md](deferred-account-lifecycle.md).

**Before coding:** verify the selected MUI X picker package/license fits the project, and finalize the Terms/Privacy publication/versioning procedure.


## Responsive action convention

Prefer persistent Material actions over mobile-only overflow menus. At sufficient width, render ordinary actions as icon + text (for example, pencil **Edit**, copy **Duplicate**, trash **Delete**, plus **Create event**). At constrained/mobile widths, preserve the same actions in place as icon-only buttons before considering overflow. Every icon-only action has an accessible name, tooltip where applicable, visible focus state and adequate touch target. X/check editor actions remain icon-only at all sizes.
