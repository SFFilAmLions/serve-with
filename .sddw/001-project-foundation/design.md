# Design — 001 Project Foundation

- Minimal frontend: Vite + TypeScript + standard HTML/CSS. No UI framework yet.
- Build output: `dist/`, served via Cloudflare Workers Static Assets.
- A single Cloudflare Worker named `serve-with` for production; per-PR Workers named `serve-with-pr-N`.
- GitHub Actions: separate build checks and deployment workflow. Preview on same-repository pull requests; production on pushes to main.
- Production custom domain is mapped using Cloudflare Dashboard after the first deploy; do not hardcode account-specific DNS IDs or secrets.
- Cloudflare credentials live in GitHub Actions secrets, never source files.
- Plan ahead for feature 002: implement email OTP **and** magic links, admin allowlist in YAML, and server-side session validation in a separate feature. No backend/auth implementation in this iteration.

## Change management

- PR titles must follow Conventional Commits. Prefer squash merges with the PR title as the resulting commit subject.
- Release Please runs on every push to `main`, updates one pending release PR, and publishes a tagged GitHub release when that release PR is merged.
- Pre-1.0 features bump minor versions, fixes bump patch. Seed the release manifest at `0.1.0`; it is version bookkeeping, not proof of a production deployment.
- Merge of regular feature PRs continues to deploy production independently of GitHub release cadence. Do not gate every live feature on version tagging.

## Future staging (out of scope)

- A future staging environment may run release-candidate versions (for example `v0.3.0-rc.1`), while production runs an approved version.
- Aim to promote the identical tested build/artifact between environments, configuring environment-specific bindings separately.
- Do not add staging branches, Workers, DNS, promotion jobs, or prerelease automation in feature 001.

## Risks / prerequisites

- Deploys cannot work until CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are configured as GitHub Actions secrets.
- Cloudflare DNS/Worker custom domain requires access to the correct zone.
- PRs from forks cannot receive deployment secrets; CI build remains available.
- Release Please requires GitHub Actions workflow permissions to create pull requests and write repository contents, potentially controlled by organization settings.
