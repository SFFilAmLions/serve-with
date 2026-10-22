# Serve With design system

**Status:** Proposed product and implementation standard.  
**Applies to:** Attendee, administrator, authenticated, anonymous, staging and production user interfaces.  
**Source of truth for milestone scope:** [SDDW-006 requirements](../.sddw/006-event-signups/requirements.md).

## Purpose

Serve With should feel warm, operational and calm: welcoming enough for a volunteer signing up for an event, while giving administrators a dependable workspace for coordination. This document defines the shared visual and interaction rules that make those experiences recognizably one product.

This is a design and implementation guide, not a replacement for behavior, authorization, accessibility or privacy requirements. Existing routes, security boundaries, workflows and light/dark-theme support remain intact unless a separately approved change says otherwise.

## Foundations

### Color and meaning

| Token / role | Meaning | Use |
| --- | --- | --- |
| Club gold | Primary action and selected state | One primary action per screen; selected segmented pill; measured capacity/progress |
| Admin orange | Administrator context and caution | `Serve With Lions · Admin` suffix, administrative context, non-destructive caution |
| Error red | Destructive or failed state | Delete/withdraw confirmation, errors, staging-only environment notice |
| Informational blue/teal | Neutral information | Informational alerts and account guidance |
| Surface / divider neutrals | Structure | Cards, fields, tables, separators and quiet metadata |

Gold must remain contrast-safe in both themes. Orange is never a substitute for the primary action color. Red is reserved for failures, destructive actions and the intentionally prominent staging notice.

### Type, icon and spacing scale

- Page title: `h4`; section heading: `h5`; card/row title: `h6`.
- Use the existing Ubuntu display treatment for headings and Alata for interface/body copy.
- Material Symbols Rounded is the sole functional icon family: 18px inline/contextual, 20px labeled action, 24px header utility.
- Use an 8px spacing base: 8px compact gap, 16px control/content gap, 24px section gap, 32px page-section separation.
- Keep the existing rounded language: fields and buttons are compact rounded controls; cards are generous, outlined 20px surfaces; segmented controls are 24px pills.

## Application structure

Every feature page follows this order when applicable:

1. Shared application shell: logo, product title, appearance menu, account menu, and workspace navigation.
2. Staging notice, only in staging.
3. Contextual back link for a child record or editor.
4. `PageHeader`: title, optional supporting text/metadata, and the single primary action for the page.
5. Primary content grouped into named sections.
6. Quiet build/status footer.

Do not repeat a generic product heading inside a page that already has a specific page title. On top-level attendee events, `Serve With SF Fil-Am Lions` is the approved exception.

## Navigation and workspace context

- Attendee workspace has exactly two segmented pills: **View events** and **My signups**.
- Administrator workspace has exactly three segmented pills: **Events**, **Users**, and **Usage**.
- A selected pill is filled club gold with dark text in both themes; unselected pills remain outlined. Selection may never depend only on a border or text-color change.
- The administrator context appears as orange `· Admin` text beside the product title, never as an additional pill or chip.
- Administrator/attendee switching stays contextual: an event page switches to the same event in the other workspace; a top-level page switches to its parallel top-level page.

## Page families

### Browse pages

Applies to Events and My signups.

- Use `PageHeader`, then segmented filter pills, then a responsive event-card grid.
- Empty, loading and error states use the same content width and a compact message treatment; skeletons mirror the final card geometry.
- Event cards have one anatomy: title, key facts with icons, capacity/status, then actions aligned at the bottom.

### Record pages

Applies to event detail, profile, and administrator event management.

- Begin with a back action, followed by a title/action row and key metadata.
- Keep one visually dominant action: sign up/cancel registration for attendees; edit for an administrator record.
- Use named sections for details, roster, history and related information rather than visually unrelated blocks.

### Directory pages

Applies to user directory, event roster and signup history.

- Desktop presentation is a table with clear column headers; narrow screens use equivalent stacked rows with labels.
- Search and filters precede the data surface.
- Row-level operations are secondary; destructive operations are explicitly labeled and red.
- Do not use card grids to represent dense, comparable directory data.

### Task pages

Applies to sign-in, onboarding/profile completion, agreement completion, Create User and event editing.

- Use a constrained form column (roughly 560–760px depending on task density).
- Place a short explanation before fields, use standard field widths, and keep one full-width primary submit action.
- Forms must not stretch inputs unnecessarily on desktop; profile editing should feel closer to a focused contact editor than a dashboard.
- Dialogs are reserved for short, interruptive tasks or destructive confirmations. Full-page editors keep the standard page structure.

### Dashboard and document pages

Applies to Usage & Quotas, Terms and Privacy.

- Usage groups metrics into summary cards and uses progress bars only where a reliable maximum exists. Reset times use the same relative-time language as event timing.
- Diagnostics are visually demoted in a closed disclosure, never competing with operational status.
- Terms and Privacy use a constrained reading measure, document metadata near the title and consistent heading rhythm.

## Component contract

These components should be extracted or formalized in code instead of repeatedly recreating one-off layout rules.

| Component | Required responsibility |
| --- | --- |
| `AppShell` | Header, workspace context, navigation, staging notice and footer placement |
| `PageHeader` | Back affordance, title, optional metadata/supporting copy, primary action slot |
| `SegmentedNavigation` | Accessible pill selection, selected state and horizontal overflow behavior |
| `EventCard` | Shared event title/facts/capacity/action anatomy across lists and My signups |
| `EventFacts` | Calendar, time, location, relative timing and capacity semantics |
| `ContentState` | Loading skeleton, empty state, recoverable error and retry presentation |
| `DataTable` | Responsive table-to-stacked-row directory presentation |
| `FormPage` | Constrained form layout, explanation, actions and validation-summary placement |
| `StatusMetricCard` | Usage value, known/unknown limit, optional progress and reset label |

Component extraction must preserve semantic HTML, Material focus behavior, accessible names, keyboard interaction and existing route-level authorization. It is not authorization to redesign flows, alter API contracts or move server rules into the browser.

## Accessibility and responsive requirements

- Maintain visible focus treatment, 44px-compatible touch targets where practical, semantic heading order and accessible names for icon-only controls.
- Decorative icons are hidden from assistive technology; icons that communicate state have equivalent text.
- Preserve light/dark contrast for gold selected pills, orange admin context, text buttons, disabled states, alert colors and progress indicators.
- Segmented navigation and filters can scroll horizontally on small screens without clipping the selected item.
- Tables reflow to labeled rows; actions remain reachable without hover.
- Do not rely on color alone for selected, warning, error, signup or capacity states.

## Verification and adoption

Before a page family is considered migrated, verify at desktop and narrow-mobile widths in light and dark themes:

- hierarchy, title/action placement, pills, card/table/form anatomy and icon size;
- keyboard navigation, visible focus and screen-reader labels;
- loading, empty, error, disabled and destructive-confirmation states;
- no changes to routes, permissions, signup semantics, provider data semantics or privacy boundaries.

Adopt in this order: shared shell/navigation and `PageHeader`; attendee browse/detail; admin event and user directories; profile/onboarding/forms; usage and policy pages. Add visual regression coverage for each shared component so new pages inherit the standard rather than duplicating styles.
