# Clianta SDK — Getting Started

## Installation

```bash
npm install @clianta/sdk
# or
yarn add @clianta/sdk
# or
pnpm add @clianta/sdk
```

---

## Environment Variables

The SDK auto-detects your CRM backend from environment variables. Add these to your project:

| Framework | File | Variables |
|---|---|---|
| Next.js | `.env.local` | `NEXT_PUBLIC_CLIANTA_PROJECT_ID`, `NEXT_PUBLIC_CLIANTA_API_ENDPOINT` |
| Vite / Vue | `.env` | `VITE_CLIANTA_PROJECT_ID`, `VITE_CLIANTA_API_ENDPOINT` |
| CRA | `.env` | `REACT_APP_CLIANTA_PROJECT_ID`, `REACT_APP_CLIANTA_API_ENDPOINT` |

Example `.env.local`:
```bash
NEXT_PUBLIC_CLIANTA_PROJECT_ID=your-project-id
NEXT_PUBLIC_CLIANTA_API_ENDPOINT=https://your-crm-backend.com
```

---

## Framework Integration

### React / Next.js

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

Use in any component:
```tsx
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
  projectId: import.meta.env.VITE_CLIANTA_PROJECT_ID,
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
    projectId: import.meta.env.VITE_CLIANTA_PROJECT_ID,
    apiEndpoint: import.meta.env.VITE_CLIANTA_API_ENDPOINT,
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

---

## What Happens Automatically

Once integrated, the SDK automatically captures — no additional code needed:

- **Page Views** — every page load + SPA route changes
- **Form Submissions** — all forms auto-captured + auto-identify from email fields
- **Scroll Depth** — 25%, 50%, 75%, 100% milestones
- **Clicks** — buttons, CTAs, navigation links
- **File Downloads** — PDF, ZIP, DOC, XLSX, CSV, etc.
- **Engagement** — active time on page vs idle
- **Exit Intent** — mouse leaving viewport
- **JS Errors** — error message, stack trace, source
- **Core Web Vitals** — LCP, FCP, CLS, TTFB

---

## Next Steps

- [API Reference](./API_REFERENCE.md) — All SDK methods
- [Event Triggers](./EVENT_TRIGGERS.md) — CRM automation & workflows
- [Self-Hosted Guide](./SELF_HOSTED.md) — Deploy your own backend
