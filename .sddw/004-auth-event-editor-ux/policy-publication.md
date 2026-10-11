# SDDW 004 — Terms & Privacy Publication Procedure

**Status:** Technical publication/versioning procedure proposed for approval. This document does not supply legal advice or approve the substantive Terms of Use or Privacy Policy text.

## Public routes

- `/terms` — current Terms of Use.
- `/privacy` — current Privacy Policy.
- Both routes are public, readable without authentication, responsive, printable, and linked from registration/profile agreement UI.
- Each page visibly identifies its document title, **effective date**, and immutable **version identifier**.
- Current-document routes may resolve from server-controlled current-version configuration, but acceptance records always store the immutable version identifier rather than only a URL.

## Version identifiers

Use an explicit date-based identifier after organizational approval, for example `2026-10-15`. If two approved revisions become effective on the same date, append a monotonically increasing revision suffix such as `2026-10-15.2`.

Version identifiers are immutable after publication. Correcting substantive text requires a new version; do not silently edit a version that users have accepted. Pure rendering/accessibility fixes that do not alter meaning may retain the version, but the source history still records the change.

Maintain two independently configurable required versions:

- `REQUIRED_TERMS_VERSION`
- `REQUIRED_PRIVACY_VERSION`

Changing either required version causes users who have not accepted that exact required pair to enter the reacceptance gate before privileged mutations.

## Source and archive

Keep approved policy text in version-controlled repository content so the exact accepted wording can be reconstructed. Recommended layout:

```
policies/
  terms/
    2026-10-15.md
  privacy/
    2026-10-15.md
```

Published historical versions remain immutable/readable at stable archival routes such as `/terms/2026-10-15` and `/privacy/2026-10-15`. The current routes point to the configured required versions. Do not delete a historical version while acceptance records or applicable retention requirements depend on it.

## Approval/publication workflow

1. Organization supplies/reviews the substantive document text.
2. Approver explicitly confirms document type, final text, effective date/version identifier, and whether the change requires reacceptance.
3. Add the immutable versioned source files and current required-version configuration in a reviewed PR.
4. CI validates that configured required versions have corresponding source files and that version identifiers are well formed.
5. Deploy first to staging; verify public rendering, links, mobile/desktop accessibility, print/readability, and registration/reacceptance flow.
6. Production publication/required-version change follows the normal separately approved release path.
7. Never configure a version as required before that exact document is publicly retrievable in the same release.

## Acceptance semantics

The UI presents one initially unchecked acknowledgment that links both required documents. The server, not the client, determines the current required pair. On submission:

- require a verified limited/authenticated session;
- reject a stale client-supplied pair if required versions changed during the flow and return the current pair for redisplay;
- append one acceptance record with user ID, exact Terms version, exact Privacy version, and server timestamp;
- update the user's latest acceptance summary fields transactionally;
- never infer acceptance from page views, a prechecked box, login, or continued site use.

A profile-complete user whose required versions are outdated sees only the agreement/reacceptance state. Existing valid profile data is not requested again.

## Reacceptance policy

**Default technical rule:** every change to either configured required version requires explicit reacceptance. This is deterministic and avoids attempting to infer legal materiality in application code.

If the organization later wants non-material revisions that do not trigger reacceptance, model that as an explicit approved publication decision rather than silently replacing a required version. Historical acceptance must still identify the exact substantive version the user accepted.

## Data minimization and audit

Acceptance history stores the minimum evidence needed for the product's audit requirement: user ID, document version pair, and server acceptance timestamp. Do not store IP address, user agent, raw session token, or a copy of profile/DOB merely to prove acceptance unless a later legal/privacy review explicitly requires it.

Application logs must not contain DOB, acceptance tokens, magic-link tokens, OTPs, or policy-form payloads containing personal data.

## Failure behavior

- Policy pages remain public even if authentication services are unavailable.
- If required policy content/configuration is internally inconsistent, fail closed for new acceptance and privileged mutations rather than recording an ambiguous acceptance.
- A policy-page rendering failure must not silently mark anything accepted.
- If acceptance persistence fails, keep the user in the agreement state and allow retry without losing profile data.

## Approval still required

Before attendee onboarding, an authorized organizational reviewer must approve:
1. actual Terms of Use text;
2. actual Privacy Policy text;
3. first effective date/version for each;
4. organizational/legal contact information appearing in the documents;
5. any jurisdiction-specific disclosures or retention requirements.

Those substantive decisions are intentionally outside this technical SDDW review.
