# SDDW 004 — Terms & Privacy Publication Procedure

**Status:** Technical publication/versioning procedure proposed for approval. This document does not supply legal advice or approve the substantive Terms of Use or Privacy Policy text.

## Public routes

- `/terms` — current Terms of Use.
- `/privacy` — current Privacy Policy.
- Both routes are public, readable without authentication, responsive, printable, and linked from registration/profile agreement UI.
- Each page visibly identifies its document title, **effective date**, and immutable **version identifier**.
- Current-document routes may resolve from server-controlled current-version configuration, but acceptance records always store the immutable version identifier rather than only a URL.

## Version identifiers

Use the most recent Git commit timestamp for each policy source, followed by the abbreviated commit SHA, generated at build time. This ensures two edits on the same date remain distinct. Terms and Privacy have independent identifiers. Only commits that change a policy file advance that policy's required version; application release/version bumps do not.

Version identifiers are immutable after publication. Correcting substantive text requires a new version; do not silently edit a version that users have accepted. Pure rendering/accessibility fixes that do not alter meaning may retain the version, but the source history still records the change.

At build time `scripts/generate-policy-versions.mjs` derives independent Terms and Privacy revision identifiers from Git history and writes a server/client-consistent generated manifest. Build workflows check out full Git history. A change to either policy file triggers reacceptance of the resulting required pair; unrelated code or package-version changes do not. Do not configure conflicting manual required-version overrides.

## Source and archive

Keep approved policy text in version-controlled repository content so the exact accepted wording can be reconstructed. Recommended layout:

```
policies/
  terms/
    2026-10-15.md
  privacy/
    2026-10-15.md
```

Historical policy revisions are preserved by GitHub repository history, rather than separate archival website routes. Current `/terms` and `/privacy` are public, and acceptance evidence retains each accepted file-revision identifier.

## Approval/publication workflow

1. Organization supplies/reviews the substantive document text.
2. Approver explicitly confirms document type, final text, effective date/version identifier, and whether the change requires reacceptance.
3. Commit approved policy source files in the reviewed PR. Build-time Git history automatically determines each last-modified revision.
4. CI regenerates metadata from full Git history, checks that both source files are present, and verifies policy identities are well formed.
5. Deploy first to staging; verify public rendering, links, mobile/desktop accessibility, print/readability, and registration/reacceptance flow.
6. Production publication/required-version change follows the normal separately approved release path.
7. Do not release a policy change without the corresponding document being publicly retrievable in the same deployment.

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

If the organization later wants non-material policy-file edits that do not trigger reacceptance, introduce an explicitly reviewed exception; under the current rule any policy-file change advances that policy's revision. Historical acceptance must still identify the exact substantive version the user accepted.

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
