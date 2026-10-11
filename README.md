# Serve With SF Fil-Am Lions

Volunteer and event coordination for the San Francisco Fil-Am Lions Club. Built with **React, Material UI, TypeScript, Cloudflare Workers, and Cloudflare D1**, using Specification-Driven Development Workflow (SDDW).

## Environments

| Environment | URL | Status |
| --- | --- | --- |
| **Staging / beta** | **https://servewith-beta.sffilamlions.org/** | Active testing environment, deployed automatically from `main` |
| **Production** | **https://servewith.sffilamlions.org/** | Production hostname; release/promotion is separately controlled (do not assume currently deployed) |

Staging Worker: `serve-with-staging`. Production Worker: `serve-with`. Both environments have separately configured D1 bindings. The staging Worker also has a `workers.dev` URL: https://serve-with-staging.sffilamlions.workers.dev/.

## Current project status

**SDDW 001 — Project foundation:** Initial project infrastructure, GitHub automation, Cloudflare deployment and versioning.

**SDDW 002 — Administrator authentication:** Email-based one-time code and magic-link authentication, admin authorization via `config/admins.yaml`, sessions, and Resend integration. This is currently **administrator-focused**, not general-user self-registration.

**SDDW 003 — Basic event management:** **Merged into `main` and tested on staging.** Public Upcoming/Past event lists and authenticated administrator Create/Edit/Delete APIs and UI are present. A tester confirmed real authentication, event creation, viewing, and editing on staging. That confirmation does **not** imply every edge case or deletion flow has been manually verified.

**SDDW 004 — Registration, account management, and UX refinements:** **Scope defined; draft requirements and proposed design under review, not implemented or deployed.** See [SDDW 004 requirements](.sddw/004-auth-event-editor-ux/requirements.md), [proposed design](.sddw/004-auth-event-editor-ux/design.md), [tasks](.sddw/004-auth-event-editor-ux/tasks.md), and [draft PR #13](https://github.com/SFFilAmLions/serve-with/pull/13). Planned scope includes:

- Dedicated email-first login page, auto-completing magic-link sign-in, first-login registration/profile completion, and a required Terms/Privacy checkbox with timestamp and version-based reacceptance.
- Required first/last name, verified email and date of birth; date-of-birth corrections restricted to administrators.
- Staging-only email whitelist; separate Attendee and Administrator experiences; own-profile name editing and version-aware Terms of Use / Privacy Policy acknowledgment. Account deletion and recovery are deferred.
- Administrator-only Users directory and Edit User page. **No standalone Create User page.**
- Dedicated Create Event page, Duplicate Event shortcut, simplified date/time pickers and live duration preview.
- Conventional app-bar user/account menu; user-role and profile-data access enforced on the server.

Deferred email changes, account deletion/recovery keys and historical signup restoration are documented in [future account lifecycle notes](.sddw/004-auth-event-editor-ux/deferred-account-lifecycle.md), not part of SDDW 004.

**Do not mistake features proposed in SDDW 004 for functionality already live on staging.** Production functionality is not asserted by this README.

## Local development

Requires Node.js 22 or newer:

```bash
npm install
npm run dev
npm test
npm run build
npm run test:browser
```

The build generates the server-side admin allowlist from `config/admins.yaml`. The browser test command uses Playwright and may require Chromium installation (`npx playwright install chromium`). Cloudflare resources, D1 migrations and Resend credentials require separate setup for live auth/deployment.

## CI, staging and production deployment

| Trigger | Action |
| --- | --- |
| Pull request | CI and Conventional Commit PR-title validation; **does not deploy Worker** |
| Push/merge to `main` | Automatically applies staging D1 migrations and deploys the staging Worker via [Deploy staging](.github/workflows/deploy.yml) |
| Published GitHub release | Triggers the [Deploy production](.github/workflows/deploy-production.yml) workflow |
| Manual production workflow dispatch | Requires a published, stable version tag |
 
Production deployment verifies a published stable semantic-versioned release and requires separately configured production D1 resources. **Do not publish a production release without explicit approval**; publishing one is itself a deployment trigger. Production does not automatically deploy on each `main` merge.

Release Please maintains release proposals, version information and the changelog. See the [GitHub Actions workflows](https://github.com/SFFilAmLions/serve-with/actions) for actual deployment results instead of interpreting a configured URL as proof of deployment.

Staging and production use separate Worker/D1 resources; never apply staging migrations or data changes to production by default.

## Specifications and references

- [SDDW 001 — Project Foundation](.sddw/001-project-foundation/requirements.md)
- [SDDW 002](.sddw/002-admin-authentication/requirements.md)
- [SDDW 003 — Basic Event Management](.sddw/003-basic-event-management/requirements.md)
- [SDDW 004 — Requirements](.sddw/004-auth-event-editor-ux/requirements.md)
- [SDDW 004 — Proposed Design](.sddw/004-auth-event-editor-ux/design.md)
- [SDDW 004 — Tasks](.sddw/004-auth-event-editor-ux/tasks.md)


## License

Serve With is open-source software licensed under the [MIT License](LICENSE).
