# Design — 001 Project Foundation

- Minimal frontend: Vite + TypeScript + standard HTML/CSS. No UI framework yet.
- Build output: `dist/`, served via Cloudflare Workers Static Assets.
- A single Cloudflare Worker named `serve-with` for production; per-PR Workers named `serve-with-pr-N`.
- GitHub Actions: separate build checks and deployment workflow. Preview on same-repository pull requests; production on pushes to main.
- Production custom domain is mapped using Cloudflare Dashboard after the first deploy; do not hardcode account-specific DNS IDs or secrets.
- Cloudflare credentials live in GitHub Actions secrets, never source files.
- Plan ahead for feature 002: implement email OTP **and** magic links, admin allowlist in YAML, and server-side session validation in a separate feature. No backend/auth implementation in this iteration.

## Risks / prerequisites
- Deploys cannot work until CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are configured as GitHub Actions secrets.
- Cloudflare DNS/Worker custom domain requires access to the correct zone.
- PRs from forks cannot receive deployment secrets; CI build remains available.
