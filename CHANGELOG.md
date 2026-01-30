# Changelog

All notable changes to the Clianta SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
