# SDDW 004 — Core Authentication, Account & Event UX Requirements

**Status: Draft for review; no implementation, merge or deployment approval.**

Consolidates [#10](https://github.com/SFFilAmLions/serve-with/issues/10), [#11](https://github.com/SFFilAmLions/serve-with/issues/11), and [#12](https://github.com/SFFilAmLions/serve-with/issues/12). Future lifecycle features are recorded separately in [deferred-account-lifecycle.md](deferred-account-lifecycle.md) and are not acceptance criteria for this release.

## Core flow 1 — Sign in and complete registration

- Provide one email-first login page supporting the existing eight-digit code and magic link. A valid magic link signs the user in automatically through a one-time POST exchange, without an extra confirmation click. Prevent replay/expiry/duplicate exchange and remove tokens from URL/history.
- After email verification, prompt new or incomplete users inline for first name, last name and date of birth. Do not create a separate Create User page.
- Present one initially unchecked acknowledgment linked to the current Terms of Use and Privacy Policy. Persist immutable account `created_at` separately from nullable `terms_accepted_at`, accepted document versions and historical acceptance events.
- Require verified email, complete mandatory profile and acceptance of current required document versions before attendee or administrator mutations. If versions change, require reacceptance without reentering valid profile data. An acknowledgment is not optional-processing consent.
- On staging, enforce a server-side email-only registration/activation allowlist separate from admin authorization. Include existing administrators; avoid enumeration. Production registration policy requires separate approval.
- Preserve `config/admins.yaml` as email/enabled administrator configuration. Existing admins retain role eligibility but must complete missing profile data and current agreement on next sign-in.

## Core flow 2 — Navigate and manage accounts

- Move sign-in/account identity/sign-out to the upper-right MUI app bar; remove the bottom authentication panel. Public upcoming/past events remain viewable anonymously.
- Signed-in users default to Attendee mode. For authorized administrators, the top-right account/user menu provides a workspace switch between **Attendee** and **Administrator**. Administrator mode has exactly two primary tabs in this scope: **Events** and **Users**. Enforce permissions on every server route and API, not only in the UI.
- Give each account one canonical `/users/:id` page and `/users/:id/edit` editor. Do not add a `/profile` alias: the account menu links directly to the signed-in user's canonical ID. In SDDW 004, user pages are restricted to the owner and authorized administrators; future public profile visibility is explicitly deferred. Owners may edit first/last name and view verified email/DOB; email changes are unsupported and DOB corrections after initial entry require an administrator with audit logging.
- Administrator-only Users directory supports basic paginated name/email search, with no DOB in list/default API payload. Administrator Edit User can edit names and correct DOB, with actor/time audit. No Create User page, role editing, or attendee access to directory/search APIs.

## Core flow 3 — Create, edit and duplicate events

- Use dedicated Create Event and Edit Event pages with shared field controls, validation, unsaved-change protection and existing CRUD authorization/concurrency behavior.
- Emphasize a full-width Start date. Show equal-width Start and End time clock-capable, keyboard-accessible controls and live Duration without resizing time inputs.
- Put End date and Time zone under More options. End date follows Start date until explicitly overridden. Default to `America/Los_Angeles`; validate overnight/multiday and DST cases.
- Duplicate Event, including a past event, opens `/admin/events/new` prefilled with editable fields only and clearly indicates the source event. Carry the source in client navigation state rather than requiring a bookmarkable duplicate URL. It does not save automatically, always creates a new ID on Save, and does not copy server metadata or alter the original.
- Preserve publicly readable event listings.

## Verification and release boundaries

- Test code/magic-link security, staging eligibility, profile/current-agreement gates, owner/admin/attendee authorization (including direct Users API denial), admin DOB audit, responsive account menu, event duplication and time/DST regression.
- Keep README's implemented SDDW 003 separate from proposed SDDW 004 and retain staging https://servewith-beta.sffilamlions.org/ and production https://servewith.sffilamlions.org/.
- Publish/version Terms and Privacy documents before onboarding real attendees. Review migrations, run CI, obtain approval before implementation/merge, validate staging after approved merge; production deployment is separately gated.

## Explicitly deferred

Self-service email change; dedicated deactivation/reactivation control and lifecycle states; account deletion/erasure; anonymization of historical participation; emailed recovery keys and ownership re-claim; attendee event signups; and production registration policy. See [deferred-account-lifecycle.md](deferred-account-lifecycle.md).

**Current-scope distinction:** An outdated/missing agreement restricts access until reaccepted; this is an agreement gate, **not** a user-facing account deactivation feature. Do not add `is_active` or lifecycle endpoints.

## Decisions to confirm before implementation

Use MUI X Date and Time Pickers for the event date/time controls, subject to implementation-time license/dependency verification. The remaining prerequisite is the Terms/Privacy publication/versioning procedure. Dedicated Create/Edit Event pages are the design baseline.
