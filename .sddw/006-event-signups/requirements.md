# SDDW-006 — Event Signups & Volunteer Participation

**Status:** Draft requirements for review. Specification only; no implementation, migrations, deployment, or merge approved.

## Goal
Enable authenticated attendees to sign up for events, withdraw, and review their own current and historical signups. Enable authorized administrators to view rosters, inspect signup history, and manage signups on behalf of attendees. Keep the first release simple: no waitlist or separate audit-log subsystem.

## Decisions approved October 11, 2026
- **Capacity:** Optional maximum number of active signups per event; unlimited if omitted.
- **Admin management:** Authorized administrators may sign up attendees and withdraw them on their behalf, subject to normal event and capacity rules.
- **Signup and withdrawal cutoff:** Attendees cannot sign up or withdraw at or after an event's start instant (stored in UTC). The same cutoff applies to administrators acting on another attendee's behalf, with no override in this phase.
- **History visibility:** Attendees can view **their own** active and withdrawn signup history; authorized administrators can view histories for their managed event rosters.
- **Audit representation:** Signup history lives in the signup records themselves, using creation and soft-deletion timestamps. Every re-signup creates a **new row**. No separate audit table for this workflow.

## Attendee experience
1. Public event details remain readable anonymously. **Show the primary signup button to both signed-in and signed-out visitors** while signup is open. For signed-out visitors its label is **Sign up**. For signed-in visitors its label is **Sign up as {first name}** (using the authenticated user's profile first name), so the acting identity is explicit. When profile completion is still required, use the login/account-completion flow before showing an identity-specific action. Signup requires a verified, eligible authenticated account with completed profile and current policy acceptance.
   - When signed out, clicking **Sign up** starts the existing login/account-creation flow, retains the specific target event as a safe return destination, and automatically attempts that event's signup **once** after successful login, any required profile completion and agreement acceptance. The visitor must not have to navigate back to the event or click Sign up again.
   - The pending signup intent must survive the magic-link email round trip and page reload, without storing auth credentials or putting sensitive data in the URL. It must not allow an untrusted/open redirect or unauthorized signup for another account. Clear the intent after successful signup, explicit abandonment, or a terminal eligibility/event error; prevent repeated submissions on remount or refresh.
   - On return, show a clear success confirmation or the actual failure (event now full, event started, deleted event, authorization issue, network error) without implying that pressing the button reserved a spot. Recheck server-side cutoff, capacity and one-active-signup rules **at the moment of signup**. The browser cannot guarantee a space while login/account creation occurs.
   - For already-signed-up visitors, show the current enrollment state and withdrawal action rather than a second Sign up. For an event that's started or is full, show an explanatory unavailable/filled state rather than a misleading actionable sign-up control; signed-out users still see the same availability information.
2. An eligible attendee sees an explicit **Sign up** action before the event start, unless already signed up or the event is full.
3. Signing up creates a distinct signup row and displays immediate, accessible confirmation. Avoid duplicate actions while a request is pending.
4. Before the event starts, an active attendee can **Withdraw** with a clear confirmation. Withdrawal sets `deleted_at` and removes the user from the active roster and active capacity count.
5. Withdrawing and signing up again before the cutoff creates a new row with a new ID and `created_at`; it does not revive an old row.
6. **My signups** shows upcoming and past active signups, and a clearly distinguished history view for withdrawn signups, including signup/withdrawal timestamps. Do not imply that a signup proves attendance.
7. Empty, loading, error, full, past-start, and already-signed-up states must be accessible and understandable.
   - **Event detail countdown:** Show a concise, human-friendly **relative time label** until the event's start (for example, `In 1 week`, `In 2 days`, or `In 4 hours`), using only the most meaningful single unit rather than a multi-unit ticking countdown on the event detail page for all visitors. Calculate against the event's stored UTC start instant and the viewer's current time rather than subtracting calendar dates, so timezone and DST transitions are handled correctly. Refresh the relative label when its displayed unit changes (not every second), avoid excessive screen-reader announcements, and display `Event in progress` from start until end and `Event ended` afterward. The displayed countdown is informational; the server's clock governs the signup and withdrawal cutoff.
   - **Public capacity summary:** Anonymous and signed-in visitors can see the number of active signups (**spots taken**) and, when a capacity limit exists, **spots available** (`max(0, capacity - active signups)`) on the public event list and event detail. Never expose attendee identities via this summary. For unlimited events, show the active signup count and **Unlimited capacity** rather than a misleading remaining-spots number. Keep counts current after signup/withdrawal, with server-calculated values; a visible count is informational and never a reservation or guarantee of availability.
8. **Participant roster:** An authenticated attendee with an **active signup** for an event may view the names of other attendees with active signups for that same event. The list must not expose email addresses, dates of birth, withdrawn signup records, or historical timestamps. A user who withdraws loses this access immediately. Anonymous visitors and authenticated nonparticipants cannot view the attendee roster. The server must enforce the access check on every request.

## Standard event page vs administrator event page
- **Standard event page:** The canonical public event page and its Sign up / Sign up as {first name} action behave identically for all visitors, including administrators. Administrator status must not add an on-behalf-of selector or privileged actions to this page.
- **Administrator event page:** Provide a distinct administrator-facing event management page with the additional roster, signup history, searchable attendee selection, and on-behalf-of signup/withdrawal controls. These controls remain server-authorized.
- **Non-administrator navigation:** Any non-admin who opens an admin event page URL must be redirected to the corresponding standard event page rather than shown the admin interface. **After redirect, show a brief, accessible warning toast** (for example, `You don't have access to the administrator event page. Showing the public event page instead.`). Use the application's existing Material Snackbar/Alert pattern; avoid an intrusive modal. Display the warning once per redirect, not repeatedly on reload or subsequent navigation. This redirect and toast are user experience rules, not replacements for API authorization; the server must still deny unauthorized admin requests.
- Retain the existing standard event route. Define the admin event detail route in the technical design, avoiding conflicts with existing admin editor routes.

## Administrator experience
1. Authorized administrators can see the current roster and count for each event, and examine historical withdrawn records, with timestamps.
2. They can add an existing attendee by selecting/searching a user, or withdraw an active attendee on that user's behalf. They may create an unclaimed stub via the separate admin Create User page and return to select it for signup; no implicit user creation occurs from roster search or signup submission.
3. Admin actions enforce the same one-active-signup rule, eligibility, event-start cutoff (including withdrawal cutoff) and capacity checks; admin authority is verified server-side.
4. Distinguish who made a change if technically feasible, but adding actor/audit columns beyond the agreed minimal model requires separate scope approval.
5. Existing event Create/Edit/Duplicate/Delete flows remain intact. Optional capacity is an additive event field. An editor must not lower capacity below the number of active signups without an explicit, agreed resolution rule (default: reject the change).

## Administrator user creation and claimable stub accounts
- On the **administrator event signup page**, provide a searchable selector for an existing attendee **and** a clear **Create user** action. After a new stub is created, return to the event signup flow with that user selected; do not automatically add the person to the event without an explicit signup confirmation.
- Provide a distinct **administrator-only Create User page** using the existing account-registration form's Material field layout and validation patterns. **First name and last name are required.** Other profile fields, including email and date of birth, are optional at stub creation. No Terms of Use acceptance or Privacy Policy acknowledgment is performed or recorded by the administrator on behalf of the person.
- Store a stub as an explicitly **unclaimed, unverified identity** with a stable internal user ID and nullable email/DOB as appropriate. Creation must not generate a signed-in session, mark email verified, mark policy acceptance current, or grant administrative privileges. Server-side authorization restricts creating, editing, and using stubs for on-behalf-of signup to authorized administrators.
- Administrators may sign up a stub user to an event under the same capacity, cutoff, duplicate-active-signup and withdrawal rules as other attendees. Existing history remains associated with the stable user ID after the stub is claimed.
- **Claiming through normal account activation:** A stub may be claimed only when it has an email address. When someone authenticates using that email via the existing verified email/magic-link flow, route the matching unclaimed stub through the **same account creation/reactivation and profile-completion experience** as any other account; do not build a separate claiming UI or extra claim-token mechanism. Email ownership verification is mandatory; a name match alone never establishes ownership. Resolve account/stub email collisions securely and never merge two existing identities silently.
- **All normal requirements apply:** Before the stub is considered claimed/active and normal signed-in features are granted, the person must supply or confirm **every field currently required for ordinary account creation/reactivation**, including any missing required profile details, and personally complete current Terms of Use acceptance and Privacy Policy acknowledgment. Preexisting admin-entered field values do not waive required validation or user agreement. Preserve the stub's original stable user ID and any associated event signups/history.
- A stub without email remains unclaimed and cannot enter the claiming flow until an authorized administrator adds an email. Do not silently link people by name or expose authentication secrets in public pages, rosters or logs.
- Admin-created stub records must be distinguishable from registered accounts in user selection and rosters, with minimal personal data shown to other active participants. Assess the privacy-policy and age-eligibility implications of administrators entering third-party information without consent, and avoid sending authentication email to an unverified address.
- Add tests for required names/optional other fields, lack of admin-imputed acceptance, unauthorized creation, duplicate names, claiming through the existing verified-email account creation/reactivation flow, completion of all normally mandatory fields and user agreements, rejection of claiming an email-less stub, account collision handling, preservation of signup history, and inability to claim based on name alone.

## OpenAPI contract and published API reference
- **Contract-first, YAML source of truth:** Maintain a human-readable, version-controlled **OpenAPI 3.1 YAML** document (proposed `openapi/openapi.yaml`) as the authoritative definition for **all** HTTP APIs, including existing authentication, profiles, events, users, administration and SDDW-006 signup endpoints. The YAML is edited and reviewed directly; TypeScript route declarations must not become a competing contract. Define request parameters and bodies, response/error schemas, security schemes, auth/role requirements, and representative synthetic examples. Document rate limits and other operational constraints where OpenAPI extensions or prose are appropriate.
- **Generate both sides:** Generate TypeScript client bindings and types used by the React frontend **and** typed server-side operation interfaces, request/response models, route bindings or dispatcher scaffolding used by the Cloudflare Worker. Handwritten Worker handlers supply business logic, authorization, D1 persistence, email/OTP logic, and transactional constraints **behind those generated interfaces**. Generated code is never manually edited; regenerate it from YAML. Do not imply that OpenAPI generators can automatically implement secure server business behavior.
- **Server correctness:** Runtime parsing/validation at the Worker boundary must conform to the YAML contract; compile-time generated TypeScript types alone are insufficient. Keep existing URL paths, HTTP semantics and authentication behavior during migration unless explicitly changed by an approved API contract. Adopt a Cloudflare Workers-compatible generator/framework whose exact choice and limitations (especially cookies, CSRF, response validation and OpenAPI 3.1 support) are proven in the technical design.
- **Reproducible generation:** Pin the generator and template versions. Provide a single documented generation command and CI jobs that lint/validate the YAML, regenerate artifacts, fail on stale checked-in generated outputs (if committed), check compatible/breaking API changes against the base branch, and exercise generated client/server contracts through integration tests. Prefer deterministic output and avoid hand-maintained duplicate DTOs.
- **Published documentation:** Serve a public machine-readable OpenAPI representation at `/api/openapi.json` **generated from the YAML** and a responsive, accessible Scalar (or comparable) API reference at `/api/docs` on both staging and production. Documentation stays available without login, but interactive API calls continue to obey all server authentication, authorization, CSRF and rate limits. Documentation reflects the deployed release's contract, not an unpublished branch.
- **Safety and releases:** Do not put secrets, real personal information, session tokens or production credentials in examples or generated assets. Document public/authenticated/admin access accurately. Prevent automatic mutating requests in the docs viewer. Test route integration and SPA fallback behavior; publish production docs only through the normal release workflow.


## Administrator service usage and quotas
- Include an **administrator-only Usage & Quotas dashboard** in SDDW-006, accessible from the admin navigation (proposed route `/admin/usage`). Non-admin visitors must not see usage data or provider credentials; enforce authorization on the server and apply the established admin-page redirect/warning convention where appropriate.
- Display **Cloudflare Workers** request volume, execution/errors as available; **Cloudflare D1** rows read/written and storage; **Resend** email usage and daily/monthly sending quotas; and **Turnstile** challenge/verification analytics where accessible. Clearly distinguish measured usage, provider-reported quotas, configured quotas, and unavailable metrics. Never fabricate a remaining amount or percentage when no trustworthy limit is available.
- Show usage, limit, remaining amount and reset period **where the provider supplies them**; otherwise show the measured quantity with a labeled unknown/unlimited/not applicable limit. Include provider attribution, collection timestamp, refresh status, and staging-versus-production context.
- **Account-wide versus service-specific:** Explicitly distinguish totals shared across a Cloudflare account, Resend account or Turnstile site from usage attributable to the Serve With staging/production resource. Do not present shared totals as application-only consumption.
- The backend queries provider APIs using appropriately scoped secrets, stored only in Cloudflare Worker secrets and never returned to the browser. Verify current API capabilities, plan eligibility, permission scope, quota semantics and operational cost before selecting API queries. Resend usage access may require an elevated-scope key; keep it segregated from the transactional email key where possible, and never embed credentials in the frontend or generated OpenAPI examples.
- Cache external metrics for a bounded interval (initial target **5–15 minutes**) and show a **last successful update** when an API is unavailable; report stale/unavailable readings explicitly and do not substitute zeros. Dashboard loading and provider failures must not interfere with event or authentication operations. Expose only admin-protected, read-only JSON endpoint(s) described in the authoritative OpenAPI YAML and consumed through generated client/server bindings.
- Visually indicate configurable warning/critical utilization thresholds (initial guidance **80%** and **95%**) **only when a reliable denominator exists**. Do not send notification emails or create scheduled monitoring tasks in this phase; these may be considered separately.
- Test non-admin denial, secret non-disclosure, provider failures/timeouts, stale cache behavior, per-provider and per-environment labeling, rate-limit/cost protection, reliable limit/remaining calculations, unknown limits, and responsiveness/accessibility.

## Database and consistency
- New `event_signups` table with `id` (UUID), `event_id`, `user_id`, `created_at` (timestamp), and nullable `deleted_at` (timestamp).
- A row with `deleted_at IS NULL` is active. A row with a non-null `deleted_at` is withdrawn. No status enum.
- Foreign keys to events and users; index by event/user and chronology for roster/history retrieval.
- Enforce a unique active pair through SQLite/D1 partial index: `UNIQUE(event_id,user_id) WHERE deleted_at IS NULL`. Permit multiple historical rows for the same pair.
- `capacity` is nullable; null means unlimited. Only active rows count toward capacity.
- Signup and capacity enforcement must be atomic under simultaneous requests; UI checks alone are insufficient.
- Use server timestamps. Reject signup at `now >= event.start_at`; reject signup to missing or deleted events. Reject withdrawal at or after event start, including administrator-initiated withdrawals; both signup and withdrawal close at the start instant. No exceptions in this phase.
- Preserve signup history if an event is soft-deleted, subject to existing privacy and retention policy; do not expose deleted-event rosters publicly.

## API and authorization requirements
- A signed-in attendee may read only their own signup records and create/withdraw only their own active signup. Exception: active participants may read a minimal **current participant name-only roster** for that particular event.
- Administrators may read event rosters and history, and create/withdraw signups for an existing attendee only within their authorized scope.
- Never expose another attendee's email, profile/DOB or signup history to participants or public endpoints; return only display names (and minimal stable non-sensitive identifiers if required by the UI) to active participants. Authorized admins may receive separate, minimally necessary roster details. Public endpoints may expose **aggregate active signup count and remaining spots only**, without names or other identity-bearing fields.
- Defend against cross-origin changes, duplicate submissions, race conditions, stale UI and user enumeration.
- Make repeated withdrawal requests safe and well-defined; history should not acquire duplicate deletion timestamps or extra rows.
- Draft endpoint paths and payloads in design.md; this requirements document does not prescribe API surface yet.

## Validation and acceptance tests
- Signup, withdrawal before start, and re-signup before start produce two records with only the newest active. Withdrawal at or after event start is rejected and does not change the row.
- Only one active signup per user/event under simultaneous requests; at-capacity concurrency never overbooks.
- Unlimited and limited capacities, zero remaining places, invalid capacity edits.
- Public anonymous event list/detail accurately show active spots taken and remaining capacity, update after signup/withdrawal, omit identities, and correctly label unlimited capacity.
- Event detail relative-time label shows one meaningful unit (`In 1 week`, `In 2 days`, `In 4 hours`, etc.), transitions to in-progress/ended states at exact boundaries, handles DST and clock changes, and does not produce intrusive screen-reader announcements.
- Exact event-start boundary: before start accepted, at/after start rejected, including across timezone/DST changes.
- Admin adding/withdrawing for another attendee, including unauthorized-user denial and target eligibility.
- Attendee history shows only the owner; admin roster/history excludes private DOB and respects privilege checks.
- Participant roster shows active names only to an active signup holder; anonymous visitors, nonparticipants and withdrawn users are denied. Verify access is revoked after withdrawal and no email/DOB/history fields are returned.
- Deleted event, missing event, user re-signup, repeated withdrawal, and deleted signup race behavior.
- Browser tests for signup button states, including anonymous `Sign up` vs authenticated `Sign up as {first name}`, admin user selection on the **admin event page only**, mobile layout, keyboard use, error feedback and My signups history.
- Verify identical standard event page functionality for admins and attendees; verify non-admin admin-event-page URLs redirect to corresponding standard event pages, display one accessible warning toast after redirect, and admin API access remains forbidden.
- Anonymous event Sign up button launches login/new-account onboarding, survives the magic-link round trip, automatically submits exactly once after profile and policy gates, and reports success/full/started/errors without extra user interaction. Verify intent cleanup, refresh/replay protection and no open redirects.
- Staging acceptance with real D1 before any production release.


## Visual system refinement — approved addition to SDDW-006 scope
This is a cross-cutting UI refinement implemented in the same batch as event signups. **Preserve existing routes, permissions, application behavior, centered page structure, rounded fields/cards, and established form layouts.** These changes are visual/interaction-pattern consistency only; signup behavior remains governed by the requirements above.

### Material iconography
- Replace mixed Unicode glyphs, ad hoc icons and inconsistent icon styles with **Material Symbols Rounded** throughout attendee and administrator interfaces.
- Apply a consistent icon size system: **18px** for inline/contextual icons, **20px** within labeled action buttons and **24px** for header utilities.
- Specifically update edit/pencil, back arrow, workspace/view switch, calendar, clock, location pin and comparable actions/status indicators. Avoid emoji or raw Unicode symbols as functional icons.
- Ensure accessible names for icon-only controls, decorative icons hidden from screen readers, and stable alignment/spacing.

### Controls and emphasis
- Continue using rounded **pills** for filters, segmented choices, and compact status indicators.
- Replace the underlined Administrator **Events / Users** tabs with a single-select **segmented pill control** consistent with the public **Upcoming / Past** selector.
- Reserve **filled club-gold buttons** for the screen's primary actions. Use outlined/text Material buttons for secondary actions. Avoid additional bespoke button treatments or inconsistent control styles.
- Keep compact controls appropriate to their context while retaining accessible touch targets and keyboard operation.

### Header and colors
- In attendee mode, display only **Serve With Lions** as the title.
- In administrator mode, display **Serve With Lions · Admin**, where the **Admin** suffix is styled using an accessible orange warning color in both light and dark themes; do **not** display a separate Administrator Chip/pill.
- Reserve orange for administrator context and caution/destructive states. Do not apply orange as a general decorative or primary-action color; retain gold for primary actions.
- Preserve existing workspace-switch authorization and navigation functionality.

### Consistency and accessibility
- Apply the same Material icon, button, pill, spacing, surface and emphasis conventions across attendee pages, admin event management, users directory/profile management, event detail and event Create/Edit pages.
- Preserve the current centered content width, card/form shape, underlying workflows and screen behavior; no changes to routes, permissions, APIs or signup semantics solely for visual restyling.
- Validate **light and dark themes**, including admin orange and gold-button contrast, disabled/hover/focus/selected states, responsive layouts, keyboard focus visibility and screen reader labels.
- Add regression/browser checks for icon replacement, 18/20/24px sizes, segmented admin navigation, header text and removal of Administrator Chip, theme consistency and functional equivalence.

## Explicitly deferred
- Waitlists or automatic promotion.
- Separate signup audit-log/change-history tables.
- Signup notifications, email/calendar invitations or reminders.
- Organization-scoped signup permissions and cross-organization access.
- Event attendance/check-in or verification of service.
- Custom signup questions/forms, signup approvals and signup-by-email for users without accounts. Admin-created **stub users** are an explicit exception for on-behalf-of signup, not general anonymous registration.
- Historical participation recovery/account-deletion flows; reconsider after signup data and retention behavior are validated.

## Questions for design review
- Does an admin need an explicit override for cutoff/full events? Proposed default: no.
- How should My signups organize historical withdrawn vs past active entries? Proposed default: separate history filter.
- Should an admin roster include the author of an action? Not captured in the agreed five-column model; only introduce this if explicitly approved.

**Next:** Review the proposed `design.md` and `tasks.md`, beginning with the OpenAPI generation and D1 concurrency proof-of-concept gates. Do not implement database migrations or app changes as part of this specification PR.
