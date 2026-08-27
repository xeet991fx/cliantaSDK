# Eutexa SDK — API Reference

## Initialization

```typescript
import { eutexa } from 'eutexa-sdk';

const tracker = eutexa('your-project-id', {
  debug: true, // optional
});
```

Or with framework adapters (recommended):

```tsx
// React/Next.js
<EutexaProvider projectId="your-project-id">

// Vue
app.use(EutexaPlugin, { projectId: 'your-project-id' });

// Angular
createEutexaTracker({ projectId: '...', apiEndpoint: '...' });

// Svelte
initEutexa({ projectId: '...', apiEndpoint: '...' });
```

---

## Visitor Intelligence

### `tracker.track(eventType, eventName, properties?)`

Track a custom event.

| Param | Type | Description |
|-------|------|-------------|
| eventType | `string` | Event category (e.g., `'button_click'`, `'purchase'`) |
| eventName | `string` | Human-readable event name |
| properties | `Record<string, unknown>` | Optional event metadata |

```typescript
tracker.track('purchase', 'Order Completed', { orderId: '123', value: 99 });
```

### `tracker.identify(email, traits?): Promise<string | null>`

Identify the current visitor. Links them to a CRM contact and returns the contactId.

| Param | Type | Description |
|-------|------|-------------|
| email | `string` | Visitor's email address |
| traits | `UserTraits` | Optional: firstName, lastName, company, phone, jobTitle, etc. |

```typescript
const contactId = await tracker.identify('john@example.com', {
  firstName: 'John',
  lastName: 'Doe',
  company: 'Acme Inc',
});
```

### `tracker.page(name?, properties?)`

Track a page view manually (auto-tracked by default).

```typescript
tracker.page('Pricing Page', { plan: 'enterprise' });
```

### `tracker.group(groupId, traits?)`

Associate the current visitor with a company/organization.

```typescript
tracker.group('company-123', { name: 'Acme Inc', plan: 'enterprise', industry: 'SaaS' });
```

---

## CRM Operations (Frontend-Safe)

These work from the frontend **without API keys** — secured by Project ID + domain whitelist + rate limiting.

### `tracker.createContact(data): Promise<CrmResult>`

Create or update a contact by email (upsert).

```typescript
const result = await tracker.createContact({
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
  company: 'Acme Inc',
  jobTitle: 'CTO',
  phone: '+1234567890',
  source: 'website',
  tags: ['enterprise', 'inbound'],
  customFields: { industry: 'SaaS', teamSize: '50-100' },
});
// result.data.contactId, result.data.isNew
```

### `tracker.updateContact(contactId, data): Promise<CrmResult>`

Update an existing contact by ID (limited fields).

```typescript
await tracker.updateContact('abc123', {
  company: 'New Company',
  tags: ['upgraded'],
  customFields: { plan: 'enterprise' },
});
```

### `tracker.submitForm(formId, data): Promise<CrmResult>`

Submit a form — auto-creates/updates a CRM contact from form fields.

```typescript
await tracker.submitForm('demo-request-form', {
  fields: {
    email: 'jane@company.com',
    firstName: 'Jane',
    company: 'Company Inc',
    message: 'Interested in enterprise plan',
  },
});
```

### `tracker.logActivity(data): Promise<CrmResult>`

Log an activity linked to a contact (append-only).

```typescript
await tracker.logActivity({
  contactId: 'abc123',
  type: 'note',
  title: 'Visited pricing page',
  description: 'User spent 5 minutes on enterprise pricing',
});
```

### `tracker.createOpportunity(data): Promise<CrmResult>`

Create a sales opportunity.

```typescript
await tracker.createOpportunity({
  title: 'Demo Request - Acme Inc',
  contactId: 'abc123',
  pipelineId: 'pipeline-id',
  stageId: 'stage-id',
  value: 50000,
  description: 'Enterprise demo request from website',
});
```

### Allowed Fields

| Operation | Allowed Fields |
|-----------|---------------|
| **Create Contact** | email, firstName, lastName, company, jobTitle, phone, source, tags, customFields |
| **Update Contact** | firstName, lastName, company, jobTitle, phone, tags, customFields |
| **Log Activity** | contactId, type, title, description, direction, duration, emailSubject, metadata |
| **Create Opportunity** | title, contactId, pipelineId, stageId, value, currency, description, expectedCloseDate, customFields |

**Blocked fields** (never accepted from frontend): leadScore, assignedTo, userId, salesforceId, qualityScore, intentScore, apolloEnrichment, emailVerification, mergeHistory

---

## Consent & Privacy

### `tracker.consent(state)`

Update the GDPR consent state.

```typescript
tracker.consent({ analytics: true, marketing: false, personalization: true });
```

### `tracker.getConsentState(): ConsentState`

Get current consent state.

### `tracker.deleteData()`

Delete all stored visitor data (GDPR right-to-erasure).

---

## Middleware

### `tracker.use(middleware)`

Add event middleware for filtering or transforming events before they're sent.

```typescript
tracker.use((event, next) => {
  // Strip sensitive data
  delete event.properties.creditCard;
  next();
});
```

---

## Utility Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `tracker.getVisitorId()` | `string` | Get anonymous visitor UUID |
| `tracker.getSessionId()` | `string` | Get current session ID |
| `tracker.reset()` | `void` | Reset visitor/session (for logout) |
| `tracker.flush()` | `Promise<void>` | Force send all queued events |
| `tracker.destroy()` | `Promise<void>` | Clean up and disconnect |
| `tracker.debug(enabled)` | `void` | Toggle debug mode |

---

## React Hooks

```typescript
import { useEutexa, useEutexaReady, useEutexaTrack } from 'eutexa-sdk/react';

// Get tracker instance
const tracker = useEutexa();

// Check if SDK is ready
const { isReady, tracker } = useEutexaReady();

// Quick track function
const track = useEutexaTrack();
track('button_click', 'CTA', { page: 'pricing' });
```

## Vue Composables

```typescript
import { useEutexa, useEutexaTrack, useEutexaIdentify, useEutexaConsent } from 'eutexa-sdk/vue';

const tracker = useEutexa();         // Ref<TrackerCore | null>
const track = useEutexaTrack();      // (type, name, props?) => void
const identify = useEutexaIdentify(); // (email, traits?) => Promise
const { consent } = useEutexaConsent();
```

---

## Configuration

```typescript
interface EutexaConfig {
  apiEndpoint?: string;       // Auto-detected from env vars
  debug?: boolean;            // Default: false
  plugins?: PluginName[];     // Default: all enabled
  autoPageView?: boolean;     // Default: true
  sessionTimeout?: number;    // Default: 1800000 (30 min)
  batchSize?: number;         // Default: 10
  flushInterval?: number;     // Default: 5000
  consent?: ConsentConfig;    // GDPR consent config
  cookielessMode?: boolean;   // Default: false
  cookieDomain?: string;      // For cross-subdomain tracking
  useCookies?: boolean;       // Use cookies for visitor ID
  persistMode?: 'session' | 'local' | 'none';
}
```

---

## Types

```typescript
import type {
  EutexaConfig,
  TrackerCore,
  TrackingEvent,
  EventType,
  UserTraits,
  ConsentState,
  Plugin,
  PluginName,
  GroupTraits,
  MiddlewareFn,
} from 'eutexa-sdk';
```
