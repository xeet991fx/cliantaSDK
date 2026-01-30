# @clianta/sdk

Professional CRM and tracking SDK for Clianta - Track visitors, manage contacts, opportunities, and analyze user behavior.

## Features

### Tracking & Analytics
- **Page Views** - Automatic page view tracking with SPA support
- **Form Tracking** - Auto-detect and track form interactions
- **Scroll Depth** - Track scroll milestones (25%, 50%, 75%, 100%)
- **Click Tracking** - Track button and CTA clicks
- **User Engagement** - Detect active user engagement
- **File Downloads** - Track file downloads
- **Exit Intent** - Detect when users are about to leave
- **Error Tracking** - Capture JavaScript errors (optional)
- **Performance** - Web Vitals and page speed metrics (optional)
- **Auto-Identify** - Automatically identify leads from form submissions
- **Offline Support** - Queue events when offline, send when back

### CRM API Client
- **Contacts Management** - Full CRUD operations for contacts
- **Opportunities Management** - Create, update, and track sales opportunities
- **Authenticated Requests** - Secure API access with token authentication
- **Type-Safe** - Full TypeScript support for all CRM operations

### Developer Experience
- **Debug Mode** - Verbose logging for troubleshooting
- **TypeScript Support** - Full type definitions included
- **Multiple Formats** - UMD, ESM, and CJS builds
- **Tree-Shakeable** - Import only what you need
- **Zero Dependencies** - Lightweight and fast

## Installation

### NPM

```bash
npm install @clianta/sdk
```

### Script Tag (CDN)

```html
<script src="https://unpkg.com/@clianta/sdk@1.0.0/dist/clianta.umd.min.js"></script>
<script>
  const tracker = Clianta.clianta('YOUR_WORKSPACE_ID');
</script>
```

## Quick Start

### Tracking

```javascript
import { clianta } from '@clianta/sdk';

// Initialize tracker
const tracker = clianta('YOUR_WORKSPACE_ID', {
  debug: true,
  apiEndpoint: 'https://api.clianta.online'
});

// Track custom event
tracker.track('custom', 'Button Clicked', {
  buttonId: 'signup-cta',
  location: 'hero-section',
});

// Identify a visitor
tracker.identify('john@example.com', {
  firstName: 'John',
  lastName: 'Doe',
  company: 'Acme Inc',
});

// Manual page view (automatic by default)
tracker.page('Pricing Page', {
  plan: 'enterprise',
});
```

### CRM API

```javascript
import { CRMClient } from '@clianta/sdk';

// Initialize CRM client
const crm = new CRMClient(
  'https://api.clianta.online',
  'YOUR_WORKSPACE_ID',
  'YOUR_AUTH_TOKEN'
);

// Get all contacts
const contacts = await crm.getContacts({
  page: 1,
  limit: 50,
  status: 'lead'
});

// Create a new contact
const newContact = await crm.createContact({
  email: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Smith',
  company: 'Tech Corp'
});

// Create an opportunity
const opportunity = await crm.createOpportunity({
  contactId: newContact.data._id,
  pipelineId: 'pipeline-id',
  stageId: 'stage-id',
  title: 'Enterprise Deal',
  value: 50000,
  currency: 'USD'
});

// Update opportunity stage
await crm.moveOpportunity(opportunity.data._id, 'new-stage-id');
```

## Configuration

```typescript
const tracker = clianta('YOUR_WORKSPACE_ID', {
  // Backend API URL (auto-detected by default)
  apiEndpoint: 'https://api.clianta.online',

  // Enable debug logging
  debug: false,

  // Auto-track page views
  autoPageView: true,

  // Plugins to enable (default: all core plugins)
  plugins: [
    'pageView',
    'forms',
    'scroll',
    'clicks',
    'engagement',
    'downloads',
    'exitIntent',
    // Optional:
    // 'errors',
    // 'performance',
  ],

  // Session timeout (default: 30 minutes)
  sessionTimeout: 30 * 60 * 1000,

  // Batch size before sending (default: 10)
  batchSize: 10,

  // Flush interval in ms (default: 5000)
  flushInterval: 5000,
});
```

## API Reference

### Tracker Methods

#### `tracker.track(eventType, eventName, properties?)`
Track a custom event.

#### `tracker.identify(email, traits?)`
Identify a visitor and link to a contact.

#### `tracker.page(name?, properties?)`
Track a page view (automatic by default).

#### `tracker.debug(enabled)`
Enable or disable debug mode.

#### `tracker.getVisitorId()`
Get the current visitor ID.

#### `tracker.getSessionId()`
Get the current session ID.

#### `tracker.flush()`
Force send all queued events.

#### `tracker.reset()`
Reset visitor data (call on logout).

### CRM Client Methods

#### Contacts
- `getContacts(params?)` - Get all contacts with pagination
- `getContact(contactId)` - Get a single contact
- `createContact(contact)` - Create a new contact
- `updateContact(contactId, updates)` - Update a contact
- `deleteContact(contactId)` - Delete a contact

#### Opportunities
- `getOpportunities(params?)` - Get all opportunities with pagination
- `getOpportunity(opportunityId)` - Get a single opportunity
- `createOpportunity(opportunity)` - Create a new opportunity
- `updateOpportunity(opportunityId, updates)` - Update an opportunity
- `deleteOpportunity(opportunityId)` - Delete an opportunity
- `moveOpportunity(opportunityId, stageId)` - Move opportunity to a different stage

## Framework Integration

### React

```tsx
import { useEffect } from 'react';
import { clianta } from '@clianta/sdk';

function App() {
  useEffect(() => {
    const tracker = clianta('YOUR_WORKSPACE_ID', {
      debug: process.env.NODE_ENV === 'development'
    });

    return () => {
      tracker.flush();
    };
  }, []);

  return <div>Your App</div>;
}
```

### Next.js

```tsx
// app/layout.tsx or pages/_app.tsx
import { clianta } from '@clianta/sdk';

if (typeof window !== 'undefined') {
  clianta('YOUR_WORKSPACE_ID');
}
```

### Vue.js

```vue
<script setup>
import { onMounted, onUnmounted } from 'vue';
import { clianta } from '@clianta/sdk';

let tracker;

onMounted(() => {
  tracker = clianta('YOUR_WORKSPACE_ID');
});

onUnmounted(() => {
  tracker?.flush();
});
</script>
```

## TypeScript Support

The SDK is written in TypeScript and includes full type definitions:

```typescript
import type { 
  TrackerCore, 
  Contact, 
  Opportunity,
  ApiResponse 
} from '@clianta/sdk';

const tracker: TrackerCore = clianta('workspace-id');

const response: ApiResponse<Contact> = await crm.getContact('contact-id');
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run build:watch

# Run tests
npm test

# Type check
npm run typecheck
```

## License

MIT © Clianta

## Support

- Documentation: https://docs.clianta.online
- Issues: https://github.com/xeet991fx/cliantaSDK/issues
- Website: https://clianta.online
