# Self-Hosted Deployment Guide

## Overview

The Eutexa SDK connects to your CRM backend. This guide covers configuring the SDK to point to your self-hosted instance.

## SDK Configuration

The SDK auto-detects your backend URL from environment variables:

```bash
# Next.js
NEXT_PUBLIC_EUTEXA_API_ENDPOINT=https://your-api-server.com

# Vite / Vue / Svelte
VITE_EUTEXA_API_ENDPOINT=https://your-api-server.com
```

Or pass it directly (Angular, Svelte):

```typescript
createEutexaTracker({
  projectId: 'your-project-id',
  apiEndpoint: 'https://your-api-server.com',
});
```

---

## Required Backend Endpoints

Your backend must implement these public endpoints for client-side SDK communication:

### Tracking (No Auth — secured by Project ID + domain whitelist)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/public/track/event` | Receive tracking events |
| POST | `/api/public/track/identify` | Identify visitors |

### CRM Operations (No Auth — secured by Project ID + domain whitelist + rate limiting)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/public/crm/contacts` | Create/update contact (upsert) |
| PUT | `/api/public/crm/contacts/:id` | Update contact (limited fields) |
| POST | `/api/public/crm/forms/:formId/submit` | Form submission |
| POST | `/api/public/crm/activities` | Log activity |
| POST | `/api/public/crm/opportunities` | Create opportunity |

### Internal API (Auth Token Required — dashboard access only)

| Method | Pattern | Description |
|--------|---------|-------------|
| CRUD | `/api/workspaces/:id/contacts` | Contact management |
| CRUD | `/api/workspaces/:id/companies` | Company management |
| CRUD | `/api/workspaces/:id/opportunities` | Opportunity management |
| CRUD | `/api/workspaces/:id/pipelines` | Pipeline management |
| CRUD | `/api/workspaces/:id/tasks` | Task management |
| CRUD | `/api/workspaces/:id/triggers` | Automation triggers |

---

## CORS Configuration

Your backend must allow CORS from websites where the SDK is installed. Configure allowed domains in **Settings → Developer → Allowed Domains** in the Eutexa dashboard.

Backend example:

```typescript
app.use(cors({
  origin: ['https://your-website.com', 'https://app.your-website.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
}));
```

---

## Security

- Always use **HTTPS** in production
- The SDK will warn if `apiEndpoint` uses HTTP on non-localhost domains
- Public endpoints are rate-limited (100 req/min per IP)
- Only whitelisted domains can send tracking data

---

## Docker Deployment

```bash
docker-compose up -d
```

See `docker-compose.yml` in the repository root for the full configuration.
