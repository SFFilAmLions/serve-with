# Serve With

Volunteer coordination for SFFilAmLions, developed in small SDDW iterations.

## Local development

Node.js 22+:
```bash
npm install
npm run dev
npm run build
```

See [SDDW feature 001](.sddw/001-project-foundation/requirements.md). Feature 002 will add the YAML admin allowlist, email OTP and magic links.

## Deployment environments

| Event | Result |
| --- | --- |
| Pull request | CI + Conventional Commit PR-title check; **no Worker deployment** |
| Push/merge to `main` | Automatically deploys shared staging Worker `serve-with-staging` |
| Release Please release PR merged | Creates GitHub versioned release; does **not** automatically deploy production |
| Manual **Deploy production** workflow with approved, published stable release tag | Checks out tag and deploys Worker `serve-with` |

Staging hostname: `staging.servewith.sffilamlions.org`  
Production hostname: `servewith.sffilamlions.org`

## Setup

1. Add GitHub repository Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Grant token Workers Scripts Write for the selected Cloudflare account.
2. On first push to `main`, [Deploy staging](../../actions/workflows/deploy.yml) creates `serve-with-staging`. Find its `workers.dev` URL in workflow logs.
3. In Cloudflare, attach `staging.servewith.sffilamlions.org` to that Worker as a **Custom Domain** and verify HTTPS.
4. Ensure GitHub Actions has permission to create PRs, so Release Please can maintain its release PR. Squash merge with Conventional Commit PR titles.
5. Merge an approved Release Please PR; confirm a stable published GitHub Release exists.
6. In [Deploy production](../../actions/workflows/deploy-production.yml), choose **Run workflow** on `main`, provide the published tag (for example `v0.2.0`) and start deployment. You can optionally require reviewers on the GitHub `production` environment.
7. Attach `servewith.sffilamlions.org` as a Cloudflare Custom Domain on `serve-with` and verify HTTPS. Keep staging and production environment bindings separate if later introducing stateful services.
8. The previous `serve-with-pr-1` Worker is not removed by this change; remove it manually after shared staging is verified, if no longer needed.

## Versioning

PRs use Conventional Commit titles (`feat:`, `fix:`, `docs:`, etc.) and preferably squash merges. Release Please maintains the version manifest (starting at `0.1.0`), changelog and release PR. Staging tracks the latest `main`; production tracks a deliberately promoted version.

For now, production rebuilds source at the released tag. Reusing the *exact same built artifact* across environments and candidate tags is future work, not implemented here.
