# SDDW 004 — Proposed Technical Design

**Status: Proposed design for review following completed scope discovery. Not approved for implementation.**
Source: [requirements.md](requirements.md). References: issues #10, #11, and #12.

## 1. Scope and architecture

Retain Vite, React, MUI, Cloudflare Worker, D1, Resend email verification, the current events API and migration history. This phase adds a registered-user model and a route-based app shell. Separate **account eligibility**, **email ownership**, **profile completeness**, and **administrator permission** in all server checks.

- `config/admins.yaml`: existing email/enabled entries remain the sole role-assignment authority. Do not put names in YAML.
- D1 `users`: verified, unique normalized email; required first/last name and date of births and birth date when profile is complete. User identity is not derived from YAML.
- Staging eligibility: a distinct email-only allowlist, **not** the admin list. Only staging applies it. Production registration policy is explicitly undecided and not enabled by this design.
- Both attendee and admin API calls require a valid session and completed profile where authentication is necessary. Admin APIs additionally check the authoritative admin list. Public events remain unauthenticated.

## 2. Routes and access boundaries (proposed)

| Route | Access | Responsibility |
| --- | --- | --- |
| `/` | Public | Upcoming/Past events, Attendee experience |
| `/login` | Public | Email-first sign-in and inline first-login profile completion |
| `/profile` | Signed in | Edit own names, view date of birth, verified email change, deactivate own account |
| `/admin` | Complete-profile admin | Administrative workspace |
| `/admin/events/new` | Complete-profile admin | Create Event dedicated page |
| `/admin/events/:id/edit` | Complete-profile admin | Edit Event dedicated page (proposed for consistency; pending approval) |
| `/admin/users` | Complete-profile admin | Registered-user directory, search/filter |
| `/admin/users/:id/edit` | Complete-profile admin | Edit existing user's first/last name; authorized administrators may view and correct date of birth for the selected user, with server-side permission checks and audited changess only |

Use an accessible routing solution that supports deep links, browser back/forward and refresh through the existing Worker static-asset fallback. Restore intended destination only if still authorized after login/profile completion; otherwise return to attendee home. No Create User route.

A signed-in administrator defaults to Attendee view, with an explicit, compact mode switch to Administrator; the identity/account menu is independent. Users without admin authorization never see admin navigation. API authorization, not just hidden controls, prevents access.

## 3. Email-first login and inline registration

1. Visitor selects **Sign in** in the app bar and enters an email at `/login`.
2. Server normalizes email; for staging, validates eligibility using the separate allowlist **before issuing a usable challenge or session**. Respond with a non-enumerating UI message for ineligible/nonexistent identities; do not disclose account existence.
3. For eligible emails, use the existing provider to send an eight-digit one-time code **and** magic link. The user can enter the code or open the magic link.
4. The magic link performs its existing one-time POST exchange automatically, without a confirmation button. Strip token from location/history before exchange; guard against duplicate requests from rerenders, StrictMode and navigation. Code and magic flows share a successful-verification result.
5. After verified email ownership, look up account by normalized email, or create a minimal **pending-profile** user record atomically if eligible. Such an identity is not a complete active account: only limited session, profile completion and sign-out are allowed. Avoid duplicate records during simultaneous/replayed completions.
6. If either required name or date of birth is missing, expand the login page inline to show first/last name and date-of-birth fields. Save them server-side, transition account to complete, then proceed to the intended authorized view. Existing administrators without names use exactly this flow and retain their YAML-defined role once complete.
7. Complete-profile users proceed directly to Attendee view (or their allowed previously intended route). All users may later change first/last names at `/profile`; email is read-only.

**Authentication-state contract:** anonymous → verification pending → verified but profile incomplete → verified profile complete. Never interpret an incomplete profile as full admin authorization.

**Security:** Preserve one-time challenges, expiry, rate limits, secure HttpOnly session cookie, CSRF/origin checks, authentication failure behavior and generic anti-enumeration messaging. Avoid adding token/code/name content to logs or URLs; magic token is consumed via POST only. Add safe error/retry paths for provider failures. Keep existing session migration compatibility.

## 4. Data storage and migration approach

Introduce an additive `users` table in a new numbered D1 migration, with stable ID, normalized unique email, first_name, last_name, date_of_birth (ISO YYYY-MM-DD calendar date, not a timestamp), email verification timestamp, created/updated timestamps, and account-deleted state or equivalent. Design CHECK constraints so a pending-profile record can temporarily lack names, while **all fully active accounts have valid names, date of birth, and verified email**. Retain existing sessions and login challenges through a backward-compatible transition; link sessions to users safely after verification. Index normalized email and directory search fields.

Do not prepopulate or guess administrator names. Previously authorized admin email accounts receive a secure first-login profile-completion path, without changing the role assignment list. Audit and reconcile legacy sessions so they cannot bypass the completion gate.

Configure staging allowlist as a separate reviewed server-side email-only configuration and a build/deployment environment guard. Do not expose email lists in public frontend bundles. Keep staging existing-admin eligibility explicit; adding a new admin to YAML alone should not silently bypass staging allowlist. Deny by default when staging eligibility configuration is missing or malformed.

## 5. User pages and authorization

- **Profile:** signed-in user may read/edit own first/last name, view own read-only date of birth and verified email, request a verified new-email change, and initiate either deactivation or deletion with explicit confirmation; prevent empty/invalid names. Never allow direct unverified editing of email or role here.
- **Admin Users:** enforce administrator authorization for both directory page and list/search APIs; attendee requests are denied without returning any directory data. List only completed registered accounts; exclude birth dates from directory queries, search results and default payloads (plus an explicitly marked pending state if product review later chooses to expose it); search by name/email; paginate server-side, never dump every account to all clients. No Create User action.
- **Admin Edit User:** use the same profile form fields as self-edit, but a different server-authorized endpoint allowing edits to the selected existing user's first/last name. Neither user ID nor client-provided role flags confer authority. Verified email and role remain read-only.
- **Verified email change:** a protected change-request and confirm flow sends verification solely to the proposed new address; enforce uniqueness across active/deactivated records and staging eligibility, keep old email until verified, atomically update the existing user, invalidate outstanding challenges/sessions as needed, and recalculate admin permission from the *new* email. Do not transfer access from the old email.
- **Deactivate:** clear all non-email profile PII and revoke sessions/challenges; retain verified email and stable ID with historical signup links under `deactivated` state. Upon successful code/magic verification of the same eligible email, enter restricted profile-completion mode, collect names and date of birth again and only then activate. Never repopulate erased data.
- **Delete:** clear profile PII **including real email association** and revoke sessions/challenges. Keep the nonidentifying historical event records under an independent random ID. If no recovery is selected, never store an account-specific recovery verifier/link: future registrations cannot reclaim history.
- **Optional recovery on Delete:** after explicit opt-in, issue a high-entropy, single-use bearer key. Send it before wiping the real email; if email dispatch fails, do not claim that a key was delivered and resolve the error before destructive commit. Retain only a securely protected key verifier and historical-ID association, never plaintext. Key possession—not original identity proof—is the intentionally authorized claim mechanism. On claim, require a newly verified, staging-eligible email and full profile, atomically consume key, relink history, and recompute administrator authority from current YAML/email permissions. Document theft/forwarding risk.
- **Storage:** model `active`, `deactivated`, `deleted_recoverable`, and `deleted_unrecoverable` without requiring fake emails for historical rows. If a placeholder email is unavoidable, generate it independently under reserved `example.com`, and prohibit all email sends to it. Ensure referential integrity of event signup history without retaining old identity maps.
- **Privacy:** remove embedded signup personal details where needed and audit all copies; even without a claim key, distinctive signup patterns may reidentify someone. Do not promise complete anonymity where that risk remains. Deactivated email-linked records and recoverable deleted records remain protected personal data.
- For all mutating endpoints, check session validity, account completeness, allowlist/eligibility as appropriate, origin, and object-level authorization on the server.

**Date-of-birth privacy:** Limit storage to a calendar date, do not infer age or gate features unless separately specified, never log or publicly index it, and do not expose it in generic user-list responses. Correction is administrator-only after initial entry; owners can view but not edit date of birth. Audit changes without logging raw birth dates; decide encryption feasibility, retention and erasure before implementation.

## 6. Event form and responsive editor

Create Event is a dedicated page. **Duplicate Event** is an administrator-only action from the event management list that navigates to Create Event with a copy of the source event's editable fields (not its identity, version, or deletion metadata); no save occurs until the administrator explicitly submits the create form. The copy should be held in router navigation state or a safe source-ID lookup (without trusting client-provided authorization), with a direct-refresh fallback. Prefer dedicated Edit Event using the same form component (requires user approval). Show a full-width, prominent **Start date** row; beneath it, equal-width **Start time** and **End time** clock-enabled inputs, with the live duration nearby but without changing input widths. MUI accessible date/time picker options and license impact to be reviewed; provide keyboard/manual input fallback.

Collapse **End date** and **Time zone** under More options. Initial End date follows Start date; once explicitly overridden, don't reset it with later start-date changes. Open More options for edited multiday/nondefault-zone events, and summarize important nondefault values even when collapsed.

Compute duration using event-local date+time and chosen IANA zone mapped to real instants with strict DST disambiguation, consistent with Worker Temporal validation. Support overnight/multiday; show a validation error instead of a duration for invalid/ambiguous times or end-before-start. Persist the current API shape and optimistic version guard.

A page navigation guard replaces Create Event modal Cancel/X semantics; confirm on unsaved navigation, preserve data on failed saves, and handle browser back/forward where the platform permits. Existing delete confirmation remains a modal.

## 7. Verification and rollout

Tests:
- Allowed/disallowed staging emails, challenge anti-enumeration and rate limits, case-insensitive uniqueness and email verification, link replay/expiry, code path, no double magic exchange.
- First-login pending-profile gate; required names; existing admin transition; update own profile versus admin editing others; direct URL/API denial for attendee; role changes only through YAML.
- Directory pagination/search; verified email change, PII-clearing deactivation, preserved signup references, same-ID reactivation, session invalidation; no admin creation path.
- Attendee/admin view switching, app bar account menu, deep linking, accessibility, mobile and light/dark themes.
- Duplicate Event from upcoming/past events, copied values, distinct new ID, no modification of source, no automatic save, and create-form validation.
- Date/time alignment, editable End date and timezone, duration and DST cases, unsaved-navigation guards, regression of CRUD/public event listings.

Implementation requires separate review of task slices, then a PR with green CI and an approved merge to `main`. Staging runs through existing deployment pipeline; real email, D1 migration, CRUD and account acceptance tests happen there. Production registration/deployments are separately gated.

## 8. Open product decisions (not silently approved)

1. **Updated:** both operations scrub profile PII. Deactivation retains the real email for same-email reactivation with full profile reentry; deletion removes the real email and offers an optional bearer recovery key. Without key, history is not claimable. Remaining work is secure key/delivery design and residual reidentification risk review.
2. **Partly resolved:** retain email, user ID, and event signup references; clear profile PII. Enumerate signup-contained PII and other retention/legal obligations before implementing.
3. Shall Edit Event also be a dedicated page? Suggested: yes.
4. Exact picker component and inline duration placement.
5. Production registration eligibility remains **out of scope** and must be explicitly decided later.

**Next step:** Review these technical design decisions and approve or modify them before converting to implementation tasks.
