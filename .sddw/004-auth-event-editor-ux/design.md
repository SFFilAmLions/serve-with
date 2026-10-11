# SDDW 004 — Technical Design

**Status: Not started — awaiting requirements approval.**

Prepare a design only after reviewing [requirements.md](requirements.md).

Design review must cover:
- Dedicated email-first login page for existing and eligible new users, with eight-digit code or auto-exchanged magic link; single-attempt POST exchange and token scrubbing.
- First successful verified login creates an eligible account if needed, and expands the post-verification login flow inline for missing first/last name before regular access; reuse validation with the later Edit Profile page.
- Distinct attendee and administrator views; authorized administrator mode switching, route boundaries, app-bar affordances, and mobile behavior.
- Material AppBar sign-in and account menu, with dialogs and mobile behavior.
- Dedicated Create Event page (not a modal), shared event form/edit presentation, URL routing and unsaved-navigation guard; prominent date and equal-width clock pickers, expandable end date/time zone, end-date synchronization, DST-aware duration preview.
- Administrator-only Users list with **Edit User** for existing accounts; **no Create User page**. Authenticated self-service and mandatory first-login Edit Profile reuse common fields and validation with separate ownership permissions. Include verification-time account creation, staging allowlist checks, search, and server-side field authorization.
- Required first/last/email profile fields and user-editable names; secure mandatory profile completion for existing admins at next sign-in without role loss.
- **Approved:** `config/admins.yaml` retains email-based authorization entries only; required user names and verified emails are held in D1 profiles. No duplication/synchronization of editable names into YAML. Design the profile-completion guard and server-owned registration/self-deletion flows.
- Staging-only eligibility allowlist, distinct from the administrator role list; existing-account reconciliation, verification and non-enumerating errors.
- Production registration policy deferred pending explicit decision; no production change.
- Preservation of all security, API, versioning, and accessibility behaviors.
- Browser-test strategy and staging deployment gate.

References: GitHub issues #10, #11, and #12.
