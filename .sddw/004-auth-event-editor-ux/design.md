# SDDW 004 — Technical Design

**Status: Not started — awaiting requirements approval.**

Prepare a design only after reviewing [requirements.md](requirements.md).

Design review must cover:
- Single-attempt automatic magic-link POST exchange and token scrubbing.
- Material AppBar sign-in and account menu, with dialogs and mobile behavior.
- Prominent date and equal-width clock pickers, expandable end date/time zone, end-date synchronization, DST-aware duration preview.
- Mandatory user profile storage and migration of existing administrator names; server-owned registration and self-deletion flows.
- Staging-only eligibility allowlist, distinct from the administrator role list; existing-account reconciliation, verification and non-enumerating errors.
- Production registration policy deferred pending explicit decision; no production change.
- Preservation of all security, API, versioning, and accessibility behaviors.
- Browser-test strategy and staging deployment gate.

References: GitHub issues #10, #11, and #12.
