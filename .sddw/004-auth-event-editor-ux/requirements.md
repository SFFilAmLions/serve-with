# SDDW 004 — Authentication and Event Editor UX Refinements: Requirements

**Status: Scope defined by user; requirements ready for final review. Technical design and implementation not yet approved.**

Origin: successful SDDW 003 staging use and user feedback. Consolidates [#10](https://github.com/SFFilAmLions/serve-with/issues/10), [#11](https://github.com/SFFilAmLions/serve-with/issues/11), and [#12](https://github.com/SFFilAmLions/serve-with/issues/12). This specification is the source of truth; issues remain pointers.

## 1. One-click magic-link authentication

- Opening a valid emailed magic link **automatically signs the user in**, without a second confirmation button or email re-entry.
- Exchange the single-use token through the existing secure POST API, not a state-changing GET. Remove the token from the browser address and history before the request; avoid token leaks via referrers or logging.
- Show understandable signing-in progress and clear expired/invalid/already-used errors. Never exchange a token twice because of rerenders or retries.
- Preserve administrator allowlist, token expiration and replay protection, secure session cookies, eight-digit code authentication, and logout.

## 2. Conventional Material app-bar account controls

- Place account access in the **top right of the existing branded AppBar**, not at the bottom of the page.
- Signed out: provide a compact **Sign in** action navigating to a dedicated, accessible login page, without hiding public events.
- Signed in: provide an account/avatar menu exposing the user's email and **Sign out**; the menu must work with keyboard and small/mobile viewports.
- Public event browsing must remain accessible regardless of login or auth-service errors. Admin mutation controls appear only with confirmed authorization, backed by existing server authorization.
- Remove the old bottom-of-page auth/account panel while retaining the GitHub repository and deployment-identification footer.

## 3. Streamlined Add/Edit Event dialog

- **Revised decision:** Event creation must use a **dedicated Create Event page**, not a modal dialog. Provide a normal page header, navigation/back affordance, and prominent Save action. Reuse the same event field component for editing; the final Edit Event presentation (dedicated page recommended for consistency) is specified during design.
- Navigation away from an event form with unsaved changes must prompt before discarding edits, including browser back/navigation where supported. The earlier modal-specific X/Cancel requirement no longer applies to the Create Event page.
- Display a **prominent, full-width Start date**, followed by **equal-sized Start time and End time controls next to each other**; use easy-to-operate clock/time pickers with keyboard/manual input support.
- Show a live **Duration** preview aligned under the time row or near End time without making either time control narrower.
- Keep **End date** and **Time zone** collapsed under a discoverable **More options** section by default. Default end date to the chosen start date and zone to `America/Los_Angeles`.
- Start-date changes carry forward to end date **only until the user explicitly overrides end date**. Never overwrite an intentionally chosen end date.
- For editing existing multiday events or nondefault time zones, expand More options automatically; when collapsed, display a concise summary for important nondefault values.
- Duration must reflect actual elapsed time in the event's IANA time zone, including overnight/multiday and daylight-saving changes; invalid or ambiguous local times show a validation state, not a misleading duration.
- Provide an administrator-only **Duplicate Event** action on existing events (including past events). It opens the dedicated **Create Event** page with the selected event's editable fields prefilled (title, location, start/end date and time, and time zone). Users may modify any prefilled field before saving.
- Duplicating must **create a new event with a new ID**, not alter the source event, copy its version/deletion metadata, or save automatically. Clearly label the page as creating a new event and require explicit Save. The existing create endpoint and validation rules apply, including past dates and DST handling.
- Retain editing of all persisted fields, form prepopulation, API request format, server validation, optimistic version conflict handling, error draft preservation, and soft deletion.

## 4. User registration, profiles, and account deletion

- **One dedicated email-first login page, with inline registration.** A person starts by entering their email, then verifies ownership using an eight-digit security code or automatic magic-link exchange. Only after email verification, if no complete profile exists, expand the login flow to collect required first name, last name, and date of birth inline. Existing users with complete profiles proceed directly. No separate Create User page. Every active user, including every administrator, must have a **nonblank first name, nonblank last name, valid date of birth, and unique verified email address**. Apply appropriate validation and normalization server-side; public event browsing remains anonymous.
- Authenticated users can view and edit their first and last names, view their read-only date of birth (correctable only by an authorized administrator), request a verified email change, and deactivate their own account. First/last name and date of birth remain required while active.
- Do not grant administrator privileges through registration or profile changes. **Decision: existing administrators complete their first and last names and date of birth through the same inline required profile-completion step during their next sign-in.** Until completed, permit only the limited profile-completion and sign-out experience, not administrative operations; preserve the administrator role assignment after completion. Never invent names. Reconcile the authoritative administrator list and persisted user profiles without locking out existing admins during the transition.
- **Approved authority split:** keep `config/admins.yaml` as the email-based administrator authorization list (email and enabled status), not a storage location for first/last names. Store each administrator's required, editable first name and last name and mandatory date of birth, alongside their verified email, **only in their D1 user profile**. Administrator access is based on the configured email plus a completed, verified user profile. Do not synchronize editable names into YAML.
- Separate **account eligibility**, **registered account status**, and **administrator authorization**. An eligible person is not an admin merely because they can register, and an administrator email is not a substitute for a complete user profile.

### Verified email change and account deactivation/reactivation

- A signed-in account holder can request an email change. The new email must be unique among active and deactivated accounts, eligible for the current environment (including the staging email whitelist), and verified with a one-time code or magic link **sent to the new address** before the account email is changed. Until verification succeeds, keep the original email unchanged. Invalidate outstanding change attempts and rotate/revoke sessions as appropriate on success. Administrator rights must be recalculated from the new email under `config/admins.yaml`, never blindly transferred.
- **Delete account means deactivate and clear profile PII**, not physically delete the persistent user identity. Confirm the user's intent, clear first name, last name, date of birth and other stored profile PII (including future fields covered by the deletion policy), mark the account deactivated, and revoke every session and outstanding authentication/change challenge. **Retain the verified email address and stable internal user ID** to allow future reactivation and preserve references from event signups and other existing records.
- Event signups and their relationships to that stable user ID remain intact. While the user is deactivated, ordinary attendee and administrator views must not expose their removed profile details; any remaining signup-specific PII must be separately identified and handled. Reactivation does not automatically recreate deleted PII.
- If that same retained email completes a fresh login verification and remains eligible under the environment rules, reactivate the **same** user ID (rather than insert a duplicate) and require first name, last name and date of birth again before ordinary access. Existing event signups remain linked to the reactivated account.
- The retained email is itself **personal information**, so this is **pseudonymization/deactivation, not full anonymization or total erasure**. Treat retained emails and linked signups as protected personal data, prevent deactivated accounts from being enumerated through normal directory/search responses, and document the retention basis and any separate full-erasure/legal request path before implementation.
- Re-registering/reactivating cannot grant privileges: administrator access is determined afresh by current YAML email authorization and completed profile, not historical account state. Staging whitelist checks apply again.
- Test verified email changes (including duplicate/unallowlisted addresses, token expiry/replay, unverified attempts, session handling and privilege changes), deactivation PII scrubbing, preserved signup/user-ID relationships, and same-ID reactivation with required profile completion.

### Staging-only registration allowlist

- **Decision: the staging whitelist contains email addresses only, not names.** In the **staging environment only**, permit account creation **only when the email matches an explicitly approved staging user allowlist**. Whitelist eligibility must be checked on the server before creating or activating an account and before sending registration credentials; never rely solely on UI validation.
- Visitors may enter any email on the login screen, but an unlisted email must **not** result in a staging account, session, or usable login challenge. Use safe, non-enumerating public error/acknowledgment messaging to avoid exposing the whitelist.
- Staging administrators must be covered explicitly by the same staging account-eligibility policy; administrator authorization remains a separate check.
- Existing staging users/admins need a reviewed migration/activation policy so mandatory profile fields and eligibility are enforced without silently losing access. Treat profile completion or approved seed-data migration as a deliberate step.
- Maintain the staging allowlist through a reviewed, environment-specific configuration/source of truth, not an open-registration switch or a client-side list. Never accidentally apply the staging restriction to production.
- **Production registration eligibility is not specified by this requirement** and must be defined in design review before enabling production registration; no assumption of open production signup.

### Acceptance criteria

- Tests cover required admin first-sign-in profile completion, continued admin access after completion, edited names, eligible/ineligible staging registration, normalized/case-insensitive email matching, verification, duplicate email handling, required name and date-of-birth validation, self-deletion/session revocation, denial of self-assigned admin privileges, and handling of existing admins.
- Verify ordinary users can sign in but cannot call administrator mutation APIs. Verify public events remain readable while signed out.
- No deployment or user-account migration until requirements, design, and implementation tasks have been approved.

## 5. Profile editor and administrator user directory

- Give **every authenticated user a dedicated Edit Profile page**, reachable through the top app-bar account menu. **After successful email verification, expand the login page to request any missing first/last names or date of birth**, and require completion before ordinary attendee or administrator features become available. Reuse the profile fields/validation for the standalone Edit Profile page used for later edits; there is no independent Create User page. Users may view and update **their own first and last names** and view their own date of birth, with required-field validation. Their verified email is displayed but **not editable** in SDDW 004.
- **Attendees must not be able to view or access the Users directory**, whether through navigation, a direct URL, or the users-list/search APIs. Only authorized administrators can access the directory. Provide an **administrator-only Users page** listing registered user accounts, with useful identifying columns (first name, last name, email) and basic search/filtering. This is an account directory, not an event-attendance list. Do not provide a Create User action; eligible new users create their own accounts via the login/verification flow.
- From the Users directory, administrators may open an **Edit User page** for an existing account, prefilled with its profile information. Reuse the profile-edit form fields and validation, but enforce administrator-only cross-user editing on the server. Administrators may edit first and last names, not verified email or administrator privileges. **Date of birth must not appear in the default directory or ordinary account list API**; date of birth may be viewed and corrected only within the administrator's authorized Edit User workflow, with explicit validation and audit tracking; it remains excluded from the default directory. There is **no administrator Create User page** in this phase.
- Self-service login and required profile completion handle first-time account creation; the admin Edit User page does not register accounts or bypass staging eligibility.
- Never treat the ability to edit a profile as permission to grant administrator status or modify the verified email.
- Enforce administrator authorization server-side on all users-list, search, and cross-user read endpoints; attendees must receive an authorization denial even when guessing a URL, ID, or API path. Enforce ownership or administrator authorization server-side on every profile read/write. A normal user cannot view the full user directory, enumerate other users, or edit another user by manipulating a URL or API request.
- Administrator account/profile management must preserve existing eligibility, verification, permissions, and account-deletion safeguards. Administration of roles and cross-user deletion are **not authorized by this requirement**. Self-service **verified email changes are in scope**. Administrator creation of ordinary user accounts is not in scope; first-time account creation occurs through verified email login.
- Page navigation must support direct links, browser back/forward, responsive layout, keyboard focus, save feedback, and unsaved-change protection.

## 6. Separate Attendee and Administrator experiences

- Provide **distinct Attendee and Administrator views**, not one public event page with scattered admin editing controls. Attendee is the normal/default experience for signed-in people.
- **Attendee view:** Browse Upcoming and Past events, use personal account/profile controls, and access attendee-facing capabilities as those are introduced. Do not invent registration-for-events, RSVP, signup, or attendance features as part of SDDW 004; those remain future work.
- **Administrator view:** A clearly identified management workspace for permitted staff, with Add/Edit/Delete Event controls and any future administrative functions. Keep editing controls out of the attendee experience.
- An authenticated administrator can **switch between Attendee and Administrator views** without signing out or changing identity. A standard attendee must not be offered an administrator switch or gain access to admin routes.
- The app bar must make the current view obvious. Provide a discoverable, mobile-friendly view switch for eligible admins, and place the account menu (identity/profile/logout) separately from mode switching.
- Authorization remains **server-enforced** for all administrative APIs and routes; changing a client-side view must never grant privileges.
- Preserve anonymous public event browsing, with an appropriate attendee/public entry view when signed out.
- When returning from admin to attendee, retain the attendee's normal browsing experience; define back/navigation and optional view persistence in design. Never leak admin-only information into the attendee view.
- Browser tests must cover attendee-only accounts, administrators switching both directions, direct navigation to protected administrator views, logout and expired-session behavior, keyboard/mobile switching, and no accidental admin controls in attendee view.

## 7. Project documentation

- Update the root `README.md` as part of SDDW 004 to reflect features actually implemented versus planned, and to prominently link both environment URLs: staging `https://servewith-beta.sffilamlions.org/` and production `https://servewith.sffilamlions.org/`.
- Describe the current deployment workflow and production release gate accurately. Keep the README up to date as SDDW 004 is implemented, reviewed, and eventually shipped; do not present planned features as already live.

## 8. Acceptance and boundaries

- Automated tests: automatic single-attempt magic-link sign-in/token scrubbing, code/login/logout regressions, registration/profile/deletion and staging eligibility checks, own-profile edit versus administrator editing of other users, protected user directory, dedicated event-create page and event duplication, admin Edit User and first-login profile completion, account-menu/mobile, attendee/admin view switching and keyboard behavior, page-navigation/discard behavior, start/end synchronization and overrides, distinct date and clock input UX, live duration and DST edge cases, Edit prefill, no public-list regression.
- Verify changes on staging through normal `main` workflow after approval, fixing staging defects iteratively. **No production deployment without separate explicit authorization.**
- Out of scope: new authentication providers, new event schema, event RSVP/signups, recurrence, organization permissions expansion, or production release.

## 9. Confirmed requirements decisions

- **Existing administrators:** Mandatory first/last name completion at next sign-in (not invented or pre-seeded). Until complete, restrict to completion/sign-out while preserving their existing role assignment.
- **Staging registration allowlist:** Email addresses only; registrants supply their own mandatory names.
- **Profile editing:** Users may change their first/last names after registration; both fields must remain valid and nonblank. Date of birth is mandatory and read-only to the account owner after initial submission; only an authorized administrator may correct it. Changing email is allowed only through a separate ownership-verification process; direct edits to the email field are not allowed.
- **Administrator identity source:** `config/admins.yaml` remains an email-only authorization source; required names and verified email reside in D1 profiles, including administrators. No names in YAML.

## 10. Items to settle in design review

- Specific MUI date/time picker dependency, license constraints, and mobile clock UX.
- Whether the duration should be shown directly beneath the equal-width time inputs or in an End time label area; the equal sizing and prominent date are required either way.
- Exact loading/error presentation for automatic magic-link exchange.
- Decide whether Edit Event should also be a dedicated page (recommended for consistency) and the exact URL patterns for Create Event, Users, Edit User, and Edit Profile.
- Define email/code/magic-link login state, inline post-verification name expansion, first-login account activation timing, duplicate prevention, and eligibility checks before challenge issuance and activation. Do not disclose whether an email is registered before verification.
- Attendee/Admin view navigation model (route or mode switch), initial/default view and UI placement; do not imply attendee event signup is already implemented.
- Date-of-birth input format (calendar date, not timestamp), reasonable validity bounds, administrator correction audit, data minimization and retention; do not show dates of birth in the user list by default. Correction permissions are approved: administrators only.
- User table migration; complete PII scrubbing scope beyond the required profile fields, retained-email/privacy/retention rationale, and potential separate full-erasure process; staging email-only allowlist reconciliation. Administrator configuration/profile source-of-truth split is approved.
- Production registration eligibility policy (explicitly deferred; no production registration is authorized).

**Next gate:** Final requirements/design review and resolution of remaining account-deletion/retention and editor decisions, then implementation task approval. Scope is closed to additional features unless explicitly reopened.
