# SDDW-005 — Material UX refinement

**Status:** User-requested additions to new draft PR based on main. Implementation and validation pending. No staging, merge, or production authorization.

## Identity and navigation
- Title/header: **Serve With Lions**.
- Gravatar avatar for verified email, with neutral fallback; review privacy/CSP impact of sending an email hash to Gravatar.
- Top-bar appearance icon button, independent of account menu; Sun = Light, Moon = Dark, monitor/combined symbol = System. Each menu entry has an icon, label and selected state.
- Icons for every account dropdown action, including profile, workspace, sign in and sign out.
- Attendee/Admin switch with arrows icon outside dropdown on desktop; menu fallback on small screens. Respect authorization.
- Back navigation for secondary/detail/editor pages, with sensible fallback and unsaved changes protection.

## Event redesign
- Upcoming/Past shown as compact single-select Material pill buttons, not tabs.
- Use outlined Material Cards for events; title, concise start/end details, location Chip with pin icon, optional small zone Chip with abbreviated timezone and tooltip full IANA zone.
- Omit zone Chip only when event IANA timezone equals browser's IANA timezone. Same event-local day: one date with start/end time range; cross-day: show both dates. Verify year-boundary and DST formatting.
- Admin dark mode uses ordinary Material dark surfaces without a separate admin accent/background color. Administrator scope remains explicitly labeled.
- Compact action buttons; event editor has one Save action at lower right beside Cancel, not duplicate top/bottom Save. Back/close in title row, clear validation, confirm discard.
- Footer source/version controls styled as restrained Material Chips/links.
- Overall responsive layout and action density inspired by Google Material apps.

## Users directory — search only
- Remove the vertical A–Z rail and any letter-picker/filter UI. No alphabetical jump navigation is needed.
- Retain a prominent server-backed search field for name and email, with a clear action and accessible status for loading, no results and errors.
- Retain name sorting and incremental pagination/Load more. Search should reset pagination, preserve a user's search when visiting a profile and returning, and handle stale responses safely.
- Do not add letter filtering through a different control.

## Verification
- Browser tests for menus, navigation, directory filters, pills, theme, Gravatar fallback, compact actions and no duplicate Save.
- Unit/integration tests for date formatting, timezone parity, DST, duplicate/update/delete behavior and privilege gates.
- Keyboard/screen reader, contrast, responsive and touch-target accessibility testing.
- Keep PR draft; do not merge, deploy or modify remote staging configuration.

## Login email-request abuse prevention (new)
- Prefer **Cloudflare Turnstile (free managed widget)** before sending an email code or magic link. Server must verify the response token with Cloudflare Siteverify before generating or sending an email. Never trust a client-only CAPTCHA or publish the secret key.
- Protect both first email requests and **Resend code**. Keep existing IP/email rate limits, non-enumerating responses and challenge expiration; a CAPTCHA supplements, not replaces, limits.
- Bind verification to expected hostname/action where applicable; reject missing, expired and invalid tokens; fail closed if verification is unavailable. Prevent replay; Turnstile tokens are short-lived and single-use.
- Use separate public site key and server-side secret, provisioned by the operator after deployment approval. No hardcoded credentials or deployment/config changes in this PR. Document dev/test configuration and mock verification in tests.
- Add browser accessible loading/validation/retry/error states; confirm CSP/script hosting and privacy notice implications.
- Alternative if Turnstile is infeasible: Cloudflare WAF/rate-limiting and bot defenses on the route, but preserve server-side email quotas. Do not rely on client-only hiding of the request form.
