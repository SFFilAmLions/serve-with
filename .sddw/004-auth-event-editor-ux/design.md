# SDDW 004 — Core-Flow Technical Design

**Status: Proposed; implementation not approved.** Derived from [requirements.md](requirements.md).

## Existing stack and boundaries

Retain React/Vite/MUI, Cloudflare Worker, D1, Resend and current events APIs. Reuse the existing authentication infrastructure. Public event reads remain anonymous. Keep `config/admins.yaml` email/enabled for administrator authorization and a distinct private server-side staging email allowlist for account creation/activation. Do not introduce lifecycle status flags, account deletion or recovery services.

## Routes and access

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Upcoming/past events and attendee landing |
| `/login` | Public / limited verified session | Code or magic-link login, inline profile and agreement completion |
| `/events/:id` | Public | Canonical event detail page; administrators receive contextual Edit |
| `/users/:id` | Owner or eligible administrator | Canonical user profile; public visibility is a future enhancement |
| `/users/:id/edit` | Owner or eligible administrator | Canonical editor; fields vary by permission |
| `/admin` | Eligible administrator | Redirect to `/admin/events` |
| `/admin/events` | Eligible administrator | Event management; default Administrator tab |
| `/admin/users` | Eligible administrator | Searchable/sortable directory with incremental A–Z navigation |
| `/admin/events/new` | Eligible administrator | Create or duplicate-prefilled event |
| `/admin/events/:id/edit` | Eligible administrator | Edit existing event |

All privileged APIs independently verify authenticated session, verified email, complete profile, current agreement and role. Incomplete or outdated accounts may access only completion/reacceptance/logout; do not expose privileged endpoints through direct navigation.

## Login screen flow

Use `/login` as one continuous Material flow rather than separate Sign In and Register pages. State 1 asks only for Email with a **Continue** action. After submission, State 2 says to check email, identifies the submitted address, accepts the eight-digit code, and offers **Continue**, **Resend code**, and **Use a different email** without revealing whether an account existed. A valid magic link automatically completes verification and advances to the required next state without a confirmation button.

After verification, existing complete/current users finish sign-in immediately. New or incomplete users remain on `/login` and advance to **Complete your profile** with First name, Last name, DOB, and one initially unchecked acknowledgment linking Terms of Use and Privacy Policy. Users whose profile is complete but agreement versions are outdated see only the required reacceptance state rather than reentering valid profile fields. The first-step action is labeled **Continue**, not implementation-specific wording such as “Email me a code and sign-in link.”

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


## Canonical event view and list presentation

Use `/events/:id` as the canonical view after selecting an event or successfully creating/editing one. The page presents title, localized date/time and location without exposing the raw IANA zone when a concise local abbreviation is sufficient; overnight/multiday events explicitly show the date transition. Authorized administrators see a contextual pencil/Edit action leading to `/admin/events/:id/edit`. Duplicate/Delete stay on `/admin/events`; attendee signup controls are not introduced.

Public `/` and administrator `/admin/events` share a list-oriented Material presentation with Upcoming/Past tabs and subtle horizontal row separators. The public list has no management controls. Administrator wide layouts show event/date/time and direct icon+text actions; constrained layouts stack secondary date/time/location information and use icon-only actions. The main row/event name opens `/events/:id`. Do not add an All tab, bulk selection or default card containers in this scope.

Create/Edit X invokes discard protection when dirty; check validates and saves. A successful save navigates to the canonical event page. Duplicate immediately opens the prefilled Create editor without confirmation or persistence. Delete uses an explicit Material confirmation dialog with textual Cancel/Delete actions. Keep user-entered drafts on validation, network and optimistic-concurrency failures.

## Loading, empty, error and accessibility states

Keep global app bars, workspace tabs and other stable navigation mounted while content loads. Prefer shape-matched Material skeleton rows/details over full-page spinners. Empty states are concise and contextual: no upcoming events may expose Create event to administrators; an empty Users search suggests changing the name/email query. Failed content loads expose a local Retry action.

Field validation is inline and programmatically associated with its field. Save/network failures preserve form contents and use an appropriate inline message or Material snackbar; important dynamic status is announced accessibly. Prevent duplicate submissions while saving without causing layout shifts.

All icon-only controls have accessible names, visible focus treatment and adequate Material touch targets. All workflows are keyboard operable. Restore focus sensibly after dialogs; provide keyboard/screen-reader equivalents for the visual A–Z rail; respect reduced-motion preferences; and maintain sufficient contrast in all appearance modes. Do not use administrator color as the sole workspace signal. Protected-resource authorization failures must not disclose private user data. If a session expires during an editor workflow, preserve the draft where safely feasible through reauthentication.
