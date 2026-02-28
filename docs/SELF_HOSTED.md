# Self-Hosted Deployment Guide

## Overview

The Clianta SDK can be used with a self-hosted backend. This guide covers configuring the SDK to point to your own API server.

## SDK Configuration

```typescript
const tracker = clianta('YOUR_WORKSPACE_ID', {
  apiEndpoint: 'https://your-api-server.com',
});
```

For the CRM client:
```typescript
const crm = new CRMClient(
  'https://your-api-server.com',
  'your-workspace-id',
  'your-auth-token'
);
```

## Required Backend Endpoints

Your backend must implement these public endpoints:

### Tracking (No Auth Required)
- `POST /api/public/track/event` — Receive tracking events
- `POST /api/public/track/identify` — Identify visitors
- `GET /api/public/track/visitor/:workspaceId/:visitorId/profile` — Visitor profile
- `GET /api/public/track/visitor/:workspaceId/:visitorId/activity` — Visitor activity
- `GET /api/public/track/visitor/:workspaceId/:visitorId/timeline` — Visitor timeline
- `GET /api/public/track/visitor/:workspaceId/:visitorId/engagement` — Engagement metrics

### Inbound Events (API Key Required)
- `POST /api/public/events` — Inbound events from external apps

### CRM API (Auth Token Required)
- `GET/POST/PUT/DELETE /api/workspaces/:id/contacts`
- `GET/POST/PUT/DELETE /api/workspaces/:id/companies`
- `GET/POST/PUT/DELETE /api/workspaces/:id/opportunities`
- `GET/POST/PUT/DELETE /api/workspaces/:id/pipelines`
- `GET/POST/PUT/DELETE /api/workspaces/:id/tasks`
- `GET/POST/PUT/DELETE /api/workspaces/:id/triggers`
- `GET/POST/PUT/DELETE /api/workspaces/:id/email-templates`
- `POST /api/workspaces/:id/emails/send`
- `GET/POST/DELETE /api/workspaces/:id/webhooks`

## CORS Configuration

Your backend must allow CORS from the websites where the SDK is installed:

```typescript
app.use(cors({
  origin: ['https://your-website.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
}));
```

## HTTPS

Always use HTTPS in production. The SDK will warn if `apiEndpoint` uses HTTP on non-localhost domains.

## Docker Deployment

The backend can be deployed using Docker Compose. See the `docker-compose.yml` in the repository root.

```bash
docker-compose up -d
```
