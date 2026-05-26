# Changelog

All notable changes to the Clianta SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.8.0] - 2026-05-26

This release is a **data-quality** release. After running the SDK on our own
website for ~30 days we found multiple sources of misleading, wrong, or
missing tracking data. Every fix below addresses one of those root causes.

### The promise this release ships

Drop the SDK into your app — three steps, zero code changes elsewhere:

1. `npm install @clianta/sdk@1.8.0`
2. Add the env vars (`NEXT_PUBLIC_CLIANTA_PROJECT_ID`, `NEXT_PUBLIC_CLIANTA_API_ENDPOINT`).
3. Wrap your root layout with `<CliantaProvider>` (or the equivalent for
   your framework).

That's it. Page views, scrolls, clicks, engagement, performance, downloads,
exit-intent, forms, **logins, logouts, the user's company / account /
tenant association, and rich profile traits (avatar, role, plan, locale,
plus any custom JWT claim)** are all auto-tracked. You do not need to
call `tracker.identify()` from your auth code, call `tracker.group()` for
B2B account tracking, dispatch any events, or write a single line of
tracking glue.

### Auto-everything: identify, group, traits, logout

The 1.7.x line could only auto-detect logins. 1.8.0 promotes the rest of
the SDK's CRM surface to "automatic":

- **Auto-group / auto-company** (`autoGroupMode: 'auto'` by default) —
  the SDK figures out which company / tenant / workspace / account a
  user belongs to from the same JWT it identified them with, and calls
  `tracker.group()` on your behalf. Sources tried in order:
  1. JWT claims: `org_id`, `organization_id`, `tenant_id`, `workspace_id`,
     `account_id`, `company_id` (with the matching `*_name` fields when
     present).
  2. Provider-specific shapes: Clerk's
     `Clerk.user.organizationMemberships[0].organization` (id / name /
     slug), Cognito's `custom:organization_id` user attributes,
     MSAL's `account.tenantId`, Auth0's user object, Keycloak's
     `tokenParsed`.
  3. `window.__clianta_group = { id, name?, traits? }` global escape
     hatch.
  4. `clianta:group` window event hook (`new CustomEvent('clianta:group',
     { detail: { id, name, traits } })`).
  5. **Email-domain fallback** — derive the company from the email
     domain (`ada@acme.com` → company `acme.com`), with a built-in
     blocklist of personal-email domains (gmail / yahoo / outlook /
     icloud / proton / etc.) so individual Gmail users don't end up in
     their own one-person company.

  Modes: `'auto'` (default) | `'jwt'` (no email-domain fallback) |
  `'domain'` (email-domain only) | `'off'`.

- **Sticky group cache** — the resolved group is cached in
  localStorage (`clianta_grp_id`, `clianta_grp_name`) so the next page
  load re-emits the group without waiting for a fresh JWT scan, and
  cleared automatically on logout.

- **Rich auto-traits.** The auto-identify scan now lifts the following
  out of any JWT or provider object and passes them to the CRM contact:
  - `avatar` — from `picture`, `avatar`, `avatar_url`, `image`,
    `imageUrl`, `profile_picture`. Clerk's `imageUrl` is also picked up.
  - `role` — from `role` / `roles` (string or array).
  - `plan` — from `plan` / `tier` / `subscription_tier`.
  - `locale` — from `locale` / `language` / `lang`.
  - **`customFields.*`** — anything else in the JWT that's a primitive
    or primitive array (e.g. `team_id`, `signup_source`, `is_admin`,
    `seat_count`) is preserved on the contact's `customFields`. Nested
    provider state is deliberately skipped so we don't pollute the CRM.

  The backend `/api/public/track/identify` route was extended to map
  these to the existing `Contact` columns (avatar / role / plan /
  locale → top-level fields where they exist, everything else under
  `customFields`).

- **`tracker.reset()` clears `groupId`** — previously it cleared
  `contactId` but kept the group, so a logout/login on the same browser
  mis-attributed the new user to the old company.

### Auto-identify: `'auto'` mode (default) with five safeguards

The whole point of auto-identify is the customer never has to wire it into
their login flow. The 1.7.x default deep-scanned cookies + storage for any
JWT or email-bearing JSON, which caught most logins but also produced
"wrong contact" identifications when an Intercom / FullStory / HubSpot
widget left an email in storage. The new `'auto'` default keeps the wide
coverage but adds five safeguards that close the false-positive holes:

1. **JWT freshness** — only use tokens whose `exp` is in the future and
   whose `iat` is within the last 30 days. Stale leftover tokens get
   ignored.
2. **Third-party SDK blocklist** — explicitly skip storage keys belonging
   to Intercom, FullStory, HubSpot, Drift, Segment, Pendo, Userpilot,
   Mixpanel, Amplitude, Heap, Hotjar, LogRocket, Optimizely, LaunchDarkly,
   etc. Cuts out the main false-positive vector.
3. **Domain-match preference** — when multiple email candidates are found,
   prefer the one whose domain matches the page's hostname (`+15` score
   bonus). `ada@acme.com` wins over `agent@intercom.io` on `acme.com`.
4. **Sticky identification** — once identified, cache the email in
   `localStorage` (`clianta_idm`). On the next load, prefer the cached
   email until storage proves it has changed. No flapping between
   candidates.
5. **Auto-logout** — listen for `storage` events that clear an
   auth-shaped key. When detected, fire `tracker.reset()` automatically
   so the next user on the same browser is correctly anonymous, and
   dispatch a `clianta:logout` window event other code can listen for.

The new `autoIdentifyMode` config has four values:
- `'auto'` (default) — providers + JWT-only cookie/storage scan + the
  five safeguards above.
- `'providers'` — providers only. Zero false positives, lower coverage.
- `'aggressive'` — `'auto'` PLUS plain-JSON deep scan (the old < 1.8.0
  default). Use only when your app stores the user object as plain JSON
  without a JWT.
- `'off'` — disables auto-identify completely.

### Added

- **`autoIdentifyMode` config option** — see above.
- **`clianta:identify` window event** — universal manual hook for any auth
  system the SDK doesn't auto-detect:
  ```ts
  window.dispatchEvent(new CustomEvent('clianta:identify', {
    detail: { email: 'user@example.com', firstName: 'Ada', lastName: 'Lovelace' },
  }));
  ```
- **`clianta:logout` window event** — emitted by the SDK when auto-logout
  fires; can also be dispatched by app code to manually clear identity.
- **`SPA Navigation` performance event** — emits on each
  `clianta:navigation` so SPA route changes are no longer invisible to
  perf dashboards.
- **`shortPage: true` flag on scroll milestones** — pages whose content
  fits in the viewport now emit all four 25/50/75/100 milestones once,
  instead of being treated as a 0%-scroll bounce.
- **Stealth transport fallback** — when the primary tracking endpoint
  returns a `TypeError` / `NetworkError` while `navigator.onLine` is true
  (the typical signature of uBlock Origin / EasyPrivacy / Brave Shields
  blocking it), the SDK transparently falls back to
  `/cdn/fonts/woff2.json` (events) and `/cdn/assets/manifest.json`
  (identify). Once a transport instance has detected blocking it sticks to
  the stealth path for the rest of the session, so latency stays flat.
- **`vue` available as a devDependency** so `tsc --noEmit` is now clean.
  At runtime `vue` is still treated as an external peer (you bring your
  own).

### Behaviour changes

- **Page-view event name now reflects the actual page.** The auto pageView
  plugin previously used the hardcoded string `'Page Viewed'` for every
  page, so analytics dashboards grouped every URL together. The event name
  now defaults to `document.title` (or pathname). The `track('page_view',
  ...)` event type is unchanged. `Tracker.page()` follows the same rule.
- **`User Engaged` and `time_on_page` are now once-per-page-lifecycle.**
  The old plugin re-armed `User Engaged` after 30 s of inactivity and
  re-emitted `time_on_page` on every visibility transition, inflating
  engagement metrics. New contract:
  - `User Engaged` fires at most once per page (resets on SPA navigation).
  - `time_on_page` fires at most once per page on `beforeunload` /
    `pagehide` / SPA navigation, reporting the **cumulative** visible time
    across tab-switches. `visibility:hidden` only pauses the timer now.

### Fixed

- **Auto-identify polling extended to ~30 minutes** — old schedule
  stopped after ~4 minutes, so OAuth round-trips longer than that never
  identified the user. New schedule: exponential backoff for the first
  ~5 min, then a 5-minute long-tail.
- **Scroll plugin: 100% milestone is now reachable.** Switched from
  `Math.floor` to `Math.round` so a scroll percent that rounds to 99.5+ or
  99.6 (caused by fractional pixels and browser zoom) finally trips the
  100% milestone.
- **LCP / CLS reported once.** Pre-fix the plugin emitted multiple LCP
  events (one per observer drain) and re-armed CLS on every visibility
  cycle. Now both report at most once per page lifecycle on
  visibility:hidden / pagehide / SPA navigation.
- **Performance plugin is SPA-aware.** Web Vitals observers re-arm on
  `clianta:navigation`, so SPA routes are no longer invisible to perf
  dashboards.
- **Page-view referrer.** Removed the `properties.referrer = 'direct'`
  default; the canonical referrer now lives only at top-level
  `event.referrer` so dashboards have one source of truth.
- **`Tracker.page()` and the auto pageView plugin emit the same event
  name**, so manual and auto-tracked page views are no longer
  distinguishable only by their format.

### Internal / dev

- 14 new tests for the safeguards: JWT freshness rejection (expired exp +
  stale iat), third-party SDK blocklist (Intercom / FullStory / HubSpot),
  domain-match preference, sticky identification (restore + persist),
  auto-logout on storage clear (including third-party-key ignore).
- 302 tests across 21 files, all green.
- Queue tests now clear both `localStorage` AND `sessionStorage` between
  cases so retried-flush persists from a prior test can't bleed into the
  next.

### Server-side companion changes (not in the SDK package)

The SDK is paired with backend changes in the same release that you'll
want to roll out together for the data-quality fixes to land end-to-end:

- `POST /api/public/track/identify` rebinds `Visitor.contactId` when the
  same `visitorId` re-identifies as a different contact, and now `$set`s
  any provided traits on the existing contact (was `$setOnInsert` only).
- `POST /api/public/track/alias` is implemented (was previously a 404 the
  SDK called silently).
- `TrackingEvent` has a new sparse compound unique index on
  `(workspaceId, properties.eventId)`. `insertMany` handlers tolerate
  E11000 duplicates so SDK retries / persisted-queue replays no longer
  inflate `pageViewCount` / `eventCount` or fire duplicate workflows.
- Stats / visitors endpoints now exclude bots from totals
  (`?includeBots=true` to override on the visitors list).
- Tightened the bot UA regex with word boundaries so browsers like
  `Cubot` / `Robotouch` are no longer flagged.
- `extractUTMParams` middleware now reads top-level `utmSource` etc.
  (the shape the SDK has actually been sending), with snake-case
  fallbacks. UTM-based company attribution finally works.

## [1.6.0] - 2026-03-01

### Added
- **`group()` method** — Associate visitors with a company/account. The `groupId` is attached to all subsequent `track()` calls, enabling ABM (Account-Based Marketing) use cases
- **`alias()` method** — Merge two visitor identities (e.g., anonymous visitor → logged-in user). Supports cross-device identity resolution
- **`screen()` method** — Track screen views for mobile-first PWAs and SPAs. Semantic equivalent of `page()` for app screens
- **Event middleware API** — `use((event, next) => { ... })` to intercept, transform, or drop events before they're sent. Supports chaining multiple middleware functions
- **`onReady()` callback** — Register callbacks that fire when the SDK is fully initialized. If already ready, fires immediately
- **`isReady()` method** — Check initialization state synchronously
- **React `ErrorBoundary`** — `CliantaProvider` now wraps children in an ErrorBoundary to prevent SDK errors from crashing the host application
- **React `useCliantaReady()` hook** — Returns `{ isReady, tracker }` for components that need to wait for initialization
- **React `onError` prop** — `CliantaProvider` accepts an `onError` callback for custom error handling
- **New types** — `GroupTraits`, `MiddlewareFn` exported from main SDK entry

### Changed
- `TrackerCore` interface expanded with `group()`, `alias()`, `screen()`, `use()`, `onReady()`, `isReady()` methods
- React `CliantaContext` now provides `{ tracker, isReady }` instead of just `tracker`
- `track()` now runs events through the middleware pipeline before queueing
- Events include `groupId` field when visitor is associated with a group

## [1.5.1] - 2026-02-28

### Added
- **Public CRM API** — Frontend-safe CRM methods that don't require an API key (secured by domain whitelist):
  - `createContact()` — Create or upsert a contact by email
  - `updateContact()` — Update an existing contact by ID
  - `submitForm()` — Submit a form and auto-create/update contact
  - `logActivity()` — Append an activity to a contact
  - `createOpportunity()` — Create an opportunity (e.g., from "Request Demo" forms)
- **Public CRM types** — `PublicContactData`, `PublicContactUpdate`, `PublicFormSubmission`, `PublicActivityData`, `PublicOpportunityData`, `PublicCrmResult`
- **Updated docs** — API Reference and Getting Started guides updated with public CRM usage

### Changed
- Config: improved `getDefaultApiEndpoint()` with env variable support
- Framework integrations: minor fixes for Angular, Svelte, Vue, React

## [1.5.0] - 2026-02-28

### Security
- **Cookie `Secure` flag** — Cookies now include `; Secure` on HTTPS connections, preventing visitor IDs from leaking over plaintext
- **Open redirect prevention** — `redirectUrl` in popup forms is validated before navigation; blocks `javascript:`, `data:`, and other dangerous protocols
- **API key browser warning** — Console warning when `apiKey` is used in client-side code (should be server-side only)
- **HTTPS endpoint warning** — Console warning when `apiEndpoint` uses HTTP in production
- **Email validation** — `identify()` validates email format before sending to server
- **Queue moved to sessionStorage** — Event queue no longer persists in localStorage by default (configurable via `persistMode`)
- **innerHTML → textContent** — Popup form submit button uses safe DOM API

### Fixed
- **CRITICAL: Double `history.pushState` patching** — ScrollPlugin and PageViewPlugin were both monkey-patching the History API independently, causing double page view events on SPA navigation. ScrollPlugin now listens for a `clianta:navigation` custom event instead
- **CRITICAL: React `useEffect` re-initialization** — `CliantaProvider` was destroying and recreating the tracker on every render when config was defined inline (object ref changed). Now depends on `config.projectId` (stable string)
- **React context null on first render** — Switched from `useRef` to `useState` for tracker instance so context re-renders when ready
- **PopupForms cleanup** — Delay timers and click trigger listeners are now properly tracked and cleaned up on `destroy()`
- **`reset()` cleanup** — Now clears `contactId` and `pendingIdentify` alongside visitor/session IDs

### Added
- **Visitor APIs** — `getVisitorProfile()`, `getVisitorActivity()`, `getVisitorTimeline()`, `getVisitorEngagement()` for fetching visitor data from the CRM
- **Event schema validation** — `registerEventSchema()` validates event properties in debug mode
- **`persistMode` config** — Choose `'session'` (default), `'local'` (cross-session), or `'none'` for queue persistence
- **`websiteDomain` property** — Automatically included on all tracked events
- **Angular integration** — `@clianta/sdk/angular` module
- **Svelte integration** — `@clianta/sdk/svelte` module

### Changed
- `CliantaProvider` uses `useState` instead of `useRef` for tracker instance
- Queue persistence defaults to `sessionStorage` (was `localStorage`)

## [1.4.0] - 2026-02-27

### Fixed
- **CRITICAL: contactId propagation** - `identify()` now stores the returned `contactId` and attaches it to every subsequent `track()` call. Previously, all events remained anonymous after identification.
- **CRITICAL: identify() return type** - `identify()` now returns `Promise<string | null>` (the contactId) instead of `Promise<void>`, so callers can use the contactId immediately.
- **Transport: contactId extraction** - `sendIdentify()` now parses the server response body and returns `contactId` in `TransportResult`.
- **Event deduplication** - Every tracked event now includes a unique `eventId` UUID in properties. Prevents duplicate events when events are retried after network timeouts or restored from localStorage on page reload.

### Added
- **`sendEvent()` method on Tracker** - Convenience proxy to `CRMClient.sendEvent()` for server-side inbound events. Requires `apiKey` in the SDK config. No need to instantiate a separate `CRMClient`.
- **`contactId` field on TransportResult** - TypeScript type updated.
- **`sendEvent()` on TrackerCore interface** - Full TypeScript support.

### Changed
- `TrackerCore.identify()` signature: `Promise<void>` → `Promise<string | null>`

## [1.3.0] - 2026-02-17

### Added
- **ContactUpdateAction Type** - New trigger action type for automatically updating contact fields when triggers fire
  - Supports partial contact updates via `updates: Partial<Contact>`
- **TriggerExecution Interface** - Full execution tracking for event triggers
  - Fields: `triggerId`, `eventType`, `entityId`, `status`, `error`, `actionsExecuted`, `executedAt`
  - Status tracking: `pending`, `success`, `failed`
- **deleteEventTrigger()** - New CRM client method to delete event triggers by ID
  - `crm.deleteEventTrigger(triggerId)` - removes a trigger from the workspace
- **Vue Type Augmentation** - Added `ComponentCustomProperties` declaration for `$clianta` global property
  - Enables type-safe access to tracker via Options API in Vue components
- **Export: ContactUpdateAction** - Now exported from main SDK entry point

### Changed
- `TriggerAction` union type now includes `ContactUpdateAction` alongside `EmailAction`, `WebhookAction`, and `TaskAction`

## [1.2.0] - 2026-02-02

### Added
- **Companies API** - Full CRUD operations for company management
  - `getCompanies()`, `getCompany()`, `createCompany()`, `updateCompany()`, `deleteCompany()`
  - `getCompanyContacts()` - Retrieve all contacts associated with a company
  - `getCompanyDeals()` - Retrieve all deals associated with a company
- **Pipelines API** - Manage sales pipelines and stages
  - `getPipelines()`, `getPipeline()`, `createPipeline()`, `updatePipeline()`, `deletePipeline()`
- **Tasks API** - Task management for CRM workflows
  - `getTasks()`, `getTask()`, `createTask()`, `updateTask()`, `deleteTask()`
  - `completeTask()` - Mark a task as completed
- **Activities API** - Full activity logging system
  - `getContactActivities()`, `getOpportunityActivities()`
  - `createActivity()`, `updateActivity()`, `deleteActivity()`
  - `logCall()` - Quick helper for logging phone calls
  - `logMeeting()` - Quick helper for logging meetings
  - `addNote()` - Quick helper for adding notes to contacts/opportunities
- **New TypeScript Types** - Added `Company`, `Pipeline`, `PipelineStage`, `Task`, `Activity` interfaces
- **26 new unit tests** for CRM API methods (76 total tests)

## [1.1.1] - 2026-02-01

### Fixed
- **Security:** Fixed XSS vulnerability in PopupForms plugin - now uses safe DOM APIs instead of innerHTML
- **Memory Leak:** Fixed PageViewPlugin not cleaning up History API patches and popstate listeners on destroy
- **Memory Leak:** Added max buffer size (100 events) to consent manager to prevent unbounded memory growth
- **Race Condition:** Fixed potential race condition in queue flush when events pushed during flush
- **Divide by Zero:** Fixed scroll depth plugin crash on pages shorter than viewport

### Changed
- Performance plugin now uses modern `PerformanceNavigationTiming` API with fallback for older browsers
- Plugin interface now supports async `init()` methods
- Tracker `destroy()` method is now async and properly awaits queue flush

### Added
- Client-side rate limiting (100 events per minute) to prevent event flooding
- Unit test suite with 50+ tests covering core modules (queue, transport, consent, utils)

## [1.1.0] - 2026-01-31

### Added
- PopupForms plugin for lead capture popups with multiple trigger types (delay, scroll, exit intent, click)
- React integration with `CliantaProvider`, `useClianta()`, and `useCliantaTrack()` hooks
- GDPR right-to-erasure via `deleteData()` method
- Anonymous tracking mode for pre-consent data collection
- Event buffering when `waitForConsent` is enabled

### Changed
- Updated SDK_VERSION constant to track version properly
- Improved TypeScript type exports

## [1.0.0] - 2026-01-30

### Added
- Initial release of Clianta SDK
- **Tracking & Analytics**
  - Automatic page view tracking with SPA support
  - Form tracking with auto-identification
  - Scroll depth tracking (25%, 50%, 75%, 100%)
  - Click tracking for buttons and CTAs
  - User engagement detection
  - File download tracking
  - Exit intent detection
  - JavaScript error tracking (optional plugin)
  - Web Vitals and performance metrics (optional plugin)
  - Offline event queue with automatic retry
  - Event batching for efficient transmission
  
- **CRM API Client**
  - Full CRUD operations for contacts
  - Full CRUD operations for opportunities
  - Opportunity stage management
  - Authenticated API requests with token support
  - Paginated list queries
  - Type-safe API responses
  
- **Developer Experience**
  - Full TypeScript support with type definitions
  - Multiple build formats (UMD, ESM, CJS)
  - Debug mode with verbose logging
  - Plugin-based architecture
  - Tree-shakeable exports
  - Zero runtime dependencies
  
- **Privacy & Compliance**
  - Consent management system
  - Cookie-less tracking option
  - Visitor ID persistence across sessions
  - Session management with configurable timeout

### Technical Details
- SDK Version: 1.0.0
- Build Formats: UMD (minified & unminified), ESM, CJS
- TypeScript: Full type definitions included
- Bundle Size: ~8KB gzipped (tracking only), ~12KB with CRM client
- Browser Support: Modern browsers (ES2015+)
- Node.js: 18.0.0+

## [Unreleased]

### Planned Features
- Workflow automation helpers
- Email campaign integration
- Advanced analytics and reporting
- Real-time notifications
- Webhook management
- Custom event validation
- A/B testing support

---

## Migration Guide

### From MorrisB SDK v3.x

The Clianta SDK is a complete rebrand and enhancement of the MorrisB Tracking SDK.

**Breaking Changes:**
1. Package name changed from `@morrisb/tracker` to `@clianta/sdk`
2. Global variable changed from `MorrisB` to `Clianta`
3. Initialization function changed from `morrisb()` to `clianta()`
4. Default API endpoint changed to `https://api.clianta.online`

**Migration Steps:**

```diff
- import { morrisb } from '@morrisb/tracker';
+ import { clianta } from '@clianta/sdk';

- const tracker = morrisb('workspace-id');
+ const tracker = clianta('workspace-id');
```

**New Features:**
- CRM API client for managing contacts and opportunities
- Enhanced TypeScript support
- Improved error handling
- Better offline support

All tracking features remain compatible with the previous version.
