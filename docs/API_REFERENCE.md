# Clianta SDK API Reference

## Tracker Methods

### `tracker.track(eventType, eventName, properties?)`
Track a custom event.

| Param | Type | Description |
|-------|------|-------------|
| eventType | `string` | Event category (e.g., `'button_click'`, `'purchase'`) |
| eventName | `string` | Human-readable event name |
| properties | `Record<string, unknown>` | Optional event metadata |

### `tracker.identify(email, traits?): Promise<string | null>`
Identify the current visitor. Returns the CRM contactId.

| Param | Type | Description |
|-------|------|-------------|
| email | `string` | Visitor's email |
| traits | `UserTraits` | Optional: firstName, lastName, company, phone, etc. |

### `tracker.page(name?, properties?)`
Track a page view manually.

### `tracker.consent(state)`
Update GDPR consent state.

| Field | Type | Description |
|-------|------|-------------|
| analytics | `boolean` | Allow analytics tracking |
| marketing | `boolean` | Allow marketing tracking |
| personalization | `boolean` | Allow personalization |

### `tracker.getVisitorProfile(): Promise<VisitorProfile | null>`
Fetch the current visitor's CRM profile (frontend-safe, own data only).

Returns: `VisitorProfile` with fields: visitorId, contactId, email, firstName, lastName, company, jobTitle, status, lifecycleStage, tags, leadScore, sessionCount, pageViewCount.

### `tracker.getVisitorActivity(options?): Promise<...>`
Fetch recent events for the current visitor.

Options: `{ page, limit, eventType, startDate, endDate }`

### `tracker.getVisitorTimeline(): Promise<VisitorTimeline | null>`
Fetch a journey summary: sessions, page views, time spent, top pages, devices.

### `tracker.getVisitorEngagement(): Promise<EngagementMetrics | null>`
Fetch engagement metrics: time on site, bounce rate, engagement score.

### `tracker.registerEventSchema(eventType, schema)`
Register a validation schema for an event type (debug mode only).

### `tracker.getVisitorId(): string`
Get the anonymous visitor UUID.

### `tracker.getSessionId(): string`
Get the current session ID.

### `tracker.flush(): Promise<void>`
Force send all queued events.

### `tracker.reset()`
Reset visitor data (for logout).

### `tracker.deleteData()`
Delete all stored user data (GDPR right-to-erasure).

### `tracker.debug(enabled)`
Toggle debug mode.

---

## CRM Client Methods

### Initialization
```typescript
import { CRMClient } from '@clianta/sdk';

// Recommended: use env vars for API key (never hardcode)
const crm = new CRMClient(
  process.env.CLIANTA_API_ENDPOINT!,
  process.env.CLIANTA_WORKSPACE_ID!,
  { apiKey: process.env.CLIANTA_API_KEY }
);
```

> ⚠️ **Server-side only.** API keys must never be exposed in browser code.

### Contacts
- `crm.getContacts(params?)` — List contacts (paginated)
- `crm.getContact(id)` — Get by ID
- `crm.getContactByEmail(email)` — Get by email
- `crm.createContact(data)` — Create
- `crm.updateContact(id, data)` — Update
- `crm.deleteContact(id)` — Delete
- `crm.searchContacts(query, filters?)` — Advanced search

### Contact Data
- `crm.getContactActivity(id, params?)` — Activity timeline
- `crm.getContactEngagement(id)` — Engagement metrics
- `crm.getContactTimeline(id, params?)` — Full timeline

### Companies
- `crm.getCompanies(params?)` — List
- `crm.getCompany(id)` — Get
- `crm.createCompany(data)` — Create
- `crm.updateCompany(id, data)` — Update
- `crm.deleteCompany(id)` — Delete
- `crm.getCompanyContacts(id)` — Contacts in company
- `crm.getCompanyDeals(id)` — Deals for company

### Opportunities
- `crm.getOpportunities(params?)` — List
- `crm.getOpportunity(id)` — Get
- `crm.createOpportunity(data)` — Create
- `crm.updateOpportunity(id, data)` — Update
- `crm.deleteOpportunity(id)` — Delete
- `crm.moveOpportunity(id, stageId)` — Move stage

### Tasks
- `crm.getTasks(params?)` — List
- `crm.getTask(id)` — Get
- `crm.createTask(data)` — Create
- `crm.updateTask(id, data)` — Update
- `crm.completeTask(id)` — Mark complete
- `crm.deleteTask(id)` — Delete

### Activities
- `crm.getContactActivities(contactId)` — Contact activities
- `crm.createActivity(data)` — Create
- `crm.logCall(data)` — Log a call
- `crm.logMeeting(data)` — Log a meeting
- `crm.addNote(data)` — Add a note

### Email
- `crm.getEmailTemplates()` — List templates
- `crm.createEmailTemplate(data)` — Create template
- `crm.sendEmail(data)` — Send email

### Webhooks
- `crm.listWebhooks()` — List subscriptions
- `crm.createWebhook(data)` — Create subscription
- `crm.deleteWebhook(id)` — Delete subscription

### Event Triggers
- `crm.getEventTriggers()` — List triggers
- `crm.createEventTrigger(data)` — Create trigger
- `crm.updateEventTrigger(id, data)` — Update trigger
- `crm.deleteEventTrigger(id)` — Delete trigger

### Inbound Events
- `crm.sendEvent(payload)` — Push event from external app
