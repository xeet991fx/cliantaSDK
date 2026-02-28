# Changelog

All notable changes to the Clianta SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
