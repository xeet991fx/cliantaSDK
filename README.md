# Clianta SDK

> **Enterprise-grade visitor intelligence for your CRM.**
> Auto-captures every interaction on your website and feeds it directly into Clianta CRM — zero manual tracking code required.

[![npm](https://img.shields.io/npm/v/@clianta/sdk)](https://www.npmjs.com/package/@clianta/sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)

---

## Quick Start

### 1. Install

```bash
npm install @clianta/sdk
```

### 2. Integrate

Pick your framework below. Each section includes the correct env vars and file paths for that framework.

---

#### Next.js (App Router)

**Environment Variables** — set in `.env` or your hosting dashboard (Vercel, Netlify, etc.):

```bash
NEXT_PUBLIC_CLIANTA_PROJECT_ID=your-project-id
NEXT_PUBLIC_CLIANTA_API_ENDPOINT=https://your-crm-backend.com
```

**Integration** — wrap your app in `app/layout.tsx`:

```tsx
// app/layout.tsx
import { CliantaProvider } from '@clianta/sdk/react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CliantaProvider projectId={process.env.NEXT_PUBLIC_CLIANTA_PROJECT_ID!}>
          {children}
        </CliantaProvider>
      </body>
    </html>
  );
}
```

---

#### React (Vite)

**Environment Variables** — set in `.env` or your hosting dashboard:

```bash
VITE_CLIANTA_PROJECT_ID=your-project-id
VITE_CLIANTA_API_ENDPOINT=https://your-crm-backend.com
```

**Integration** — wrap your app in `src/main.tsx`:

```tsx
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { CliantaProvider } from '@clianta/sdk/react';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CliantaProvider projectId={import.meta.env.VITE_CLIANTA_PROJECT_ID}>
      <App />
    </CliantaProvider>
  </React.StrictMode>
);
```

---

#### Vue 3 (Vite)

**Environment Variables** — set in `.env` or your hosting dashboard:

```bash
VITE_CLIANTA_PROJECT_ID=your-project-id
VITE_CLIANTA_API_ENDPOINT=https://your-crm-backend.com
```

**Integration** — register the plugin in `src/main.ts`:

```typescript
// src/main.ts
import { createApp } from 'vue';
import { CliantaPlugin } from '@clianta/sdk/vue';
import App from './App.vue';

const app = createApp(App);
app.use(CliantaPlugin, {
  projectId: import.meta.env.VITE_CLIANTA_PROJECT_ID,
});
app.mount('#app');
```

---

#### Angular 16+

**Environment Variables** — set in `src/environments/environment.ts`:

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  cliantaProjectId: 'your-project-id',
  cliantaApiEndpoint: 'https://your-crm-backend.com',
};
```

**Integration** — create a service at `src/app/clianta.service.ts`:

```typescript
// src/app/clianta.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { createCliantaTracker, CliantaTrackerInstance } from '@clianta/sdk/angular';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class CliantaService implements OnDestroy {
  private instance: CliantaTrackerInstance;

  constructor() {
    this.instance = createCliantaTracker({
      projectId: environment.cliantaProjectId,
      apiEndpoint: environment.cliantaApiEndpoint,
    });
  }

  get tracker() { return this.instance.tracker; }

  track(eventType: string, eventName: string, properties?: Record<string, unknown>) {
    this.instance.tracker?.track(eventType, eventName, properties);
  }

  identify(email: string, traits?: Record<string, unknown>) {
    return this.instance.tracker?.identify(email, traits);
  }

  ngOnDestroy() { this.instance.destroy(); }
}
```

---

#### Svelte / SvelteKit

**Environment Variables** — set in `.env` or your hosting dashboard:

```bash
VITE_CLIANTA_PROJECT_ID=your-project-id
VITE_CLIANTA_API_ENDPOINT=https://your-crm-backend.com
```

**Integration** — initialize in `src/routes/+layout.svelte`:

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import { initClianta } from '@clianta/sdk/svelte';
  import { setContext } from 'svelte';

  const clianta = initClianta({
    projectId: import.meta.env.VITE_CLIANTA_PROJECT_ID,
    apiEndpoint: import.meta.env.VITE_CLIANTA_API_ENDPOINT,
  });

  setContext('clianta', clianta);
</script>

<slot />
```

**Done.** Every visitor interaction on your website is now flowing into your CRM.

---

## What Gets Captured Automatically

Once integrated, the SDK captures the following with **zero additional code**:

| Category | What It Captures |
|---|---|
| **Page Views** | Every page load + SPA route changes (history API) |
| **Form Submissions** | All forms auto-captured with field data |
| **Visitor Identity** | Detects email fields in forms → auto-links visitor to CRM contact |
| **Scroll Depth** | 25%, 50%, 75%, 100% milestones |
| **Click Tracking** | Buttons, CTAs, navigation links |
| **File Downloads** | PDF, ZIP, DOC, XLSX, CSV, and more |
| **Engagement** | Active time on page vs idle time |
| **Exit Intent** | Mouse leaving viewport (desktop) |
| **JavaScript Errors** | Error message, stack trace, source file |
| **Core Web Vitals** | LCP, FCP, CLS, TTFB, FID |

Every event is enriched with: `visitorId`, `sessionId`, `contactId` (after auto-identify), UTM parameters, device/browser info, and `websiteDomain`.

---

## Optional: Advanced Features

The SDK works perfectly without any of the following. These are for teams that want deeper control.

### Custom Event Tracking

```typescript
import { useClianta } from '@clianta/sdk/react';

const tracker = useClianta();
tracker?.track('purchase', 'Order Completed', { value: 99, currency: 'USD' });
```

### Manual Identification

```typescript
tracker?.identify('user@example.com', { firstName: 'John', company: 'Acme' });
```

### Company Association

```typescript
tracker?.group('company-123', { name: 'Acme Inc', plan: 'enterprise' });
```

### Event Middleware

```typescript
tracker?.use((event, next) => {
  // Strip sensitive data before sending
  delete event.properties.creditCard;
  next();
});
```

### Frontend CRM Operations

```typescript
// Create or update a contact (secured by domain whitelist, no API key needed)
await tracker?.createContact({ email: 'lead@example.com', firstName: 'Jane', company: 'Acme' });

// Submit a form programmatically
await tracker?.submitForm('demo-request', { email: 'visitor@co.com', message: 'Demo please' });

// Create a sales opportunity
await tracker?.createOpportunity({ title: 'Enterprise Deal', contactEmail: 'vp@acme.com', value: 50000 });
```

### GDPR / Consent Management

```tsx
// Buffer events until consent is given:
<CliantaProvider projectId="xxx" config={{ consent: { waitForConsent: true } }}>

// In your cookie banner:
tracker?.consent({ analytics: true, marketing: false });

// Right to erasure:
tracker?.deleteData();
```

---

## TypeScript

Full type support included:

```typescript
import type { TrackerCore, CliantaConfig, GroupTraits, MiddlewareFn } from '@clianta/sdk';
```

---

## Configuration Reference

| Option | Type | Default | Description |
|---|---|---|---|
| `projectId` | `string` | — | Your project ID from Clianta dashboard |
| `apiEndpoint` | `string` | Auto-detect from env vars | CRM backend URL |
| `debug` | `boolean` | `false` | Enable verbose console logging |
| `plugins` | `PluginName[]` | All enabled | Plugins to activate |
| `consent` | `ConsentConfig` | `undefined` | GDPR consent configuration |
| `cookielessMode` | `boolean` | `false` | Session-only storage (no persistence) |
| `sessionTimeout` | `number` | `1800000` | Session timeout in ms (default: 30 min) |
| `batchSize` | `number` | `10` | Events to batch before sending |
| `flushInterval` | `number` | `5000` | Auto-flush interval in ms |

---

## Security

- **Domain Whitelisting** — Only requests from your registered domains are accepted
- **No API Keys on Frontend** — CRM write operations are secured by project ID + domain whitelist
- **Rate Limiting** — 100 requests/minute per IP
- **Field Whitelisting** — Only safe fields accepted (no `leadScore`, `assignedTo`, etc.)

---

## Support

- **Documentation**: [docs.clianta.online](https://docs.clianta.online)
- **NPM**: [@clianta/sdk](https://www.npmjs.com/package/@clianta/sdk)
- **Email**: support@clianta.online
