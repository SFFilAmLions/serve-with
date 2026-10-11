# SDDW 004 — Registration, Account & Event UX: Requirements

**Status: Simplified scope ready for user review. No implementation, merge, migration or deployment approval.**

Consolidates issues [#10](https://github.com/SFFilAmLions/serve-with/issues/10), [#11](https://github.com/SFFilAmLions/serve-with/issues/11), [#12](https://github.com/SFFilAmLions/serve-with/issues/12) and subsequent user requirements. Future account-lifecycle concepts are preserved separately in [deferred-account-lifecycle.md](deferred-account-lifecycle.md), **not part of SDDW 004**.

## 1. Login and registration

- Use one dedicated **email-first login page**. After entering email, let users authenticate by existing eight-digit code or magic link. Clicking a valid magic link **automatically signs in** via one-time POST exchange, without another confirmation button; scrub tokens from URL/history and protect against replay, expiry and duplicate exchange.
- Following verified email ownership, ask new accounts and incomplete existing accounts for required **first name, last name, and date of birth** inline on the login page. No separate Create User page. Return complete users directly to the normal attendee experience.
- Require a single **initially unchecked acknowledgment checkbox** linked to the Terms of Use and Privacy Policy during registration/profile completion. Record immutable account `created_at` independently of nullable `terms_accepted_at`, accepted document version references, and prior acceptance audit history.
- Access requires verified email, completed mandatory profile, and an agreement covering **currently required** document version(s). Require the checkbox again if the required terms/privacy version changes; a timestamp alone does not establish validity. Incomplete or outdated accounts can access only sign-in/profile-completion/reacceptance/logout, not attendee participation or admin mutations. This is not blanket consent to optional processing.
- In this scope, **deactivation** means invalidating current agreement/acceptance and restricting access while retaining the profile. Verified re-login plus fresh acknowledgment reactivates it. No separate `is_active` boolean. Full deletion and key-based recovery are deferred.
- On staging only, gate account creation/activation/challenges by a **server-side email-only staging allowlist**, distinct from administrator permissions. Avoid account/allowlist enumeration; include existing admins in eligibility. Production registration policy is deferred and must not silently default to open.
- Preserve existing administrator configuration `config/admins.yaml` as **email/enabled only**. Administrator names, verified email and DOB are in D1. Existing administrators must supply missing profile details and acknowledge terms at next sign-in without losing their configured role.

## 2. Account navigation and user management

- Put Sign in / account menu (identity and Sign out) at the **top right of the MUI app bar**, removing the former bottom auth panel. Public upcoming/past events remain browsable without login.
- Default signed-in experience is **Attendee**; authorized admins can switch into a distinct **Administrator** workspace. Hiding admin UI is insufficient: protect every admin route and API server-side.
- **Edit Profile:** owner can edit first/last name and view verified email and date of birth. Email remains read-only in SDDW 004. After initial entry, DOB can be corrected **only by an administrator**, with a restricted API and audit trail.
- **Users directory:** administrator-only page with basic name/email search, no DOB in list or default API payload. Attendees must never see the list, nor access it via guessed routes or list/search APIs.
- **Edit User:** authorized administrators can edit an existing account's names and correct DOB. No admin Create User page. Profile and directory endpoints must enforce ownership/role authorization; no self-service role editing or cross-user deletion.

## 3. Event management usability

- Use a dedicated **Create Event page**, with matching dedicated **Edit Event page** proposed for consistency; shared field components, validation and unsaved-navigation safeguards.
- Prominent full-width **Start date**; equal-width side-by-side **Start time** and **End time** clock-capable controls; live **Duration** alongside/under time controls without resizing either.
- Collapse **End date** and **Time zone** under More options. End date initially follows start date until explicitly overridden. Default zone is `America/Los_Angeles`; preserve overnight/multiday and timezone/DST validation behavior, with errors rather than misleading duration.
- **Duplicate Event** action for administrators, including past events, opens Create Event prefilled with only editable source fields. It does **not** save until explicit Save, creates a **new ID**, never changes the original and does not copy server metadata.
- Preserve existing event CRUD authorization, optimistic concurrency/error behavior and publicly readable listings.

## 4. Documentation, quality and rollout

- Keep root `README.md` accurate: separate **implemented** SDDW 003 from proposed SDDW 004, and link staging **https://servewith-beta.sffilamlions.org/** and production **https://servewith.sffilamlions.org/**.
- Add tests for authorization (especially attendee denial of Users APIs), staging eligibility, authentication edge cases, missing profile/updated terms gates, admin DOB correction, account-menu/mobile UX, event duplicate/new ID, time/DST and editing regression.
- Review implementation tasks and migrations before coding. Submit reviewed PR(s), run CI, merge only with approval, validate on staging. Production release remains separately gated.

## Explicitly deferred

**Not SDDW 004:** self-service email changes, user deletion, anonymized historical signups, optional emailed recovery keys, ownership re-claim, attendee event signups, production registration policy. See [deferred-account-lifecycle.md](deferred-account-lifecycle.md).

## Remaining design decision

Choose the specific date/time picker implementation and confirm the consistent Edit Event dedicated page; preserve required UX and accessible keyboard/mobile behavior. Document publication and required acceptance version changes need an operating procedure before onboarding real attendees.
