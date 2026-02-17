# Event Triggers & Email Automation

## Overview

Event triggers enable automated workflows based on CRM actions. Similar to Salesforce's Process Builder, HubSpot's Workflows, or Pipedrive's Workflow Automation, you can create automated responses to events like contact creation, opportunity updates, and more.

## Features

- **Event-Driven Automation**: Trigger actions based on CRM events
- **Email Notifications**: Send automated emails based on contact/opportunity actions
- **Task Creation**: Automatically create follow-up tasks
- **Webhooks**: Integrate with external services (Slack, Zapier, etc.)
- **Conditional Logic**: Define conditions for when triggers should fire
- **Template Variables**: Use dynamic variables in emails and tasks

## Quick Start

### Initialize the Triggers Manager

```typescript
import { CRMClient } from '@clianta/sdk';

const crm = new CRMClient(
  'https://api.clianta.online',
  'your-workspace-id',
  'your-auth-token'
);

// Access triggers through CRM client
const triggers = crm.triggers;
```

### Create a Simple Email Trigger

```typescript
// Send welcome email when a new contact is created
await crm.createEventTrigger({
  name: 'Welcome Email',
  eventType: 'contact.created',
  actions: [
    {
      type: 'send_email',
      to: '{{contact.email}}',
      subject: 'Welcome to Our Platform!',
      body: 'Hello {{contact.firstName}}, welcome aboard!',
    }
  ],
  isActive: true,
});
```

## Event Types

### Contact Events
- `contact.created` - When a new contact is created
- `contact.updated` - When a contact is updated
- `contact.deleted` - When a contact is deleted

### Opportunity Events
- `opportunity.created` - When a new opportunity is created
- `opportunity.updated` - When an opportunity is updated
- `opportunity.stage_changed` - When opportunity moves to a different stage
- `opportunity.won` - When an opportunity is won
- `opportunity.lost` - When an opportunity is lost

### Task Events
- `task.created` - When a new task is created
- `task.completed` - When a task is marked complete
- `task.overdue` - When a task becomes overdue

### Activity Events
- `activity.logged` - When an activity is logged
- `form.submitted` - When a form is submitted

## Action Types

### 1. Send Email

Send automated emails with template variables:

```typescript
await crm.createEventTrigger({
  name: 'Opportunity Won Notification',
  eventType: 'opportunity.won',
  actions: [
    {
      type: 'send_email',
      to: '{{contact.email}}',
      subject: 'Congratulations on Your Purchase!',
      body: `
        Hi {{contact.firstName}},
        
        Thank you for your purchase of {{opportunity.title}}.
        Deal value: ${{opportunity.value}}
        
        We'll be in touch soon!
      `,
      from: 'sales@company.com',
      cc: ['manager@company.com'],
    }
  ],
  isActive: true,
});
```

### 2. Create Task

Automatically create follow-up tasks:

```typescript
await crm.createEventTrigger({
  name: 'Follow-up Task for New Opportunities',
  eventType: 'opportunity.created',
  actions: [
    {
      type: 'create_task',
      title: 'Follow up with {{contact.firstName}} about {{opportunity.title}}',
      description: 'Initial follow-up call',
      priority: 'high',
      dueDays: 2, // Due 2 days from now
      assignedTo: 'sales-rep-id',
    }
  ],
  isActive: true,
});
```

### 3. Webhook

Call external services:

```typescript
await crm.createEventTrigger({
  name: 'Slack Notification on Deal Won',
  eventType: 'opportunity.won',
  actions: [
    {
      type: 'webhook',
      url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'Deal won: {{opportunity.title}} - ${{opportunity.value}}',
      }),
    }
  ],
  isActive: true,
});
```

### 4. Update Contact

Automatically update contact fields:

```typescript
await crm.createEventTrigger({
  name: 'Mark as Customer on Deal Won',
  eventType: 'opportunity.won',
  actions: [
    {
      type: 'update_contact',
      updates: {
        status: 'customer',
        lifecycleStage: 'customer',
      },
    }
  ],
  isActive: true,
});
```

## Conditional Triggers

Add conditions to control when triggers fire:

```typescript
await crm.createEventTrigger({
  name: 'High-Value Deal Alert',
  eventType: 'opportunity.created',
  conditions: [
    {
      field: 'value',
      operator: 'greater_than',
      value: 10000,
    },
    {
      field: 'priority',
      operator: 'equals',
      value: 'high',
    }
  ],
  actions: [
    {
      type: 'send_email',
      to: 'sales-manager@company.com',
      subject: 'High-Value Opportunity Alert',
      body: 'New high-value opportunity: {{opportunity.title}} - ${{opportunity.value}}',
    }
  ],
  isActive: true,
});
```

### Available Operators

- `equals` - Field equals value
- `not_equals` - Field does not equal value
- `contains` - Field contains value (string)
- `greater_than` - Field is greater than value (number)
- `less_than` - Field is less than value (number)
- `in` - Field is in array of values
- `not_in` - Field is not in array of values

## Template Variables

Use dynamic variables in your email subjects, bodies, and task titles:

### Contact Variables
- `{{contact.email}}`
- `{{contact.firstName}}`
- `{{contact.lastName}}`
- `{{contact.company}}`
- `{{contact.phone}}`
- `{{contact.status}}`
- `{{contact.lifecycleStage}}`

### Opportunity Variables
- `{{opportunity.title}}`
- `{{opportunity.value}}`
- `{{opportunity.status}}`
- `{{opportunity.priority}}`
- `{{opportunity.expectedCloseDate}}`

## Email Templates

Create reusable email templates:

```typescript
// Create a template
const template = await crm.createEmailTemplate({
  name: 'Welcome Email',
  subject: 'Welcome to {{company.name}}',
  body: `
    <html>
      <body>
        <h1>Welcome {{contact.firstName}}!</h1>
        <p>We're excited to have you on board.</p>
      </body>
    </html>
  `,
  variables: ['contact.firstName', 'company.name'],
  fromEmail: 'hello@company.com',
  fromName: 'Company Team',
});

// Use template in trigger
await crm.createEventTrigger({
  name: 'Welcome Email with Template',
  eventType: 'contact.created',
  actions: [
    {
      type: 'send_email',
      to: '{{contact.email}}',
      templateId: template.data._id,
    }
  ],
  isActive: true,
});
```

## Helper Methods

Simplified methods for common patterns:

### Email Trigger

```typescript
await crm.triggers.createEmailTrigger({
  name: 'Contact Update Notification',
  eventType: 'contact.updated',
  to: '{{contact.email}}',
  subject: 'Your Profile Was Updated',
  body: 'Hi {{contact.firstName}}, your profile has been updated.',
  conditions: [
    { field: 'status', operator: 'equals', value: 'lead' }
  ],
});
```

### Task Trigger

```typescript
await crm.triggers.createTaskTrigger({
  name: 'Follow-up Task',
  eventType: 'opportunity.created',
  taskTitle: 'Call {{contact.firstName}} about {{opportunity.title}}',
  taskDescription: 'Initial discovery call',
  priority: 'high',
  dueDays: 1,
});
```

### Webhook Trigger

```typescript
await crm.triggers.createWebhookTrigger({
  name: 'Zapier Integration',
  eventType: 'contact.created',
  webhookUrl: 'https://hooks.zapier.com/hooks/catch/xxx',
  method: 'POST',
});
```

## Managing Triggers

### List All Triggers

```typescript
const triggers = await crm.getEventTriggers();
console.log(triggers.data);
```

### Update a Trigger

```typescript
await crm.updateEventTrigger('trigger-id', {
  name: 'Updated Name',
  isActive: false,
});
```

### Delete a Trigger

```typescript
await crm.deleteEventTrigger('trigger-id');
```

### Activate/Deactivate

```typescript
// Activate
await crm.triggers.activateTrigger('trigger-id');

// Deactivate
await crm.triggers.deactivateTrigger('trigger-id');
```

## Client-Side Event Listeners

For immediate client-side reactions to events:

```typescript
// Listen for contact creation events
crm.triggers.on('contact.created', (data) => {
  console.log('New contact created:', data);
  // Update UI, show notification, etc.
});

// Emit event (for testing or manual triggers)
crm.triggers.emit('contact.created', {
  email: 'test@example.com',
  firstName: 'John',
});

// Remove listener
const handler = (data) => console.log(data);
crm.triggers.on('contact.created', handler);
crm.triggers.off('contact.created', handler);
```

## Best Practices

### 1. Use Descriptive Names
```typescript
// Good
name: 'Welcome Email for New Leads'

// Bad
name: 'Trigger 1'
```

### 2. Test with Conditions First
Start with specific conditions and expand gradually:

```typescript
conditions: [
  { field: 'status', operator: 'equals', value: 'lead' },
  { field: 'email', operator: 'contains', value: '@' }, // Has email
]
```

### 3. Add Delays for Email Sequences

```typescript
actions: [
  {
    type: 'send_email',
    to: '{{contact.email}}',
    subject: 'Day 2: Getting Started',
    body: '...',
    delayMinutes: 2880, // 48 hours
  }
]
```

### 4. Use Email Templates for Complex Emails

Create reusable templates instead of inline HTML.

### 5. Monitor Trigger Executions

Regularly check trigger execution logs to ensure they're working as expected.

## Common Use Cases

### Lead Nurturing Sequence

```typescript
// Day 0: Welcome email
await crm.triggers.createEmailTrigger({
  name: 'Welcome Email',
  eventType: 'contact.created',
  to: '{{contact.email}}',
  subject: 'Welcome!',
  body: 'Welcome email content...',
});

// Day 2: Follow-up
await crm.triggers.createEmailTrigger({
  name: 'Day 2 Follow-up',
  eventType: 'contact.created',
  to: '{{contact.email}}',
  subject: 'Getting Started Guide',
  body: 'Follow-up content...',
  conditions: [
    { field: 'status', operator: 'equals', value: 'lead' }
  ],
});
```

### Sales Pipeline Automation

```typescript
// Auto-assign tasks when deal enters new stage
await crm.triggers.createTaskTrigger({
  name: 'Qualification Task',
  eventType: 'opportunity.stage_changed',
  taskTitle: 'Qualify opportunity: {{opportunity.title}}',
  priority: 'high',
  dueDays: 1,
  conditions: [
    { field: 'stageId', operator: 'equals', value: 'qualification-stage-id' }
  ],
});
```

### Customer Success

```typescript
// Send thank you after deal won
await crm.triggers.createEmailTrigger({
  name: 'Thank You Email',
  eventType: 'opportunity.won',
  to: '{{contact.email}}',
  subject: 'Thank You for Your Business!',
  body: 'Thank you email content...',
});
```

## Integration Examples

### Slack Notifications

```typescript
await crm.triggers.createWebhookTrigger({
  name: 'Slack: New High-Value Opportunity',
  eventType: 'opportunity.created',
  webhookUrl: 'https://hooks.slack.com/services/YOUR/WEBHOOK',
  conditions: [
    { field: 'value', operator: 'greater_than', value: 50000 }
  ],
});
```

### Zapier Integration

```typescript
await crm.triggers.createWebhookTrigger({
  name: 'Zapier: New Contact Sync',
  eventType: 'contact.created',
  webhookUrl: 'https://hooks.zapier.com/hooks/catch/xxx',
  method: 'POST',
});
```

## Support

For questions or issues:
- Documentation: https://docs.clianta.online
- GitHub: https://github.com/xeet991fx/cliantaSDK/issues
- Email: support@clianta.online
