# SDDW-006 — API Inventory and Generator Spike

**Status:** Initial static inventory against `main/src/worker.ts`; no runtime characterization or generator execution yet.

## Existing route inventory

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | /api/events | Public | `view=upcoming\|past`; `{view,events}` |
| GET | /api/events/{id} | Public | `{event}` or 404 |
| GET, PUT | /api/users/{id} | Session, completed profile/policies; self or admin | PUT requires same-origin; admin DOB correction |
| GET | /api/admin/users | Privileged admin | Search `q,sort,direction,letter,offset`; paginated |
| GET | /api/admin/dashboard | Privileged admin | Basic admin status |
| POST | /api/admin/events | Privileged admin | Same-origin; 201 or 422 |
| PUT, DELETE | /api/admin/events/{id} | Privileged admin | Same-origin, optimistic `version`; DELETE has JSON body, 204 success |
| GET | /api/auth/turnstile-config | Public | `{siteKey}` |
| GET | /api/auth/me | Public | Auth/session, profile readiness and policy metadata; 503 without configured auth |
| POST | /api/auth/profile | Verified session | First/last name and DOB, one-time completion |
| POST | /api/auth/agreements | Verified session + complete profile | Version-specific Terms/Privacy |
| POST | /api/auth/request | Public with rate limits / Turnstile | Generic response resists account enumeration |
| POST | /api/auth/verify | Public with verification challenge | Email + OTP; session cookie |
| POST | /api/auth/magic | Public with verification challenge | Magic token; session cookie |
| POST | /api/auth/logout | Same-origin | Clears session cookie |

**Behavioral caveats:** All auth POSTs require same-origin `Origin` and reject `Sec-Fetch-Site: cross-site`; absent/incorrect method may currently return 400 rather than 405. Admin auth requires session, allowlisted email, email verification, complete profile and current policy acceptance. User endpoint returns not-found to hide unauthorized IDs. Authentication intentionally returns generic errors for rejected challenges. Successful mutating responses use `Cache-Control: no-store`. SPA fallback explicitly enumerates deep links; new admin routes and docs endpoints will need deliberate routing.

**Not API routes:** `/events/{id}`, `/admin/events/new`, `/admin/events/{id}/edit`, `/users/{id}`, `/terms`, `/privacy`, `/login` are frontend routes. New SDDW-006 routes are not implemented on main.

## Candidate toolchains

- `openapi-typescript` plus `openapi-fetch` is a promising typed frontend client, **not a server code generator**. Needs complementary generated server interfaces/operation binding.
- OpenAPI Generator `typescript-fetch` produces a client. Its public feature matrix has OpenAPI 3.1 limitations around null/union schemas; treat as candidate requiring a compatibility spike, not selected.
- Use `wrangler types` for Cloudflare runtime types; this does not generate application API server bindings from OpenAPI YAML.
- A small deterministic in-repository *generator* translating OpenAPI operation IDs and schemas to Worker handler interfaces/dispatch may be an alternative if off-the-shelf generators do not fit, but this must actually be built, tested and reviewed. Do not hand-maintain an independent route catalogue.

**Decision status:** Not selected. No claim of generated client/server compatibility or runtime parity until the Worker integration proof is executed.

## Characterization tests to add

1. Public GET event list/detail status, query validation and error envelopes.
2. Same-origin POST with cookie auth; rejected cross-site POST.
3. Non-admin denial of admin operations; unverified/incomplete user gates.
4. `/api/auth/me` unauthenticated vs authenticated envelope.
5. Profile completion one-time conflict; verified email login and logout cookie behavior.
6. Existing editor optimistic-concurrency 409/204 responses.
7. Check generated client serializes cookies and current API field names without silent changes.

Next: produce the initial YAML and run generation in a Worker-compatible test environment. Keep contract-first YAML authoritative.

## Contract spike progress (October 11, 2026)

The authoritative YAML now defines `listEvents`, `getEvent` and `createAdminEvent`. The last operation exercises a JSON mutation, cookie security declaration, required Origin header and 201/4xx/503 response envelopes. Its runtime CSRF and admin checks currently live in the handwritten Worker and **have not been replaced or tested through generated adapters**.

**Important compatibility warning:** The current API's security requirements extend beyond cookie presence; OpenAPI security schemes are descriptive and do not enforce same-origin, session privileges or CSRF by themselves. The YAML's request schema is a contract target; exact validation parity must be checked against existing whitespace-trimming/unknown-field behavior before switching on runtime request validation. The first YAML draft does not establish full endpoint coverage or generation readiness.
