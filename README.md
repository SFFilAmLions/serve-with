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
2. Under GitHub **Settings → Secrets and variables → Actions**, create repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. These are required by the Deploy workflow. If you use protected GitHub Environments, ensure the secrets are accessible in `preview` and `production`.
3. Feature PRs from this repository deploy preview Workers as `serve-with-pr-N`. Wrangler reports their `workers.dev` URLs in Action logs. The preview Worker names are intentionally separate from production. Fork PRs only run CI.
4. Pushes to `main` deploy the production `serve-with` Worker.
5. In Cloudflare dashboard, configure a custom domain for the `serve-with` Worker: `servewith.sffilamlions.org` (the DNS zone must be managed in Cloudflare).
6. Verify both a PR preview and production HTTPS URL before accepting the feature. Merge does not automatically prove that DNS is correctly configured.

## Review rules

One narrow spec and feature per PR. Review visible changes via preview deployment, then verify production after merge. Avoid adding future product complexity prematurely.
