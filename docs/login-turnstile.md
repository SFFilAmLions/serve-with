# Login anti-spam protection (Cloudflare Turnstile)

SDDW-005 uses Turnstile for the email-code/magic-link request route and its resend flow. Existing rate limits and the generic eligible-account response remain in place.

## Deployment configuration (NOT performed by this PR)

- Create a managed Turnstile widget for each intended hostname in Cloudflare. Match the widget's hostname to the requested website hostname.
- Set Worker **TURNSTILE_SITE_KEY** (public widget identifier) and **TURNSTILE_SECRET_KEY** (private server secret) in the corresponding Cloudflare Worker environment. Do not commit the secret. The current implementation treats the presence of the site key as the feature switch and fails closed if the secret is absent.
- Configure Cloudflare security policies/CSP, if any, to allow the Turnstile script and iframe from `https://challenges.cloudflare.com`.
- Do not enable keys until the correct widget hostname, secrets, and user journey can be tested on staging with authorization.

## Behavior

The frontend fetches the public site key, renders a managed challenge, and includes the one-time token in the request/resend body. The server performs a POST to Cloudflare Siteverify and verifies success, exact hostname, and action `request-login`. Missing or invalid tokens are rejected before email generation. Every resend requires a new challenge token.

If `TURNSTILE_SITE_KEY` is unset, legacy login requests continue with existing email/IP rate limiting; **this does not provide CAPTCHA protection**. Complete and separately approve environment provisioning before asserting CAPTCHA is active.

## Verification to complete

- With keys configured: valid sign-in and resend, missing/invalid/replayed/expired token, hostname/action mismatch, Siteverify outage, request quotas and safe error states.
- Check keyboard/screen-reader flows, CSP, mobile layout, and managed-widget loading failures.
- Ensure privacy disclosures reflect Cloudflare challenge processing. Do not log challenge tokens, secrets, email recipients, or response bodies.
