# Design — 001 Project Foundation

- TypeScript, Vite and standard HTML/CSS; Cloudflare Workers Static Assets in `dist/`.
- PRs run CI and Conventional Commit title validation only. No PR-specific Workers.
- `main` deploys to persistent `serve-with-staging` on each push, via `deploy.yml`.
- Release Please maintains a pending release PR; merging it publishes the GitHub tag and release.
- Production `deploy-production.yml` is an explicit manual promotion: input a stable published release tag, validate it against GitHub Releases, check out that tag, build and deploy `serve-with`.
- Production is not deployed on arbitrary merges. GitHub Actions `production` environment may additionally require reviewer approval.
- Beta URL: `servewith-beta.sffilamlions.org`; production URL: `servewith.sffilamlions.org`. Bind via Cloudflare Workers Custom Domains, not manual CNAME records. Production binding remains pending until the production Worker exists.
- Two Workers are persistent; avoid orphaned per-PR Workers going forward. Existing `serve-with-pr-1` remains until manually cleaned up.
- GitHub repository secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`; never commit credentials.
- Authentication via YAML admin allowlist, email OTP **and** magic links belongs to feature 002.

## Release practices

- Enforce Conventional Commit PR titles; squash merge using the title.
- Release Please runs on `main`; pre-1.0 `feat` bumps minor and `fix` bumps patch.
- Publish versions separately from merge/deploy to staging; production promotion is explicit and release-tag-based.
- This first iteration rebuilds the tagged source for production; true build-once artifact promotion is future work.
- GitHub-generated release events using the default `GITHUB_TOKEN` may not trigger downstream Actions; a deliberate manual promotion avoids that dependency.

## Risks

- Cloudflare account-level Worker script write access and two GitHub Actions secrets required.
- Configure beta/production Worker custom domains after initial deployments.
- A production release exists only after Release Please's release PR is merged.
- Use a stable published release tag (not a draft or prerelease) for production.
