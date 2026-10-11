# SDDW 004 — Authentication and Event Editor UX Refinements: Requirements

**Status: Draft requirements for user review. No design, implementation, or deployment approval.**

Origin: successful SDDW 003 staging use and user feedback. Consolidates [#10](https://github.com/SFFilAmLions/serve-with/issues/10), [#11](https://github.com/SFFilAmLions/serve-with/issues/11), and [#12](https://github.com/SFFilAmLions/serve-with/issues/12). This specification is the source of truth; issues remain pointers.

## 1. One-click magic-link authentication

- Opening a valid emailed magic link **automatically signs the user in**, without a second confirmation button or email re-entry.
- Exchange the single-use token through the existing secure POST API, not a state-changing GET. Remove the token from the browser address and history before the request; avoid token leaks via referrers or logging.
- Show understandable signing-in progress and clear expired/invalid/already-used errors. Never exchange a token twice because of rerenders or retries.
- Preserve administrator allowlist, token expiration and replay protection, secure session cookies, eight-digit code authentication, and logout.

## 2. Conventional Material app-bar account controls

- Place account access in the **top right of the existing branded AppBar**, not at the bottom of the page.
- Signed out: provide a compact **Sign in** action opening an accessible sign-in experience without hiding public events.
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
- Retain editing of all persisted fields, form prepopulation, API request format, server validation, optimistic version conflict handling, error draft preservation, and soft deletion.

## 4. User registration, profiles, and account deletion

- Allow individuals to **register their own user account** using a verified email address. Every active user, including every administrator, must have a **nonblank first name, nonblank last name, and unique verified email address**. Apply appropriate validation and normalization server-side; public event browsing remains anonymous.
- Allow authenticated users to view their profile and **edit their first and last names** (both remain required) and **delete their own account** through an explicit, deliberate confirmation. Revoke sessions and login challenges, stop future authentication for deleted/unauthorized identities, and define safe handling of retained event/audit references, if any, before implementation.
- Do not grant administrator privileges through registration or profile changes. **Decision: existing administrators complete their first and last names through a secure required profile-completion step at their next sign-in.** Until completed, permit only the limited profile-completion and sign-out experience, not administrative operations; preserve the administrator role assignment after completion. Never invent names. Reconcile the authoritative administrator list and persisted user profiles without locking out existing admins during the transition.
- **Approved authority split:** keep `config/admins.yaml` as the email-based administrator authorization list (email and enabled status), not a storage location for first/last names. Store each administrator's required, editable first name and last name, alongside their verified email, **only in their D1 user profile**. Administrator access is based on the configured email plus a completed, verified user profile. Do not synchronize editable names into YAML.
- Separate **account eligibility**, **registered account status**, and **administrator authorization**. An eligible person is not an admin merely because they can register, and an administrator email is not a substitute for a complete user profile.

### Staging-only registration allowlist

- **Decision: the staging whitelist contains email addresses only, not names.** In the **staging environment only**, permit account creation **only when the email matches an explicitly approved staging user allowlist**. Whitelist eligibility must be checked on the server before creating or activating an account and before sending registration credentials; never rely solely on UI validation.
- A visitor may access the registration flow, but an unlisted email must **not** result in account creation. Use safe, non-enumerating public error/acknowledgment messaging to avoid exposing the whitelist.
- Staging administrators must be covered explicitly by the same staging account-eligibility policy; administrator authorization remains a separate check.
- Existing staging users/admins need a reviewed migration/activation policy so mandatory profile fields and eligibility are enforced without silently losing access. Treat profile completion or approved seed-data migration as a deliberate step.
- Maintain the staging allowlist through a reviewed, environment-specific configuration/source of truth, not an open-registration switch or a client-side list. Never accidentally apply the staging restriction to production.
- **Production registration eligibility is not specified by this requirement** and must be defined in design review before enabling production registration; no assumption of open production signup.

### Acceptance criteria

- Tests cover required admin first-sign-in profile completion, continued admin access after completion, edited names, eligible/ineligible staging registration, normalized/case-insensitive email matching, verification, duplicate email handling, required name validation, self-deletion/session revocation, denial of self-assigned admin privileges, and handling of existing admins.
- Verify ordinary users can sign in but cannot call administrator mutation APIs. Verify public events remain readable while signed out.
- No deployment or user-account migration until requirements, design, and implementation tasks have been approved.

## 5. Profile editor and administrator user directory

- Give **every authenticated user a dedicated Edit Profile page**, reachable through the top app-bar account menu. Users may view and update **their own first and last names**, with required-field validation. Their verified email is displayed but **not editable** in SDDW 004.
- Provide an **administrator-only Users page** listing registered user accounts, with useful identifying columns (first name, last name, email) and basic search/filtering. This is an account directory, not an event-attendance list. Include a visible **Create User** action.
- **Create User and Edit User must be two modes of one dedicated, reusable user form/page**, not separate divergent implementations. From the Users directory, administrators may create a user or select an existing user to edit. Create mode requires first name, last name, and email; Edit mode prefills the account and allows changing first and last name, not its verified email.
- Administrator-created users are subject to the same registration eligibility rules, **including the staging email whitelist**, and must not be considered email-verified until they actually verify ownership. Design must specify invitation/verification or pending-account activation, prevent duplicates, and avoid sending unsolicited sign-in links. Creating a user must never grant admin privileges.
- The authenticated **Edit Profile** page should reuse compatible form fields and validation while enforcing self-only editing and hiding administrative controls. Public self-registration may reuse the same components, but cannot access administrator create/edit routes.
- Never treat the ability to edit a profile as permission to grant administrator status or modify the verified email.
- Enforce ownership or administrator authorization server-side on every profile read/write. A normal user cannot view the full user directory, enumerate other users, or edit another user by manipulating a URL or API request.
- Administrator account/profile management must preserve existing eligibility, verification, permissions, and account-deletion safeguards. Administration of roles, email changes, and cross-user deletion are **not authorized by this requirement**. Administrator creation of ordinary user accounts is expressly in scope.
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

## 7. Acceptance and boundaries

- Automated tests: automatic single-attempt magic-link sign-in/token scrubbing, code/login/logout regressions, registration/profile/deletion and staging eligibility checks, own-profile edit versus administrator editing of other users, protected user directory, dedicated event-create page, shared admin Create/Edit User form, account-menu/mobile, attendee/admin view switching and keyboard behavior, page-navigation/discard behavior, start/end synchronization and overrides, distinct date and clock input UX, live duration and DST edge cases, Edit prefill, no public-list regression.
- Verify changes on staging through normal `main` workflow after approval, fixing staging defects iteratively. **No production deployment without separate explicit authorization.**
- Out of scope: new authentication providers, new event schema, event RSVP/signups, recurrence, organization permissions expansion, or production release.

## 8. Confirmed requirements decisions

- **Existing administrators:** Mandatory first/last name completion at next sign-in (not invented or pre-seeded). Until complete, restrict to completion/sign-out while preserving their existing role assignment.
- **Staging registration allowlist:** Email addresses only; registrants supply their own mandatory names.
- **Profile editing:** Users may change their first/last names after registration; both fields must remain valid and nonblank. Email changes are not included in this phase.
- **Administrator identity source:** `config/admins.yaml` remains an email-only authorization source; required names and verified email reside in D1 profiles, including administrators. No names in YAML.

## 9. Items to settle in design review

- Specific MUI date/time picker dependency, license constraints, and mobile clock UX.
- Whether the duration should be shown directly beneath the equal-width time inputs or in an End time label area; the equal sizing and prominent date are required either way.
- Exact loading/error presentation for automatic magic-link exchange.
- Decide whether Edit Event should also be a dedicated page (recommended for consistency) and the exact URL patterns for Create Event, Users, Create/Edit User, and Edit Profile.
- Define the administrator-created user invitation/verification lifecycle, duplicate protection, and how the staging whitelist applies before and after activation.
- Attendee/Admin view navigation model (route or mode switch), initial/default view and UI placement; do not imply attendee event signup is already implemented.
- User table/profile migration and deletion semantics (including retention); staging email-only allowlist configuration and reconciliation. Administrator configuration/profile source-of-truth split is approved.
- Production registration eligibility policy (explicitly deferred; no production registration is authorized).

**Next gate:** Review and approve these requirements before completing the technical design and implementation task list.
