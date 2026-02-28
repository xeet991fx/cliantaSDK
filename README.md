# Clianta SDK

Professional CRM and tracking SDK for lead generation with **automated email triggers** and workflows. Works with any website or JavaScript framework.

## ✨ Key Features

- 📊 **Visitor & Event Tracking** - Track page views, clicks, forms, and custom events
- 👥 **CRM Management** - Contacts, companies, opportunities, tasks, and activities
- 🤖 **Event Triggers & Automation** - Automated emails, tasks, and webhooks (like Salesforce & HubSpot)
- 📧 **Email Notifications** - Send automated emails based on CRM actions
- 🔒 **GDPR Compliant** - Built-in consent management
- 🔍 **Read-Back APIs** - Fetch visitor profiles, activity, timeline, and engagement metrics
- ⚡ **Framework Support** - React, Vue, Angular, Svelte, Next.js, or vanilla JavaScript

## Installation

### NPM / Yarn (React, Next.js, Vue)

```bash
npm install @clianta/sdk
# or
yarn add @clianta/sdk
```

### Script Tag (HTML, WordPress, Webflow)

```html
<script src="https://cdn.clianta.online/sdk/v1/clianta.min.js"></script>
```

---

## Quick Start

### Script Tag (Any Website)

```html
<!-- Add before </head> -->
<script src="https://cdn.clianta.online/sdk/v1/clianta.min.js"></script>
<script>
  clianta('YOUR_WORKSPACE_ID', {
    apiEndpoint: 'https://api.clianta.online'
  });
</script>
```

### NPM Module

```typescript
import { clianta } from '@clianta/sdk';

const tracker = clianta('YOUR_WORKSPACE_ID', {
  apiEndpoint: 'https://api.clianta.online',
  debug: true,
});

// Track events
tracker.track('button_click', 'Signup Button', { location: 'hero' });

// Identify users
tracker.identify('user@example.com', { firstName: 'John' });
```

---

## Framework Guides

### Next.js (App Router)

Create a provider component:

```tsx
// components/CliantaProvider.tsx
'use client';

import { useEffect } from 'react';
import { clianta } from '@clianta/sdk';

export function CliantaProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const tracker = clianta(process.env.NEXT_PUBLIC_WORKSPACE_ID!, {
      apiEndpoint: process.env.NEXT_PUBLIC_API_ENDPOINT,
      debug: process.env.NODE_ENV === 'development',
    });

    return () => { tracker.flush(); };
  }, []);

  return <>{children}</>;
}
```

Use in your layout:

```tsx
// app/layout.tsx
import { CliantaProvider } from '@/components/CliantaProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CliantaProvider>{children}</CliantaProvider>
      </body>
    </html>
  );
}
```

Environment variables (`.env.local`):

```bash
NEXT_PUBLIC_WORKSPACE_ID=your-workspace-id
NEXT_PUBLIC_API_ENDPOINT=https://api.clianta.online
```

---

### React (Vite / CRA)

```tsx
// App.tsx
import { useEffect } from 'react';
import { clianta } from '@clianta/sdk';

function App() {
  useEffect(() => {
    const tracker = clianta(import.meta.env.VITE_WORKSPACE_ID, {
      apiEndpoint: import.meta.env.VITE_API_ENDPOINT,
    });

    return () => { tracker.flush(); };
  }, []);

  return <div>Your App</div>;
}
```

Track events in components:

```tsx
import { clianta } from '@clianta/sdk';

function SignupButton() {
  const handleClick = () => {
    const tracker = clianta(import.meta.env.VITE_WORKSPACE_ID);
    tracker.track('button_click', 'Signup CTA', { location: 'navbar' });
  };

  return <button onClick={handleClick}>Sign Up</button>;
}
```

---

### Vue.js

```typescript
// plugins/clianta.ts
import { clianta } from '@clianta/sdk';

export default {
  install(app: any) {
    const tracker = clianta(import.meta.env.VITE_WORKSPACE_ID, {
      apiEndpoint: import.meta.env.VITE_API_ENDPOINT,
    });

    app.config.globalProperties.$clianta = tracker;
    app.provide('clianta', tracker);
  }
};
```

```vue
<script setup>
import { inject } from 'vue';
const tracker = inject('clianta');

const trackClick = () => {
  tracker.track('button_click', 'CTA Clicked');
};
</script>
```

---

### Plain HTML / WordPress / Webflow

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Website</title>
  
  <!-- Clianta SDK -->
  <script src="https://cdn.clianta.online/sdk/v1/clianta.min.js"></script>
  <script>
    var tracker = clianta('YOUR_WORKSPACE_ID', {
      apiEndpoint: 'https://api.clianta.online'
    });
  </script>
</head>
<body>
  <button onclick="tracker.track('button_click', 'CTA Clicked')">
    Click Me
  </button>
</body>
</html>
```

**WordPress**: Add to `Appearance > Theme Editor > header.php` before `</head>`

**Webflow**: Add to `Project Settings > Custom Code > Head Code`

**Shopify**: Add to `Online Store > Themes > Edit Code > theme.liquid`

---

## Configuration

```typescript
const tracker = clianta('WORKSPACE_ID', {
  // API endpoint (required for self-hosted)
  apiEndpoint: 'https://api.clianta.online',
  
  // Debug mode (console logging)
  debug: false,
  
  // Auto track page views
  autoPageView: true,
  
  // Plugins to enable
  plugins: [
    'pageView',    // Page views with SPA support
    'forms',       // Auto-detect forms
    'scroll',      // Scroll depth tracking
    'clicks',      // Button/CTA clicks
    'engagement',  // User engagement
    'downloads',   // File downloads
    'exitIntent',  // Exit intent detection
    'errors',      // JavaScript errors (optional)
    'performance', // Web Vitals (optional)
  ],
  
  // Session timeout (30 min default)
  sessionTimeout: 30 * 60 * 1000,
  
  // Events per batch
  batchSize: 10,
  
  // Flush interval (ms)
  flushInterval: 5000,
  
  // GDPR Consent Configuration
  consent: {
    waitForConsent: true,   // Buffer events until consent
    anonymousMode: true,    // Use anonymous ID until consent
  },
  
  // Cookie-less mode (GDPR friendly)
  cookielessMode: false,
});
```

---

## API Reference

### `tracker.track(eventType, eventName, properties?)`

Track custom events:

```typescript
tracker.track('button_click', 'Add to Cart', {
  productId: '123',
  price: 29.99,
});
```

### `tracker.identify(email, traits?)`

Identify a visitor:

```typescript
tracker.identify('john@example.com', {
  firstName: 'John',
  lastName: 'Doe',
  company: 'Acme Inc',
  phone: '+1234567890',
});
```

### `tracker.page(name?, properties?)`

Track page views manually:

```typescript
tracker.page('Pricing Page', { plan: 'enterprise' });
```

### `tracker.consent(state)`

Update consent state (GDPR):

```typescript
tracker.consent({
  analytics: true,
  marketing: false,
  personalization: true,
});
```

### `tracker.getConsentState()`

Get current consent:

```typescript
const state = tracker.getConsentState();
// { analytics: true, marketing: false, personalization: false }
```

### `tracker.deleteData()`

Delete all stored data (GDPR right-to-erasure):

```typescript
tracker.deleteData();
```

### `tracker.debug(enabled)`

Toggle debug mode:

```typescript
tracker.debug(true); // Enable console logging
```

### `tracker.getVisitorId()` / `tracker.getSessionId()`

Get current IDs:

```typescript
const visitorId = tracker.getVisitorId();
const sessionId = tracker.getSessionId();
```

### `tracker.flush()`

Force send queued events:

```typescript
await tracker.flush();
```

### `tracker.reset()`

Reset visitor (for logout):

```typescript
tracker.reset();
```

---

## Read-Back APIs

### Frontend (Own Visitor Data)

Fetch the current visitor's data directly from the SDK:

```typescript
// Get visitor's CRM profile
const profile = await tracker.getVisitorProfile();
console.log(profile?.firstName, profile?.email, profile?.leadScore);

// Get recent activity (paginated)
const activity = await tracker.getVisitorActivity({ limit: 20 });
activity?.data.forEach(event => {
  console.log(event.eventType, event.eventName, event.timestamp);
});

// Get visitor journey timeline
const timeline = await tracker.getVisitorTimeline();
console.log('Total sessions:', timeline?.totalSessions);
console.log('Time on site:', timeline?.totalTimeSpentSeconds, 'sec');

// Get engagement metrics
const engagement = await tracker.getVisitorEngagement();
console.log('Score:', engagement?.engagementScore);
```

### Server-Side (Full CRM Access via API Key)

```typescript
import { CRMClient } from '@clianta/sdk';

const crm = new CRMClient('https://api.clianta.online', 'workspace-id');
crm.setApiKey('mm_live_xxxxx');

// Look up contact by email
const contact = await crm.getContactByEmail('user@example.com');

// Get contact's activity history
const activity = await crm.getContactActivity(contact.data._id, { limit: 50 });

// Get engagement metrics
const engagement = await crm.getContactEngagement(contact.data._id);

// Search contacts
const results = await crm.searchContacts('john', { status: 'lead' });

// Manage webhooks
const webhooks = await crm.listWebhooks();
await crm.createWebhook({ url: 'https://example.com/hook', events: ['contact.created'] });
```

---

## GDPR Compliance

### Wait for Consent

Buffer all events until user grants consent:

```typescript
const tracker = clianta('WORKSPACE_ID', {
  consent: {
    waitForConsent: true,
  },
});

// Events are buffered...
tracker.track('page_view', 'Home');

// User accepts cookies
tracker.consent({ analytics: true });
// Buffered events are now sent
```

### Anonymous Mode

Track without persistent visitor ID until consent:

```typescript
const tracker = clianta('WORKSPACE_ID', {
  consent: {
    anonymousMode: true,
  },
});

// Uses temporary anon_xxx ID
tracker.track('page_view', 'Home');

// User accepts - upgrades to persistent ID
tracker.consent({ analytics: true });
```

### Cookie-less Mode

No persistent storage (session only):

```typescript
const tracker = clianta('WORKSPACE_ID', {
  cookielessMode: true,
});
// Visitor ID stored in sessionStorage only
```

### Data Deletion

Allow users to delete their data:

```typescript
function handleDeleteDataRequest() {
  tracker.deleteData();
  showConfirmation('Your data has been deleted');
}
```

---

## TypeScript

Full TypeScript support included:

```typescript
import {
  clianta,
  type TrackerCore,
  type MorrisBConfig,
  type ConsentState,
  type TrackingEvent,
} from '@clianta/sdk';
```

---

## Event Triggers & Automation

Automate your workflows with event-driven triggers. Send emails, create tasks, or call webhooks when specific actions occur.

### Quick Example

```typescript
import { CRMClient } from '@clianta/sdk';

const crm = new CRMClient(
  'https://api.clianta.online',
  'your-workspace-id',
  'your-auth-token'
);

// Send welcome email when a contact is created
await crm.createEventTrigger({
  name: 'Welcome Email',
  eventType: 'contact.created',
  actions: [
    {
      type: 'send_email',
      to: '{{contact.email}}',
      subject: 'Welcome to Our Platform!',
      body: 'Hello {{contact.firstName}}, welcome aboard!',
    }
  ],
  isActive: true,
});

// Create task when high-value opportunity is created
await crm.triggers.createTaskTrigger({
  name: 'Follow-up Task',
  eventType: 'opportunity.created',
  taskTitle: 'Call {{contact.firstName}} about {{opportunity.title}}',
  priority: 'high',
  dueDays: 1,
  conditions: [
    { field: 'value', operator: 'greater_than', value: 10000 }
  ],
});
```

### Supported Event Types

- **Contact Events**: `contact.created`, `contact.updated`, `contact.deleted`
- **Opportunity Events**: `opportunity.created`, `opportunity.won`, `opportunity.stage_changed`
- **Task Events**: `task.created`, `task.completed`, `task.overdue`
- **Activity Events**: `activity.logged`, `form.submitted`

### Action Types

1. **Send Email** - Automated email notifications with template variables
2. **Create Task** - Auto-create follow-up tasks
3. **Webhook** - Call external services (Slack, Zapier, etc.)
4. **Update Contact** - Automatically update contact fields

📚 **[Full Event Triggers Documentation](./docs/EVENT_TRIGGERS.md)**

---

## Self-Hosted

For self-hosted deployments, configure the API endpoint:

```typescript
const tracker = clianta('WORKSPACE_ID', {
  apiEndpoint: 'https://your-backend.com',
});
```

---

## Support

- Documentation: https://docs.clianta.online
- Issues: https://github.com/clianta/sdk/issues
- Email: support@clianta.online
