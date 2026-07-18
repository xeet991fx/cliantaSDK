# Event Triggers & CRM Automation

## Overview

Event triggers enable automated workflows based on CRM events — similar to Salesforce Process Builder, HubSpot Workflows, or Pipedrive Workflow Automation. Create automated responses to contacts, opportunities, tasks, and form submissions.

## Features

- **Event-Driven Automation**: Trigger actions based on CRM events
- **Email Notifications**: Send automated emails on contact/opportunity actions
- **Task Creation**: Auto-create follow-up tasks
- **Webhooks**: Integrate with Slack, Zapier, and other external services
- **Conditional Logic**: Define conditions for when triggers should fire
- **Template Variables**: Use dynamic variables in emails and tasks

---

## Managing Triggers

Triggers are managed through the Eutexa dashboard under **Settings → Automations**, or via the backend API.

### Creating a Trigger via API

```bash
POST /api/workspaces/:workspaceId/triggers
Authorization: Bearer <your-auth-token>
```

```json
{
  "name": "Welcome Email",
  "eventType": "contact.created",
  "actions": [
    {
      "type": "send_email",
      "to": "{{contact.email}}",
      "subject": "Welcome to Our Platform!",
      "body": "Hello {{contact.firstName}}, welcome aboard!"
    }
  ],
  "isActive": true
}
```

---

## Event Types

### Contact Events
- `contact.created` — New contact created
- `contact.updated` — Contact updated
- `contact.deleted` — Contact deleted

### Opportunity Events
- `opportunity.created` — New opportunity created
- `opportunity.updated` — Opportunity updated
- `opportunity.stage_changed` — Opportunity moved to different stage
- `opportunity.won` — Opportunity won
- `opportunity.lost` — Opportunity lost

### Task Events
- `task.created` — New task created
- `task.completed` — Task marked complete
- `task.overdue` — Task became overdue

### Activity Events
- `activity.logged` — Activity logged
- `form.submitted` — Form submitted

---

## Action Types

### 1. Send Email

```json
{
  "type": "send_email",
  "to": "{{contact.email}}",
  "subject": "Congratulations on Your Purchase!",
  "body": "Hi {{contact.firstName}}, thank you for purchasing {{opportunity.title}}.",
  "from": "sales@company.com",
  "cc": ["manager@company.com"]
}
```

### 2. Create Task

```json
{
  "type": "create_task",
  "title": "Follow up with {{contact.firstName}} about {{opportunity.title}}",
  "description": "Initial follow-up call",
  "priority": "high",
  "dueDays": 2,
  "assignedTo": "sales-rep-id"
}
```

### 3. Webhook

```json
{
  "type": "webhook",
  "url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
  "method": "POST",
  "headers": { "Content-Type": "application/json" },
  "body": "{\"text\": \"Deal won: {{opportunity.title}} - ${{opportunity.value}}\"}"
}
```

### 4. Update Contact

```json
{
  "type": "update_contact",
  "updates": {
    "status": "customer",
    "lifecycleStage": "customer"
  }
}
```

---

## Conditional Triggers

Add conditions to control when triggers fire:

```json
{
  "name": "High-Value Deal Alert",
  "eventType": "opportunity.created",
  "conditions": [
    { "field": "value", "operator": "greater_than", "value": 10000 },
    { "field": "priority", "operator": "equals", "value": "high" }
  ],
  "actions": [
    {
      "type": "send_email",
      "to": "sales-manager@company.com",
      "subject": "High-Value Opportunity Alert",
      "body": "New opportunity: {{opportunity.title}} - ${{opportunity.value}}"
    }
  ]
}
```

### Available Operators

| Operator | Description |
|----------|-------------|
| `equals` | Field equals value |
| `not_equals` | Field does not equal value |
| `contains` | Field contains value (string) |
| `greater_than` | Field is greater than value (number) |
| `less_than` | Field is less than value (number) |
| `in` | Field is in array of values |
| `not_in` | Field is not in array of values |

---

## Template Variables

Use dynamic variables in email subjects, bodies, and task titles:

### Contact Variables
- `{{contact.email}}`, `{{contact.firstName}}`, `{{contact.lastName}}`
- `{{contact.company}}`, `{{contact.phone}}`, `{{contact.status}}`
- `{{contact.lifecycleStage}}`

### Opportunity Variables
- `{{opportunity.title}}`, `{{opportunity.value}}`
- `{{opportunity.status}}`, `{{opportunity.priority}}`
- `{{opportunity.expectedCloseDate}}`

### Custom Field Variables
- `{{customFields.industry}}`, `{{customFields.accountType}}`
- Any field via dot notation: `{{customFields.anyFieldName}}`

---

## Common Use Cases

### Lead Nurturing Sequence

```json
// Day 0: Welcome email on contact creation
{
  "name": "Welcome Email",
  "eventType": "contact.created",
  "actions": [{ "type": "send_email", "to": "{{contact.email}}", "subject": "Welcome!", "body": "..." }]
}
```

### Sales Pipeline Automation

```json
// Auto-assign tasks when deal enters qualification stage
{
  "name": "Qualification Task",
  "eventType": "opportunity.stage_changed",
  "conditions": [{ "field": "stageId", "operator": "equals", "value": "qualification-stage-id" }],
  "actions": [{ "type": "create_task", "title": "Qualify: {{opportunity.title}}", "priority": "high", "dueDays": 1 }]
}
```

### Slack Notifications

```json
{
  "name": "Slack: New High-Value Opportunity",
  "eventType": "opportunity.created",
  "conditions": [{ "field": "value", "operator": "greater_than", "value": 50000 }],
  "actions": [{ "type": "webhook", "url": "https://hooks.slack.com/services/YOUR/WEBHOOK", "method": "POST" }]
}
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workspaces/:id/triggers` | List all triggers |
| POST | `/api/workspaces/:id/triggers` | Create trigger |
| PUT | `/api/workspaces/:id/triggers/:triggerId` | Update trigger |
| DELETE | `/api/workspaces/:id/triggers/:triggerId` | Delete trigger |

All trigger endpoints require authentication via Bearer token.
