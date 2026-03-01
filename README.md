# Clianta SDK

**Plug-and-play tracking for your CRM.** Install → add one line → done. Everything auto-tracks.

No manual tracking code needed. The SDK automatically captures page views, form submissions, clicks, scroll depth, downloads, engagement, exit intent, errors, and performance — and auto-identifies visitors from email fields in forms.

---

## Setup (2 minutes)

### React / Next.js

```bash
npm install @clianta/sdk
```

```
# .env.local
NEXT_PUBLIC_CLIANTA_ID=your-project-id
```

```tsx
// app/layout.tsx
import { CliantaProvider } from '@clianta/sdk/react';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <CliantaProvider projectId={process.env.NEXT_PUBLIC_CLIANTA_ID!}>
          {children}
        </CliantaProvider>
      </body>
    </html>
  );
}
```

**That's it.** Everything auto-tracks. No other code needed.

---

### Script Tag (HTML / WordPress / Webflow / Shopify)

One line. Paste before `</head>`:

```html
<script src="https://cdn.clianta.online/sdk/v1/clianta.min.js" data-project-id="YOUR_PROJECT_ID"></script>
```

**That's it.** The SDK auto-initializes from the `data-project-id` attribute.

---

### Vue 3

```bash
npm install @clianta/sdk
```

```typescript
// main.ts
import { CliantaPlugin } from '@clianta/sdk/vue';

app.use(CliantaPlugin, { projectId: 'YOUR_PROJECT_ID' });
```

---

### Angular

```typescript
// clianta.service.ts
import { createCliantaTracker } from '@clianta/sdk/angular';

@Injectable({ providedIn: 'root' })
export class CliantaService implements OnDestroy {
  private instance = createCliantaTracker({ projectId: 'YOUR_PROJECT_ID' });
  get tracker() { return this.instance.tracker; }
  ngOnDestroy() { this.instance.destroy(); }
}
```

---

### Svelte

```svelte
<script>
  import { initClianta } from '@clianta/sdk/svelte';
  import { setContext } from 'svelte';
  setContext('clianta', initClianta({ projectId: 'YOUR_PROJECT_ID' }));
</script>
<slot />
```

---

## What Happens Automatically

Once installed, the SDK captures everything with **zero code**:

| Auto-Tracked | What It Does |
|---|---|
| 📄 **Page Views** | Every page load + SPA navigation |
| 📝 **Form Submissions** | All forms auto-captured |
| 🔗 **Auto-Identify** | Detects email fields in forms → links visitor to CRM contact |
| 📜 **Scroll Depth** | 25%, 50%, 75%, 100% milestones |
| 🖱️ **Clicks** | Buttons, CTAs, links |
| 📥 **Downloads** | PDF, ZIP, DOC, etc. |
| ⏱️ **Engagement** | Active time on page vs idle |
| 🚪 **Exit Intent** | Mouse leaving viewport |
| ❌ **JS Errors** | Error message + stack trace |
| ⚡ **Performance** | LCP, FCP, CLS, TTFB (Core Web Vitals) |

Every event is enriched with: `visitorId`, `sessionId`, `contactId` (after auto-identify), UTM params, device info, and `websiteDomain`.

---

## Advanced (Optional)

These are **optional** — the SDK works perfectly without any of this.

### Custom Events

```typescript
import { useClianta } from '@clianta/sdk/react';

const tracker = useClianta();
tracker?.track('purchase', 'Order Completed', { value: 99 });
```

### Manual Identify

```typescript
tracker?.identify('user@example.com', { firstName: 'John' });
```

### Company Association

```typescript
tracker?.group('company-123', { name: 'Acme Inc', plan: 'enterprise' });
```

### Event Middleware

```typescript
tracker?.use((event, next) => {
  delete event.properties.sensitiveField;
  next();
});
```

### Public CRM API (No API Key Needed)

```typescript
await tracker?.createContact({ email: 'lead@example.com', firstName: 'Jane' });
await tracker?.submitForm('contact-form', { email: 'visitor@co.com', message: 'Demo please' });
await tracker?.createOpportunity({ title: 'Deal', contactEmail: 'lead@co.com', value: 50000 });
```

### GDPR / Consent

```typescript
// Buffer events until consent:
<CliantaProvider projectId="xxx" config={{ consent: { waitForConsent: true } }}>

// Then in your cookie banner:
tracker?.consent({ analytics: true });

// Delete all data:
tracker?.deleteData();
```

---

## TypeScript

Full type support:

```typescript
import { type TrackerCore, type CliantaConfig, type GroupTraits, type MiddlewareFn } from '@clianta/sdk';
```

---

## Support

- Documentation: https://docs.clianta.online
- Issues: https://github.com/clianta/sdk/issues
- Email: support@clianta.online
