# Getting Started with Clianta SDK

## Installation

### NPM / Yarn
```bash
npm install @clianta/sdk
# or
yarn add @clianta/sdk
```

### Script Tag (HTML)
```html
<script src="https://cdn.clianta.online/sdk/v1/clianta.min.js"></script>
```

---

## Framework Setup

### React / Next.js

```tsx
// clianta.config.ts
import type { CliantaConfig } from '@clianta/sdk';

const config: CliantaConfig = {
  projectId: process.env.NEXT_PUBLIC_WORKSPACE_ID!,
  apiEndpoint: process.env.NEXT_PUBLIC_API_ENDPOINT,
  debug: process.env.NODE_ENV === 'development',
};

export default config;
```

```tsx
// app/layout.tsx
import { CliantaProvider } from '@clianta/sdk/react';
import cliantaConfig from '../clianta.config';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <CliantaProvider config={cliantaConfig}>
          {children}
        </CliantaProvider>
      </body>
    </html>
  );
}
```

```tsx
// In any component:
import { useClianta } from '@clianta/sdk/react';

function MyComponent() {
  const tracker = useClianta();
  
  const handleClick = () => {
    tracker?.track('button_click', 'CTA Button', { page: 'home' });
  };

  return <button onClick={handleClick}>Click Me</button>;
}
```

### Vue 3

```typescript
// main.ts
import { createApp } from 'vue';
import { CliantaPlugin } from '@clianta/sdk/vue';
import App from './App.vue';

const app = createApp(App);
app.use(CliantaPlugin, {
  projectId: import.meta.env.VITE_WORKSPACE_ID,
  apiEndpoint: import.meta.env.VITE_API_ENDPOINT,
  debug: import.meta.env.DEV,
});
app.mount('#app');
```

```vue
<script setup>
import { useCliantaTrack } from '@clianta/sdk/vue';

const track = useCliantaTrack();

function handleClick() {
  track('button_click', 'CTA', { location: 'header' });
}
</script>
```

### Angular 16+

```typescript
// clianta.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { createCliantaTracker, type CliantaTrackerInstance } from '@clianta/sdk/angular';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class CliantaService implements OnDestroy {
  private instance: CliantaTrackerInstance;

  constructor() {
    this.instance = createCliantaTracker({
      projectId: environment.cliantaProjectId,
      apiEndpoint: environment.cliantaApiEndpoint,
      debug: !environment.production,
    });
  }

  get tracker() { return this.instance.tracker; }

  track(eventType: string, eventName: string, properties?: Record<string, unknown>) {
    this.instance.tracker?.track(eventType, eventName, properties);
  }

  identify(email: string, traits?: Record<string, unknown>) {
    return this.instance.tracker?.identify(email, traits);
  }

  ngOnDestroy() {
    this.instance.destroy();
  }
}
```

### Svelte / SvelteKit

```svelte
<!-- +layout.svelte -->
<script>
  import { initClianta } from '@clianta/sdk/svelte';
  import { setContext } from 'svelte';

  const clianta = initClianta({
    projectId: import.meta.env.VITE_WORKSPACE_ID,
    apiEndpoint: import.meta.env.VITE_API_ENDPOINT,
  });

  setContext('clianta', clianta);
</script>

<slot />
```

```svelte
<!-- Component.svelte -->
<script>
  import { getContext } from 'svelte';
  const clianta = getContext('clianta');

  function handleClick() {
    clianta.track('button_click', 'CTA');
  }
</script>

<button on:click={handleClick}>Click Me</button>
```

### Vanilla JavaScript

```html
<script src="https://cdn.clianta.online/sdk/v1/clianta.min.js"></script>
<script>
  var tracker = clianta('YOUR_WORKSPACE_ID', {
    apiEndpoint: 'https://api.clianta.online',
  });

  // Track events
  tracker.track('button_click', 'CTA Clicked');

  // Identify users
  tracker.identify('user@example.com', { firstName: 'John' });
</script>
```

---

## Reading Visitor Data Back

### Frontend (Own Visitor Only)

```typescript
// Get current visitor's profile
const profile = await tracker.getVisitorProfile();
console.log(profile?.firstName, profile?.email, profile?.leadScore);

// Get visitor's recent activity
const activity = await tracker.getVisitorActivity({ limit: 10 });
activity?.data.forEach(event => {
  console.log(event.eventType, event.eventName, event.timestamp);
});

// Get visitor journey timeline
const timeline = await tracker.getVisitorTimeline();
console.log('Sessions:', timeline?.totalSessions);
console.log('Time spent:', timeline?.totalTimeSpentSeconds, 'seconds');

// Get engagement metrics
const engagement = await tracker.getVisitorEngagement();
console.log('Engagement score:', engagement?.engagementScore);
```

### Server-Side (Full Access via API Key)

```typescript
import { CRMClient } from '@clianta/sdk';

const crm = new CRMClient('https://api.clianta.online', 'workspace-id');
crm.setApiKey('mm_live_xxxxx');

// Look up contact by email
const contact = await crm.getContactByEmail('user@example.com');

// Get engagement data
const engagement = await crm.getContactEngagement(contact.data._id);

// Search contacts
const results = await crm.searchContacts('john', { status: 'lead' });
```

---

## Next Steps

- [API Reference](./API_REFERENCE.md) — Full method reference
- [Event Triggers](./EVENT_TRIGGERS.md) — Automation & workflows
- [Self-Hosted Guide](./SELF_HOSTED.md) — Deploy your own backend
