# 001 — Project Foundation: requirements

Status: proposed for review

## User story
As a stakeholder, I can visit the Serve With beta website to inspect accepted changes, and promote a published release to production after approval.

## In scope
- Minimal responsive TypeScript landing page.
- CI on each PR, without creating PR-specific Cloudflare Workers.
- One shared staging Worker deployed automatically on every push to `main`.
- One production Worker deployed only when an operator selects a published stable release tag and triggers promotion.
- Cloudflare Workers Custom Domains: `servewith-beta.sffilamlions.org` and `servewith.sffilamlions.org` (not manual CNAMEs).
- Conventional Commit PR titles, Release Please and deployment instructions.

## Out of scope
- Authentication, admin YAML, email OTP and magic links (feature 002).
- Database, event management and signup features.
- Release candidate staging tags, automatic artifact promotion, per-PR Workers.

## Acceptance criteria
- [ ] Clean checkout builds.
- [ ] PR CI and title validation pass, with no PR-specific deployments.
- [ ] Push to main deploys `serve-with-staging`.
- [x] Beta hostname serves the website over HTTPS.
- [ ] Release Please produces a published stable GitHub release.
- [ ] Explicit promotion of that release deploys `serve-with` to production.
- [ ] Production hostname serves the approved release over HTTPS.
- [ ] Operator verifies both environments.

Do not mark complete until the staging and production URLs have been tested.
