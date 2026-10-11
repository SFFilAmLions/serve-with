# SDDW 004 — Technical Design

**Status: Not started — awaiting requirements approval.**

Prepare a design only after reviewing [requirements.md](requirements.md).

Design review must cover:
- Single-attempt automatic magic-link POST exchange and token scrubbing.
- Distinct attendee and administrator views; authorized administrator mode switching, route boundaries, app-bar affordances, and mobile behavior.
- Material AppBar sign-in and account menu, with dialogs and mobile behavior.
- Prominent date and equal-width clock pickers, expandable end date/time zone, end-date synchronization, DST-aware duration preview.
- Required first/last/email profile fields and user-editable names; secure mandatory profile completion for existing admins at next sign-in without role loss.
- Reconcile names in editable user profiles with source-controlled administrator role configuration; do not assume static YAML names remain authoritative when users edit names. Server-owned registration and self-deletion flows.
- Staging-only eligibility allowlist, distinct from the administrator role list; existing-account reconciliation, verification and non-enumerating errors.
- Production registration policy deferred pending explicit decision; no production change.
- Preservation of all security, API, versioning, and accessibility behaviors.
- Browser-test strategy and staging deployment gate.

References: GitHub issues #10, #11, and #12.
