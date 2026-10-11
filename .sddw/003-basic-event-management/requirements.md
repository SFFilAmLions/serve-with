# SDDW 003 — Basic Event Management: Requirements

Status: Approved functional requirements; technical design pending.

## 1. Public event listing

- The landing page is publicly accessible without signing in.
- Display **Upcoming Events** by default, with an option to view **Past Events**.
- An event remains upcoming while it is in progress, until its end instant has passed.
- Upcoming events are ordered by start time (earliest first); past events by start time (latest first). Define a deterministic tie-breaker in the design.
- Display each event's title, local start and end dates/times, time zone, and location directly in the list; no dedicated event detail page in this milestone.
- If no upcoming events exist, show **No upcoming events** and **Check back soon for new opportunities to serve.** If no past events exist, show **No past events yet.**
- Authenticated administrators see an **Add Event** action, including in empty states.

## 2. Event data

Each event must have:
- A nonblank title.
- Required start date and time.
- Required end date and time, strictly later than the start instant; overnight events are supported.
- An IANA time zone, defaulting to `America/Los_Angeles`; display event-local times, not viewer-local times.
- A nonblank, free-text location (e.g., venue, address, or online location).

Persist in Cloudflare D1. Store event instants unambiguously and retain the event time zone. Reject nonexistent or ambiguous local times caused by daylight-saving transitions with a clear validation message rather than silently shifting or guessing an offset.

## 3. Administrative management

- Only authenticated, authorized administrators may create, update, or delete events. Reuse the existing SDDW 002 authentication.
- Admins may edit or soft-delete both upcoming and past events.
- Create and Edit use the same dialog; Edit prepopulates the event's details.
- Save validates, persists, closes the dialog, and refreshes the visible list. Failures are reported clearly without losing form values; Cancel does not save.
- If there are changed, unsaved values, closing the dialog through Cancel, close button, Escape, or backdrop requires a **Discard unsaved changes?** confirmation. Unchanged dialogs close without confirmation.
- Delete uses a separate confirmation dialog.
- Delete is soft deletion using a deletion timestamp (e.g., `deleted_at`), retains the record in D1, and removes the event from public upcoming and past listings.
- An administrative restore interface is excluded from this milestone.

## 4. Security, usability, and testing

- The public read API returns only non-deleted event records and no private administrative data.
- Create, update, and delete authorization is enforced server-side, with server-side input validation (not solely browser-side).
- The interface is keyboard-accessible with labeled inputs, dialogs, focus handling, and clear loading/success/error feedback.
- Automated tests must cover public listing, upcoming/past classification (including in-progress), chronological ordering, CRUD, soft deletion, authorization, validation, midnight crossings, and invalid/ambiguous daylight-saving local times.
- Deploy changes to **staging** first. Production deployment requires separate explicit approval.

## 5. Explicitly out of scope

- Event descriptions, individual event detail pages or permanent event links.
- Volunteer registration/signups or attendance management.
- Organization/project assignment and granular permissions beyond the existing admin allowlist.
- Recurring events, maps/geocoding, invitations/notifications.
- Restoring deleted events in the UI.

## 6. Design phase not yet approved

The UI framework, styling system, component choices, API routes, schema, and implementation tasks will be determined during design review. Saving this document does not authorize implementation or production release.
