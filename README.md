# Serve With

Volunteer coordination for SFFilAmLions, developed in small SDDW iterations.

## Run locally

Use Node.js 22+.

```bash
npm install
npm run dev
npm run build
```

## Feature 001 — Project Foundation

See [requirements](.sddw/001-project-foundation/requirements.md), [design](.sddw/001-project-foundation/design.md), and [tasks](.sddw/001-project-foundation/tasks.md).

The current application is an informational landing page. Authentication and admin management (YAML allowlist, email OTP **and** magic links) are explicitly planned for a later feature.

## Deploy with Cloudflare Workers

1. Create a Cloudflare API token with permission to edit Workers, and identify the Cloudflare account ID.
2. Under GitHub **Settings → Secrets and variables → Actions**, create repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. These are required by the Deploy workflow. If using protected GitHub Environments, ensure credentials are accessible in `preview` and `production`.
3. Same-repository feature PRs deploy preview Workers as `serve-with-pr-N`; the `workers.dev` URLs appear in Action logs. Fork PRs only run CI.
4. Pushes to `main` deploy the production `serve-with` Worker.
5. In Cloudflare dashboard, configure a custom domain for the `serve-with` Worker: `servewith.sffilamlions.org` (zone must be managed in Cloudflare).
6. Verify preview and production HTTPS URL before accepting the feature.

## Conventional commits and releases

- Use PR titles such as `feat: add events page`, `fix: correct redirect`, `docs: explain setup`. Titles are checked by GitHub Actions.
- Prefer squash-merging a PR so the resulting commit subject matches its Conventional Commit title.
- Release Please runs after each push to `main` and updates a pending release PR; merging that release PR creates the GitHub version tag and changelog.
- Versioning begins at `0.1.0` and uses feature=minor, fix=patch until 1.0. The manifest version is not automatically the currently deployed build.
- Every ordinary merge to `main` still deploys production; releases and deployments are separate concepts.
- Staging/version promotion is a future design option, not part of feature 001.

## Review rules

One narrow spec and feature per PR. Review visible changes via preview deployment, then verify production after merge. Avoid adding future product complexity prematurely.
