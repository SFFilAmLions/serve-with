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

- Use the existing MUI theme, with an accessible **X close button in the upper-right dialog header** in place of the bottom Cancel button; keep a prominent Save action.
- All close paths (X, Escape, backdrop) share the existing **Discard unsaved changes?** behavior, including focus restoration after close.
- Display a **prominent, full-width Start date**, followed by **equal-sized Start time and End time controls next to each other**; use easy-to-operate clock/time pickers with keyboard/manual input support.
- Show a live **Duration** preview aligned under the time row or near End time without making either time control narrower.
- Keep **End date** and **Time zone** collapsed under a discoverable **More options** section by default. Default end date to the chosen start date and zone to `America/Los_Angeles`.
- Start-date changes carry forward to end date **only until the user explicitly overrides end date**. Never overwrite an intentionally chosen end date.
- For editing existing multiday events or nondefault time zones, expand More options automatically; when collapsed, display a concise summary for important nondefault values.
- Duration must reflect actual elapsed time in the event's IANA time zone, including overnight/multiday and daylight-saving changes; invalid or ambiguous local times show a validation state, not a misleading duration.
- Retain editing of all persisted fields, form prepopulation, API request format, server validation, optimistic version conflict handling, error draft preservation, and soft deletion.

## 4. Acceptance and boundaries

- Automated tests: automatic single-attempt magic-link sign-in/token scrubbing, code/login/logout regressions, account-menu/mobile and keyboard behavior, modal focus/discard behavior, start/end synchronization and overrides, distinct date and clock input UX, live duration and DST edge cases, Edit prefill, no public-list regression.
- Verify changes on staging through normal `main` workflow after approval, fixing staging defects iteratively. **No production deployment without separate explicit authorization.**
- Out of scope: new authentication providers, new event schema, RSVP/registration, recurrence, organization permissions, or production release.

## 5. Items to settle in design review

- Specific MUI date/time picker dependency, license constraints, and mobile clock UX.
- Whether the duration should be shown directly beneath the equal-width time inputs or in an End time label area; the equal sizing and prominent date are required either way.
- Exact loading/error presentation for automatic magic-link exchange.

**Next gate:** Review and approve these requirements before completing the technical design and implementation task list.
