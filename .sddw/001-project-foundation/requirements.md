# 001 — Project Foundation: requirements

Status: proposed for review

## User story
As a stakeholder, I can visit a public Serve With page to verify that the project is deployed and review incremental progress.

## In scope
- Minimal responsive page displaying “Serve With” and project status.
- TypeScript app with a reproducible build and build checks for pull requests.
- Cloudflare Worker static asset hosting; preview deployment for PRs and production deployment on main.
- HTTPS production hostname: servewith.sffilamlions.org.
- Setup guidance and verified deployment acceptance checklist.

## Out of scope
- Admin allowlist, sessions, authentication, OTP and magic links (future feature 002).
- Database, events, volunteer signups, email delivery, elaborate roles, release automation.

## Acceptance criteria
- [ ] Fresh checkout builds without manual editing.
- [ ] PR runs build checks.
- [ ] PR provides a working preview URL after Cloudflare credentials are configured.
- [ ] Merge to main deploys production automatically.
- [ ] https://servewith.sffilamlions.org loads over HTTPS and displays the landing page.
- [ ] Preview and production deployments have been verified by a human.

Do not mark feature complete solely because files have been committed.
