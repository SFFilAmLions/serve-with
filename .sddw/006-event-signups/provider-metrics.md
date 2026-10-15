# Provider usage API availability — SDDW-006 T019

Research date: October 11, 2026. No account credentials were used or changed; account-specific plan permissions have **not** been verified.

| Provider | Verified public API/metric availability | Permissions/provenance concern | Recommended behavior |
| --- | --- | --- | --- |
| Cloudflare D1 | GraphQL Analytics API: `d1AnalyticsAdaptiveGroups`, `d1StorageAdaptiveGroups`, `d1QueriesAdaptiveGroups`, rows read/written, database size and query counts; 31-day retention | Account ID, scoped analytics API token, resource identifier. Account-shared versus database-specific dimensions must be explicit | Read-only query with bounded time window and cache; never invent quota limit |
| Cloudflare Workers | GraphQL account/script analytics; verify current dataset and fields against the specific account before use | Distinguish zone/workers script/account totals, staging and production | Unavailable until verified account permissions |
| Resend | As of **2026-10-01**, GET `/usage` reports daily and monthly email used/limits/reset alongside other quotas | Requires a **full-access API key**, which must NOT be substituted by or granted to the existing transactional sending key without approval; totals are account-wide | Show unavailable until a separately authorized scoped credential and full-access risk approval exist |
| Turnstile | Siteverify success/fail and challenge outcome data are available in Cloudflare analytics; GraphQL `turnstileAdaptiveGroups` requires account and widget scope verification | Widget/site versus account aggregation must be clear; analytics permissions not yet verified | Show unavailable until permissions and exact fields are verified |

References:
- D1 metrics: https://developers.cloudflare.com/d1/observability/metrics-analytics/
- Resend Usage API announcement: https://www.resend.com/changelog/account-usage-api
- Turnstile token validation: https://developers.cloudflare.com/turnstile/turnstile-analytics/token-validation/
- Turnstile analytics: https://developers.cloudflare.com/turnstile/turnstile-analytics/challenge-outcomes/

The feature must return **unknown**, not 0, for metrics lacking verified access and must never derive a utilization percentage without a trustworthy limit. Requested keys/billing/permissions are explicitly outside the current authorization. Dashboard can be built with defensive unavailable states and opt-in adapters without a live provider query.

## Phase 1 release-scope decision (October 15, 2026)

**Recommendation for SDDW-006 initial release:** retain the administrator-only Usage & Quotas dashboard and read-only API, but treat provider-reported consumption/limits as an *optional enhancement*, not a blocker for deploying event signups. When authorization or a trustworthy provider response is missing, render **Unknown / Unavailable** and explanatory source/scope information; never substitute zero, calculate misleading utilization percentages, or claim an unverified account-wide limit. Existing browser and API tests cover unavailable values, failure retry and administrator access.

Do **not** use the transactional Resend sending credential for account-usage queries or silently expand Cloudflare permissions. Live metrics adapters, new API credentials, polling costs, and any provider-account capability verification are deferred to a separately authorized follow-up after the event-signup staging acceptance. This is a recommended implementation scope, not proof of deployed metrics or permission to change credentials.

**Required for staging:** verify dashboard failure isolation, 401/403 protections, placeholder meanings and lack of secrets in bundled assets. This may ship with provider values explicitly unavailable. Any decision to require fully populated metrics for initial release would be a scope change requiring provider access and a separate implementation gate.
