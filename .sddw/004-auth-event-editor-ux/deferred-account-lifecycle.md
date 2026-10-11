# Deferred — Account Lifecycle & Historical Participation

**Not included in SDDW 004.** Preserved ideas for a later scoped SDDW project; no implementation decision or final legal/privacy policy implied.

## Future capabilities

- **Verified email change:** verify a proposed new email before replacing the old one; address eligibility, duplicates, session invalidation and recalculation of `config/admins.yaml` permission.
- **Account deactivation:** In the simplified SDDW 004 model, deactivation may invalidate current terms/privacy acceptance while preserving email, names, DOB and signup history. User verifies login, accepts current terms again, and returns without redundant profile entry. A later product phase can revisit whether a separate account-disable control is wanted.
- **Account deletion:** erase first/last name, date of birth, real email and other identity-bearing profile data from the application (and address identity-bearing data elsewhere per applicable retention rules), revoke sessions and sever normal email lookup, while considering retention of nonidentifying historical event participation.
- **Optional history recovery:** at deletion, offer an opt-in email of a high-entropy single-use recovery key to the then-verified address. If declined, no reclaimable key/identity-to-history mapping is retained. If selected, store only a protected verifier and allow a key holder to claim the linked history with a newly verified eligible email, complete a fresh profile, and invalidate the key. The key is effectively a bearer credential; possession can transfer history, even to another person. Avoid exposing any secret in normal directory/API data. Reliable pre-deletion email delivery and failure behavior need careful design.
- **Storage:** a nullable email plus stable internal historical identifier is preferable to fake user emails; if email-shaped placeholders are unavoidable, use independent random nondeliverable `example.com` identifiers. Never infer the original email from the placeholder.
- **Privacy:** clearing the original PII does not guarantee legal anonymization if rare event participation, logs, backups, email-service records or possession of a recoverable key can reconnect a record. Assess data minimization, retention, request handling and privacy disclosures when event signup features actually exist.

## Why deferred

The service does not yet implement attendee event signup records, making ownership transfer, record erasure and recovery-key retention premature complexity. Revisit after the actual signup data model and a concrete deletion/privacy policy exist. This document is a backlog note, **not** an approved specification.
