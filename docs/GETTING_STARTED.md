# Eutexa SDK — Getting Started

## Installation

```bash
npm install @eutexa/sdk
# or
yarn add @eutexa/sdk
# or
pnpm add @eutexa/sdk
```

---

## Framework Integration

Each framework has its own env vars, file paths, and entry points. Pick yours below.

---

### Next.js (App Router)

**Environment Variables** — set in `.env` or your hosting dashboard (Vercel, Netlify, etc.):

```bash
NEXT_PUBLIC_EUTEXA_PROJECT_ID=your-project-id
NEXT_PUBLIC_EUTEXA_API_ENDPOINT=https://your-crm-backend.com
```

**Integration** — wrap your app in `app/layout.tsx`:

```tsx
// app/layout.tsx
import { EutexaProvider } from '@eutexa/sdk/react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <EutexaProvider projectId={process.env.NEXT_PUBLIC_EUTEXA_PROJECT_ID!}>
          {children}
        </EutexaProvider>
      </body>
    </html>
  );
}
```
---

### React (Vite)

**Environment Variables** — set in `.env` or your hosting dashboard:

```bash
VITE_EUTEXA_PROJECT_ID=your-project-id
VITE_EUTEXA_API_ENDPOINT=https://your-crm-backend.com
```

**Integration** — wrap your app in `src/main.tsx`:

```tsx
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { EutexaProvider } from '@eutexa/sdk/react';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <EutexaProvider projectId={import.meta.env.VITE_EUTEXA_PROJECT_ID}>
      <App />
    </EutexaProvider>
  </React.StrictMode>
);
```

**Use in any component:**

```tsx
// src/components/MyComponent.tsx
import { useEutexa } from '@eutexa/sdk/react';

function MyComponent() {
  const tracker = useEutexa();

  const handleClick = () => {
    tracker?.track('button_click', 'CTA Button', { page: 'home' });
  };

  return <button onClick={handleClick}>Click Me</button>;
}
```

---

### Vue 3 (Vite)

**Environment Variables** — set in `.env` or your hosting dashboard:

```bash
VITE_EUTEXA_PROJECT_ID=your-project-id
VITE_EUTEXA_API_ENDPOINT=https://your-crm-backend.com
```

**Integration** — register the plugin in `src/main.ts`:

```typescript
// src/main.ts
import { createApp } from 'vue';
import { EutexaPlugin } from '@eutexa/sdk/vue';
import App from './App.vue';

const app = createApp(App);
app.use(EutexaPlugin, {
  projectId: import.meta.env.VITE_EUTEXA_PROJECT_ID,
});
app.mount('#app');
```

**Use in any component:**

```vue
<!-- src/components/MyComponent.vue -->
<script setup>
import { useEutexaTrack } from '@eutexa/sdk/vue';

const track = useEutexaTrack();

function handleClick() {
  track('button_click', 'CTA', { location: 'header' });
}
</script>
```

---

### Angular 16+

**Environment Variables** — set in `src/environments/environment.ts`:

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  eutexaProjectId: 'your-project-id',
  eutexaApiEndpoint: 'https://your-crm-backend.com',
};
```

**Integration** — create a service at `src/app/eutexa.service.ts`:

```typescript
// src/app/eutexa.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { createEutexaTracker, type EutexaTrackerInstance } from '@eutexa/sdk/angular';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class EutexaService implements OnDestroy {
  private instance: EutexaTrackerInstance;

  constructor() {
    this.instance = createEutexaTracker({
      projectId: environment.eutexaProjectId,
      apiEndpoint: environment.eutexaApiEndpoint,
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

---

### Svelte / SvelteKit

**Environment Variables** — set in `.env` or your hosting dashboard:

```bash
VITE_EUTEXA_PROJECT_ID=your-project-id
VITE_EUTEXA_API_ENDPOINT=https://your-crm-backend.com
```

**Integration** — initialize in `src/routes/+layout.svelte`:

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import { initEutexa } from '@eutexa/sdk/svelte';
  import { setContext } from 'svelte';

  const eutexa = initEutexa({
    projectId: import.meta.env.VITE_EUTEXA_PROJECT_ID,
    apiEndpoint: import.meta.env.VITE_EUTEXA_API_ENDPOINT,
  });

  setContext('eutexa', eutexa);
</script>

<slot />
```

**Use in any component:**

```svelte
<!-- src/routes/dashboard/+page.svelte -->
<script>
  import { getContext } from 'svelte';
  const eutexa = getContext('eutexa');

  function handleClick() {
    eutexa.track('button_click', 'CTA');
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
