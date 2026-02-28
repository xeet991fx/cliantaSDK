/**
 * Clianta SDK - Event Triggers Manager
 * Manages event-driven automation and email notifications
 */

/**
 * Event Triggers Manager
 * Handles event-driven automation based on CRM actions
 *
 * Similar to:
 * - Salesforce: Process Builder, Flow Automation
 * - HubSpot: Workflows, Email Sequences
 * - Pipedrive: Workflow Automation
 */
declare class EventTriggersManager {
    private apiEndpoint;
    private workspaceId;
    private authToken?;
    private triggers;
    private listeners;
    constructor(apiEndpoint: string, workspaceId: string, authToken?: string);
    /**
     * Set authentication token
     */
    setAuthToken(token: string): void;
    /**
     * Make authenticated API request
     */
    private request;
    /**
     * Get all event triggers
     */
    getTriggers(): Promise<ApiResponse<EventTrigger[]>>;
    /**
     * Get a single trigger by ID
     */
    getTrigger(triggerId: string): Promise<ApiResponse<EventTrigger>>;
    /**
     * Create a new event trigger
     */
    createTrigger(trigger: Partial<EventTrigger>): Promise<ApiResponse<EventTrigger>>;
    /**
     * Update an existing trigger
     */
    updateTrigger(triggerId: string, updates: Partial<EventTrigger>): Promise<ApiResponse<EventTrigger>>;
    /**
     * Delete a trigger
     */
    deleteTrigger(triggerId: string): Promise<ApiResponse<void>>;
    /**
     * Activate a trigger
     */
    activateTrigger(triggerId: string): Promise<ApiResponse<EventTrigger>>;
    /**
     * Deactivate a trigger
     */
    deactivateTrigger(triggerId: string): Promise<ApiResponse<EventTrigger>>;
    /**
     * Register a local event listener for client-side triggers
     * This allows immediate client-side reactions to events
     */
    on(eventType: TriggerEventType, callback: (data: unknown) => void): void;
    /**
     * Remove an event listener
     */
    off(eventType: TriggerEventType, callback: (data: unknown) => void): void;
    /**
     * Emit an event (client-side only)
     * This will trigger any registered local listeners
     */
    emit(eventType: TriggerEventType, data: unknown): void;
    /**
     * Check if conditions are met for a trigger
     * Supports dynamic field evaluation including custom fields and nested paths
     */
    private evaluateConditions;
    /**
     * Execute actions for a triggered event (client-side preview)
     * Note: Actual execution happens on the backend
     */
    executeActions(trigger: EventTrigger, data: Record<string, unknown>): Promise<void>;
    /**
     * Execute a single action
     */
    private executeAction;
    /**
     * Execute send email action (via backend API)
     */
    private executeSendEmail;
    /**
     * Execute webhook action
     */
    private executeWebhook;
    /**
     * Execute create task action
     */
    private executeCreateTask;
    /**
     * Execute update contact action
     */
    private executeUpdateContact;
    /**
     * Replace variables in a string template
     * Supports syntax like {{contact.email}}, {{opportunity.value}}
     */
    private replaceVariables;
    /**
     * Get nested value from object using dot notation
     * Supports dynamic field access including custom fields
     */
    private getNestedValue;
    /**
     * Extract all available field paths from a data object
     * Useful for dynamic field discovery based on platform-specific attributes
     * @param obj - The data object to extract fields from
     * @param prefix - Internal use for nested paths
     * @param maxDepth - Maximum depth to traverse (default: 3)
     * @returns Array of field paths (e.g., ['email', 'contact.firstName', 'customFields.industry'])
     */
    private extractAvailableFields;
    /**
     * Get available fields from sample data
     * Helps with dynamic field detection for platform-specific attributes
     * @param sampleData - Sample data object to analyze
     * @returns Array of available field paths
     */
    getAvailableFields(sampleData: Record<string, unknown>): string[];
    /**
     * Create a simple email trigger
     * Helper method for common use case
     */
    createEmailTrigger(config: {
        name: string;
        eventType: TriggerEventType;
        to: string;
        subject: string;
        body: string;
        conditions?: TriggerCondition[];
    }): Promise<ApiResponse<EventTrigger>>;
    /**
     * Create a task creation trigger
     */
    createTaskTrigger(config: {
        name: string;
        eventType: TriggerEventType;
        taskTitle: string;
        taskDescription?: string;
        priority?: 'low' | 'medium' | 'high' | 'urgent';
        dueDays?: number;
        conditions?: TriggerCondition[];
    }): Promise<ApiResponse<EventTrigger>>;
    /**
     * Create a webhook trigger
     */
    createWebhookTrigger(config: {
        name: string;
        eventType: TriggerEventType;
        webhookUrl: string;
        method?: 'POST' | 'PUT' | 'PATCH';
        conditions?: TriggerCondition[];
    }): Promise<ApiResponse<EventTrigger>>;
}

/**
 * Clianta SDK - CRM API Client
 * @see SDK_VERSION in core/config.ts
 */

type InboundEventType = 'user.registered' | 'user.updated' | 'user.subscribed' | 'user.unsubscribed' | 'contact.created' | 'contact.updated' | 'purchase.completed';
interface InboundEventPayload {
    /** Event type (e.g. "user.registered") */
    event: InboundEventType;
    /** Contact data — at least email or phone is required */
    contact: {
        email?: string;
        phone?: string;
        firstName?: string;
        lastName?: string;
        company?: string;
        jobTitle?: string;
        tags?: string[];
    };
    /** Optional extra data stored as customFields on the contact */
    data?: Record<string, unknown>;
}
interface InboundEventResult {
    success: boolean;
    contactCreated: boolean;
    contactId?: string;
    event: string;
    error?: string;
}
/**
 * CRM API Client for managing contacts and opportunities
 */
declare class CRMClient {
    private apiEndpoint;
    private workspaceId;
    private authToken?;
    private apiKey?;
    triggers: EventTriggersManager;
    constructor(apiEndpoint: string, workspaceId: string, authToken?: string, apiKey?: string);
    /**
     * Set authentication token for API requests (user JWT)
     */
    setAuthToken(token: string): void;
    /**
     * Set workspace API key for server-to-server requests.
     * Use this instead of setAuthToken when integrating from an external app.
     */
    setApiKey(key: string): void;
    /**
     * Validate required parameter exists
     * @throws {Error} if value is null/undefined or empty string
     */
    private validateRequired;
    /**
     * Make authenticated API request
     */
    private request;
    /**
     * Send an inbound event from an external app (e.g. user signup on client website).
     * Requires the client to be initialized with an API key via setApiKey() or the constructor.
     *
     * The contact is upserted in the CRM and matching workflow automations fire automatically.
     *
     * @example
     * const crm = new CRMClient('http://localhost:5000', 'WORKSPACE_ID');
     * crm.setApiKey('mm_live_...');
     *
     * await crm.sendEvent({
     *   event: 'user.registered',
     *   contact: { email: 'alice@example.com', firstName: 'Alice' },
     *   data: { plan: 'free', signupSource: 'homepage' },
     * });
     */
    sendEvent(payload: InboundEventPayload): Promise<InboundEventResult>;
    /**
     * Get all contacts with pagination
     */
    getContacts(params?: {
        page?: number;
        limit?: number;
        search?: string;
        status?: string;
    }): Promise<ApiResponse<PaginatedResponse<Contact>>>;
    /**
     * Get a single contact by ID
     */
    getContact(contactId: string): Promise<ApiResponse<Contact>>;
    /**
     * Create a new contact
     */
    createContact(contact: Partial<Contact>): Promise<ApiResponse<Contact>>;
    /**
     * Update an existing contact
     */
    updateContact(contactId: string, updates: Partial<Contact>): Promise<ApiResponse<Contact>>;
    /**
     * Delete a contact
     */
    deleteContact(contactId: string): Promise<ApiResponse<void>>;
    /**
     * Get all opportunities with pagination
     */
    getOpportunities(params?: {
        page?: number;
        limit?: number;
        pipelineId?: string;
        stageId?: string;
    }): Promise<ApiResponse<PaginatedResponse<Opportunity>>>;
    /**
     * Get a single opportunity by ID
     */
    getOpportunity(opportunityId: string): Promise<ApiResponse<Opportunity>>;
    /**
     * Create a new opportunity
     */
    createOpportunity(opportunity: Partial<Opportunity>): Promise<ApiResponse<Opportunity>>;
    /**
     * Update an existing opportunity
     */
    updateOpportunity(opportunityId: string, updates: Partial<Opportunity>): Promise<ApiResponse<Opportunity>>;
    /**
     * Delete an opportunity
     */
    deleteOpportunity(opportunityId: string): Promise<ApiResponse<void>>;
    /**
     * Move opportunity to a different stage
     */
    moveOpportunity(opportunityId: string, stageId: string): Promise<ApiResponse<Opportunity>>;
    /**
     * Get all companies with pagination
     */
    getCompanies(params?: {
        page?: number;
        limit?: number;
        search?: string;
        status?: string;
        industry?: string;
    }): Promise<ApiResponse<PaginatedResponse<Company>>>;
    /**
     * Get a single company by ID
     */
    getCompany(companyId: string): Promise<ApiResponse<Company>>;
    /**
     * Create a new company
     */
    createCompany(company: Partial<Company>): Promise<ApiResponse<Company>>;
    /**
     * Update an existing company
     */
    updateCompany(companyId: string, updates: Partial<Company>): Promise<ApiResponse<Company>>;
    /**
     * Delete a company
     */
    deleteCompany(companyId: string): Promise<ApiResponse<void>>;
    /**
     * Get contacts belonging to a company
     */
    getCompanyContacts(companyId: string, params?: {
        page?: number;
        limit?: number;
    }): Promise<ApiResponse<PaginatedResponse<Contact>>>;
    /**
     * Get deals/opportunities belonging to a company
     */
    getCompanyDeals(companyId: string, params?: {
        page?: number;
        limit?: number;
    }): Promise<ApiResponse<PaginatedResponse<Opportunity>>>;
    /**
     * Get all pipelines
     */
    getPipelines(): Promise<ApiResponse<Pipeline[]>>;
    /**
     * Get a single pipeline by ID
     */
    getPipeline(pipelineId: string): Promise<ApiResponse<Pipeline>>;
    /**
     * Create a new pipeline
     */
    createPipeline(pipeline: Partial<Pipeline>): Promise<ApiResponse<Pipeline>>;
    /**
     * Update an existing pipeline
     */
    updatePipeline(pipelineId: string, updates: Partial<Pipeline>): Promise<ApiResponse<Pipeline>>;
    /**
     * Delete a pipeline
     */
    deletePipeline(pipelineId: string): Promise<ApiResponse<void>>;
    /**
     * Get all tasks with pagination
     */
    getTasks(params?: {
        page?: number;
        limit?: number;
        status?: string;
        priority?: string;
        contactId?: string;
        companyId?: string;
        opportunityId?: string;
    }): Promise<ApiResponse<PaginatedResponse<Task>>>;
    /**
     * Get a single task by ID
     */
    getTask(taskId: string): Promise<ApiResponse<Task>>;
    /**
     * Create a new task
     */
    createTask(task: Partial<Task>): Promise<ApiResponse<Task>>;
    /**
     * Update an existing task
     */
    updateTask(taskId: string, updates: Partial<Task>): Promise<ApiResponse<Task>>;
    /**
     * Mark a task as completed
     */
    completeTask(taskId: string): Promise<ApiResponse<Task>>;
    /**
     * Delete a task
     */
    deleteTask(taskId: string): Promise<ApiResponse<void>>;
    /**
     * Get activities for a contact
     */
    getContactActivities(contactId: string, params?: {
        page?: number;
        limit?: number;
        type?: string;
    }): Promise<ApiResponse<PaginatedResponse<Activity>>>;
    /**
     * Get activities for an opportunity/deal
     */
    getOpportunityActivities(opportunityId: string, params?: {
        page?: number;
        limit?: number;
        type?: string;
    }): Promise<ApiResponse<PaginatedResponse<Activity>>>;
    /**
     * Create a new activity
     */
    createActivity(activity: Partial<Activity>): Promise<ApiResponse<Activity>>;
    /**
     * Update an existing activity
     */
    updateActivity(activityId: string, updates: Partial<Activity>): Promise<ApiResponse<Activity>>;
    /**
     * Delete an activity
     */
    deleteActivity(activityId: string): Promise<ApiResponse<void>>;
    /**
     * Log a call activity
     */
    logCall(data: {
        contactId?: string;
        opportunityId?: string;
        direction: 'inbound' | 'outbound';
        duration?: number;
        outcome?: string;
        notes?: string;
    }): Promise<ApiResponse<Activity>>;
    /**
     * Log a meeting activity
     */
    logMeeting(data: {
        contactId?: string;
        opportunityId?: string;
        title: string;
        duration?: number;
        outcome?: string;
        notes?: string;
    }): Promise<ApiResponse<Activity>>;
    /**
     * Add a note to a contact or opportunity
     */
    addNote(data: {
        contactId?: string;
        opportunityId?: string;
        content: string;
    }): Promise<ApiResponse<Activity>>;
    /**
     * Get all email templates
     */
    getEmailTemplates(params?: {
        page?: number;
        limit?: number;
    }): Promise<ApiResponse<PaginatedResponse<EmailTemplate>>>;
    /**
     * Get a single email template by ID
     */
    getEmailTemplate(templateId: string): Promise<ApiResponse<EmailTemplate>>;
    /**
     * Create a new email template
     */
    createEmailTemplate(template: Partial<EmailTemplate>): Promise<ApiResponse<EmailTemplate>>;
    /**
     * Update an email template
     */
    updateEmailTemplate(templateId: string, updates: Partial<EmailTemplate>): Promise<ApiResponse<EmailTemplate>>;
    /**
     * Delete an email template
     */
    deleteEmailTemplate(templateId: string): Promise<ApiResponse<void>>;
    /**
     * Send an email using a template
     */
    sendEmail(data: {
        to: string;
        templateId?: string;
        subject?: string;
        body?: string;
        cc?: string[];
        bcc?: string[];
        variables?: Record<string, unknown>;
        contactId?: string;
    }): Promise<ApiResponse<{
        messageId: string;
    }>>;
    /**
     * Get a contact by email address.
     * Returns the first matching contact from a search query.
     */
    getContactByEmail(email: string): Promise<ApiResponse<PaginatedResponse<Contact>>>;
    /**
     * Get activity timeline for a contact
     */
    getContactActivity(contactId: string, params?: {
        page?: number;
        limit?: number;
        type?: string;
        startDate?: string;
        endDate?: string;
    }): Promise<ApiResponse<PaginatedResponse<Activity>>>;
    /**
     * Get engagement metrics for a contact (via their linked visitor data)
     */
    getContactEngagement(contactId: string): Promise<ApiResponse<{
        totalTimeOnSiteSeconds: number;
        averageSessionDurationSeconds: number;
        totalPageViews: number;
        totalSessions: number;
        engagementScore: number;
        lastActiveAt: string;
    }>>;
    /**
     * Get a full timeline for a contact including events, activities, and opportunities
     */
    getContactTimeline(contactId: string, params?: {
        page?: number;
        limit?: number;
    }): Promise<ApiResponse<PaginatedResponse<{
        type: 'event' | 'activity' | 'opportunity' | 'note';
        title: string;
        description?: string;
        timestamp: string;
        metadata?: Record<string, unknown>;
    }>>>;
    /**
     * Search contacts with advanced filters
     */
    searchContacts(query: string, filters?: {
        status?: string;
        lifecycleStage?: string;
        source?: string;
        tags?: string[];
        page?: number;
        limit?: number;
    }): Promise<ApiResponse<PaginatedResponse<Contact>>>;
    /**
     * List all webhook subscriptions
     */
    listWebhooks(params?: {
        page?: number;
        limit?: number;
    }): Promise<ApiResponse<PaginatedResponse<{
        _id: string;
        url: string;
        events: string[];
        isActive: boolean;
        createdAt: string;
    }>>>;
    /**
     * Create a new webhook subscription
     */
    createWebhook(data: {
        url: string;
        events: string[];
        secret?: string;
    }): Promise<ApiResponse<{
        _id: string;
        url: string;
        events: string[];
        isActive: boolean;
    }>>;
    /**
     * Delete a webhook subscription
     */
    deleteWebhook(webhookId: string): Promise<ApiResponse<void>>;
    /**
     * Get all event triggers
     */
    getEventTriggers(): Promise<ApiResponse<EventTrigger[]>>;
    /**
     * Create a new event trigger
     */
    createEventTrigger(trigger: Partial<EventTrigger>): Promise<ApiResponse<EventTrigger>>;
    /**
     * Update an event trigger
     */
    updateEventTrigger(triggerId: string, updates: Partial<EventTrigger>): Promise<ApiResponse<EventTrigger>>;
    /**
     * Delete an event trigger
     */
    deleteEventTrigger(triggerId: string): Promise<ApiResponse<void>>;
}

/**
 * Clianta SDK - Type Definitions
 * @see SDK_VERSION in core/config.ts
 */
interface CliantaConfig {
    /** Project ID (required for config file pattern) */
    projectId?: string;
    /** Backend API endpoint URL */
    apiEndpoint?: string;
    /** Auth token for server-side API access (user JWT) */
    authToken?: string;
    /** Workspace API key for server-to-server access (use instead of authToken for external apps) */
    apiKey?: string;
    /** Enable debug mode with verbose logging */
    debug?: boolean;
    /** Automatically track page views on load and navigation */
    autoPageView?: boolean;
    /** Plugins to enable (default: all core plugins) */
    plugins?: PluginName[];
    /** Session timeout in milliseconds (default: 30 minutes) */
    sessionTimeout?: number;
    /** Maximum events to batch before sending (default: 10) */
    batchSize?: number;
    /** Interval to flush events in milliseconds (default: 5000) */
    flushInterval?: number;
    /** Consent configuration */
    consent?: ConsentConfig;
    /** Cookie domain for cross-subdomain tracking */
    cookieDomain?: string;
    /** Use cookies instead of localStorage for visitor ID */
    useCookies?: boolean;
    /** Cookie-less mode: use sessionStorage only (no persistent storage) */
    cookielessMode?: boolean;
    /** Queue persistence mode: 'session' (default), 'local' (survives browser restart), 'none' */
    persistMode?: 'session' | 'local' | 'none';
}
type PluginName = 'pageView' | 'forms' | 'scroll' | 'clicks' | 'engagement' | 'downloads' | 'exitIntent' | 'errors' | 'performance' | 'popupForms';
interface ConsentConfig {
    /** Default consent state before user action */
    defaultConsent?: ConsentState;
    /** Wait for consent before tracking anything */
    waitForConsent?: boolean;
    /** Storage key for consent state */
    storageKey?: string;
    /** Anonymous mode: track without visitor ID until explicit consent */
    anonymousMode?: boolean;
}
interface ConsentState {
    /** Consent for analytics/essential tracking */
    analytics?: boolean;
    /** Consent for marketing/advertising tracking */
    marketing?: boolean;
    /** Consent for personalization */
    personalization?: boolean;
}
type EventType = 'page_view' | 'button_click' | 'form_view' | 'form_submit' | 'form_interaction' | 'scroll_depth' | 'engagement' | 'download' | 'exit_intent' | 'error' | 'performance' | 'time_on_page' | 'custom';
interface TrackingEvent {
    /** Workspace/project ID */
    workspaceId: string;
    /** Anonymous visitor identifier */
    visitorId: string;
    /** Session identifier */
    sessionId: string;
    /** Event type category */
    eventType: EventType;
    /** Human-readable event name */
    eventName: string;
    /** Current page URL */
    url: string;
    /** Referrer URL */
    referrer?: string;
    /** Event properties/metadata */
    properties: Record<string, unknown>;
    /** Device information */
    device: DeviceInfo;
    /** UTM parameters */
    utm?: UTMParams;
    /** ISO timestamp */
    timestamp: string;
    /** SDK version */
    sdkVersion: string;
}
interface DeviceInfo {
    userAgent: string;
    screen: string;
    language: string;
    timezone?: string;
}
interface UTMParams {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
}
interface UserTraits {
    firstName?: string;
    lastName?: string;
    company?: string;
    phone?: string;
    title?: string;
    [key: string]: unknown;
}
interface Plugin {
    /** Unique plugin name */
    name: PluginName;
    /** Initialize the plugin (can be sync or async) */
    init(tracker: TrackerCore): void | Promise<void>;
    /** Cleanup when plugin is disabled */
    destroy?(): void;
}
interface TrackerCore {
    /** Track a custom event */
    track(eventType: EventType | string, eventName: string, properties?: Record<string, unknown>): void;
    /** Identify a visitor — returns the contactId if successful */
    identify(email: string, traits?: UserTraits): Promise<string | null>;
    /** Track a page view */
    page(name?: string, properties?: Record<string, unknown>): void;
    /** Update consent state */
    consent(state: ConsentState): void;
    /** Toggle debug mode */
    debug(enabled: boolean): void;
    /** Get visitor ID */
    getVisitorId(): string;
    /** Get session ID */
    getSessionId(): string;
    /** Force flush event queue */
    flush(): Promise<void>;
    /** Reset visitor (for logout) */
    reset(): void;
    /** Get current configuration */
    getConfig(): CliantaConfig;
    /** Get workspace ID */
    getWorkspaceId(): string;
    /** Delete all stored user data (GDPR right-to-erasure) */
    deleteData(): void;
    /** Get current consent state */
    getConsentState(): ConsentState;
    /** Get the current visitor's profile from the CRM */
    getVisitorProfile(): Promise<VisitorProfile | null>;
    /** Get the current visitor's recent activity */
    getVisitorActivity(options?: VisitorActivityOptions): Promise<{
        data: VisitorActivity[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    } | null>;
    /** Get a summarized journey timeline for the current visitor */
    getVisitorTimeline(): Promise<VisitorTimeline | null>;
    /** Get engagement metrics for the current visitor */
    getVisitorEngagement(): Promise<EngagementMetrics | null>;
    /** Send a server-side inbound event (requires apiKey in config) */
    sendEvent(payload: InboundEventPayload): Promise<InboundEventResult>;
    /** Create or update a contact by email (upsert) */
    createContact(data: PublicContactData): Promise<PublicCrmResult>;
    /** Update an existing contact by ID (limited fields) */
    updateContact(contactId: string, data: PublicContactUpdate): Promise<PublicCrmResult>;
    /** Submit a form — creates/updates contact from form data */
    submitForm(formId: string, data: PublicFormSubmission): Promise<PublicCrmResult>;
    /** Log an activity linked to a contact (append-only) */
    logActivity(data: PublicActivityData): Promise<PublicCrmResult>;
    /** Create an opportunity (e.g., from "Request Demo" forms) */
    createOpportunity(data: PublicOpportunityData): Promise<PublicCrmResult>;
}
interface Contact {
    _id?: string;
    workspaceId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    jobTitle?: string;
    phone?: string;
    status?: 'lead' | 'contact' | 'customer';
    lifecycleStage?: 'subscriber' | 'lead' | 'mql' | 'sql' | 'opportunity' | 'customer' | 'evangelist';
    source?: string;
    tags?: string[];
    leadScore?: number;
    customFields?: Record<string, unknown>;
    companyId?: string;
    assignedTo?: string;
    createdAt?: string;
    updatedAt?: string;
}
interface Company {
    _id?: string;
    workspaceId: string;
    name: string;
    industry?: string;
    website?: string;
    phone?: string;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        postalCode?: string;
    };
    companySize?: string;
    annualRevenue?: number;
    status?: 'prospect' | 'active' | 'inactive' | 'churned';
    accountTier?: 'enterprise' | 'mid-market' | 'smb';
    isTargetAccount?: boolean;
    tags?: string[];
    customFields?: Record<string, unknown>;
    assignedTo?: string;
    createdAt?: string;
    updatedAt?: string;
}
interface Pipeline {
    _id?: string;
    workspaceId: string;
    name: string;
    description?: string;
    stages: PipelineStage[];
    isDefault?: boolean;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
}
interface PipelineStage {
    _id?: string;
    name: string;
    order: number;
    probability?: number;
    color?: string;
    rottenDays?: number;
}
interface Task {
    _id?: string;
    workspaceId: string;
    title: string;
    description?: string;
    status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    dueDate?: string;
    reminderDate?: string;
    completedAt?: string;
    tags?: string[];
    relatedContactId?: string;
    relatedCompanyId?: string;
    relatedOpportunityId?: string;
    assignedTo?: string;
    createdAt?: string;
    updatedAt?: string;
}
interface Activity {
    _id?: string;
    workspaceId: string;
    type: 'call' | 'email' | 'meeting' | 'note' | 'task' | 'other';
    title: string;
    description?: string;
    direction?: 'inbound' | 'outbound';
    duration?: number;
    outcome?: string;
    emailSubject?: string;
    emailBody?: string;
    metadata?: Record<string, unknown>;
    contactId?: string;
    companyId?: string;
    opportunityId?: string;
    userId?: string;
    createdAt?: string;
    updatedAt?: string;
}
interface Opportunity {
    _id?: string;
    workspaceId: string;
    contactId: string;
    companyId?: string;
    pipelineId: string;
    stageId: string;
    title: string;
    value?: number;
    currency?: string;
    probability?: number;
    expectedCloseDate?: string;
    status?: 'open' | 'won' | 'lost';
    priority?: 'low' | 'medium' | 'high';
    lostReason?: string;
    customFields?: Record<string, unknown>;
    assignedTo?: string;
    createdAt?: string;
    updatedAt?: string;
}
interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    status: number;
}
interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}
type TriggerEventType = 'contact.created' | 'contact.updated' | 'contact.deleted' | 'opportunity.created' | 'opportunity.updated' | 'opportunity.stage_changed' | 'opportunity.won' | 'opportunity.lost' | 'task.created' | 'task.completed' | 'task.overdue' | 'activity.logged' | 'form.submitted';
interface TriggerCondition {
    /**
     * Field to check - supports dynamic field names including custom fields
     * Examples: 'status', 'lifecycleStage', 'leadScore', 'customFields.industry'
     * Use dot notation for nested fields: 'contact.email', 'customFields.accountType'
     */
    field: string;
    /** Operator for comparison */
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
    /** Value to compare against */
    value: unknown;
}
interface EmailTemplate {
    /** Template ID */
    _id?: string;
    /** Template name */
    name: string;
    /** Email subject line (supports variables) */
    subject: string;
    /** Email body (supports HTML and variables) */
    body: string;
    /** Variables available in this template */
    variables?: string[];
    /** Sender email address */
    fromEmail?: string;
    /** Sender name */
    fromName?: string;
}
interface EmailAction {
    /** Action type identifier */
    type: 'send_email';
    /** Email template ID or inline template */
    templateId?: string;
    /** Inline email subject (if not using template) */
    subject?: string;
    /** Inline email body (if not using template) */
    body?: string;
    /** Recipient email (supports variables like {{contact.email}}) */
    to: string;
    /** CC recipients */
    cc?: string[];
    /** BCC recipients */
    bcc?: string[];
    /** Sender email */
    from?: string;
    /** Delay in minutes before sending */
    delayMinutes?: number;
}
interface WebhookAction {
    /** Action type identifier */
    type: 'webhook';
    /** Webhook URL to call */
    url: string;
    /** HTTP method */
    method: 'POST' | 'PUT' | 'PATCH';
    /** Custom headers */
    headers?: Record<string, string>;
    /** Request body template (supports variables) */
    body?: string;
}
interface TaskAction {
    /** Action type identifier */
    type: 'create_task';
    /** Task title (supports variables) */
    title: string;
    /** Task description */
    description?: string;
    /** Task priority */
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    /** Due date in days from trigger */
    dueDays?: number;
    /** Assign to user ID */
    assignedTo?: string;
}
interface ContactUpdateAction {
    /** Action type identifier */
    type: 'update_contact';
    /** Fields to update */
    updates: Partial<Contact>;
}
type TriggerAction = EmailAction | WebhookAction | TaskAction | ContactUpdateAction;
interface EventTrigger {
    /** Trigger ID */
    _id?: string;
    /** Workspace ID */
    workspaceId: string;
    /** Trigger name */
    name: string;
    /** Description of what this trigger does */
    description?: string;
    /** Event type that activates this trigger */
    eventType: TriggerEventType;
    /** Conditions that must be met for trigger to fire */
    conditions?: TriggerCondition[];
    /** Actions to execute when trigger fires */
    actions: TriggerAction[];
    /** Whether this trigger is active */
    isActive?: boolean;
    /** Created timestamp */
    createdAt?: string;
    /** Updated timestamp */
    updatedAt?: string;
}
interface TriggerExecution {
    /** Execution ID */
    _id?: string;
    /** Trigger ID that was executed */
    triggerId: string;
    /** Event that triggered the execution */
    eventType: TriggerEventType;
    /** Entity ID that triggered the event */
    entityId: string;
    /** Execution status */
    status: 'pending' | 'success' | 'failed';
    /** Error message if failed */
    error?: string;
    /** Actions executed */
    actionsExecuted: number;
    /** Execution timestamp */
    executedAt: string;
}
interface VisitorProfile {
    visitorId: string;
    contactId?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    jobTitle?: string;
    phone?: string;
    status?: string;
    lifecycleStage?: string;
    tags?: string[];
    leadScore?: number;
    firstSeen?: string;
    lastSeen?: string;
    sessionCount?: number;
    pageViewCount?: number;
    totalTimeSpent?: number;
    customFields?: Record<string, unknown>;
}
interface VisitorActivity {
    _id?: string;
    eventType: string;
    eventName: string;
    url: string;
    properties?: Record<string, unknown>;
    timestamp: string;
}
interface VisitorTimeline {
    visitorId: string;
    contactId?: string;
    firstSeen: string;
    lastSeen: string;
    totalSessions: number;
    totalPageViews: number;
    totalEvents: number;
    totalTimeSpentSeconds: number;
    averageSessionDurationSeconds: number;
    topPages: Array<{
        url: string;
        views: number;
        avgTimeSeconds?: number;
    }>;
    recentActivities: VisitorActivity[];
    devices: Array<{
        userAgent: string;
        lastSeen: string;
    }>;
}
interface EngagementMetrics {
    visitorId: string;
    totalTimeOnSiteSeconds: number;
    averageSessionDurationSeconds: number;
    totalPageViews: number;
    totalSessions: number;
    engagementScore: number;
    bounceRate: number;
    lastActiveAt: string;
    topEvents: Array<{
        eventType: string;
        count: number;
    }>;
}
interface VisitorActivityOptions {
    page?: number;
    limit?: number;
    eventType?: string;
    startDate?: string;
    endDate?: string;
}
interface ContactTimelineOptions {
    page?: number;
    limit?: number;
    includeEvents?: boolean;
    includeActivities?: boolean;
    includeOpportunities?: boolean;
}
interface PublicContactData {
    email: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    jobTitle?: string;
    phone?: string;
    source?: string;
    tags?: string[];
    customFields?: Record<string, unknown>;
}
interface PublicContactUpdate {
    firstName?: string;
    lastName?: string;
    company?: string;
    jobTitle?: string;
    phone?: string;
    tags?: string[];
    customFields?: Record<string, unknown>;
}
interface PublicActivityData {
    contactId: string;
    type: 'call' | 'email' | 'meeting' | 'note' | 'other';
    title: string;
    description?: string;
    direction?: 'inbound' | 'outbound';
    duration?: number;
    emailSubject?: string;
    metadata?: Record<string, unknown>;
}
interface PublicOpportunityData {
    title: string;
    contactId: string;
    pipelineId: string;
    stageId: string;
    value?: number;
    currency?: string;
    description?: string;
    expectedCloseDate?: string;
    customFields?: Record<string, unknown>;
}
interface PublicFormSubmission {
    fields: Record<string, unknown>;
    metadata?: {
        visitorId?: string;
        sessionId?: string;
        pageUrl?: string;
        referrer?: string;
    };
}
interface PublicCrmResult {
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
    status?: number;
}

/**
 * Main Clianta Tracker Class
 */
declare class Tracker implements TrackerCore {
    private workspaceId;
    private config;
    private transport;
    private queue;
    private plugins;
    private visitorId;
    private sessionId;
    private isInitialized;
    private consentManager;
    /** contactId after a successful identify() call */
    private contactId;
    /** Pending identify retry on next flush */
    private pendingIdentify;
    /** Registered event schemas for validation */
    private eventSchemas;
    constructor(workspaceId: string, userConfig?: CliantaConfig);
    /**
     * Create visitor ID based on storage mode
     */
    private createVisitorId;
    /**
     * Create session ID
     */
    private createSessionId;
    /**
     * Handle consent state changes
     */
    private onConsentChange;
    /**
     * Initialize enabled plugins
     * Handles both sync and async plugin init methods
     */
    private initPlugins;
    /**
     * Track a custom event
     */
    track(eventType: EventType | string, eventName: string, properties?: Record<string, unknown>): void;
    /**
     * Track a page view
     */
    page(name?: string, properties?: Record<string, unknown>): void;
    /**
     * Identify a visitor.
     * Links the anonymous visitorId to a CRM contact and returns the contactId.
     * All subsequent track() calls will include the contactId automatically.
     */
    identify(email: string, traits?: UserTraits): Promise<string | null>;
    /**
     * Send a server-side inbound event via the API key endpoint.
     * Convenience proxy to CRMClient.sendEvent() — requires apiKey in config.
     */
    sendEvent(payload: InboundEventPayload): Promise<InboundEventResult>;
    /**
     * Get the current visitor's profile from the CRM.
     * Returns visitor data and linked contact info if identified.
     * Only returns data for the current visitor (privacy-safe for frontend).
     */
    getVisitorProfile(): Promise<VisitorProfile | null>;
    /**
     * Get the current visitor's recent activity/events.
     * Returns paginated list of tracking events for this visitor.
     */
    getVisitorActivity(options?: VisitorActivityOptions): Promise<{
        data: VisitorActivity[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    } | null>;
    /**
     * Get a summarized journey timeline for the current visitor.
     * Includes top pages, sessions, time spent, and recent activities.
     */
    getVisitorTimeline(): Promise<VisitorTimeline | null>;
    /**
     * Get engagement metrics for the current visitor.
     * Includes time on site, page views, bounce rate, and engagement score.
     */
    getVisitorEngagement(): Promise<EngagementMetrics | null>;
    /**
     * Retry pending identify call
     */
    private retryPendingIdentify;
    /**
     * Update consent state
     */
    consent(state: ConsentState): void;
    /**
     * Get current consent state
     */
    getConsentState(): ConsentState;
    /**
     * Toggle debug mode
     */
    debug(enabled: boolean): void;
    /**
     * Register a schema for event validation.
     * When debug mode is enabled, events will be validated against registered schemas.
     *
     * @example
     * tracker.registerEventSchema('purchase', {
     *   productId: 'string',
     *   price: 'number',
     *   quantity: 'number',
     * });
     */
    registerEventSchema(eventType: string, schema: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>): void;
    /**
     * Validate event properties against a registered schema (debug mode only)
     */
    private validateEventSchema;
    /**
     * Get visitor ID
     */
    getVisitorId(): string;
    /**
     * Get session ID
     */
    getSessionId(): string;
    /**
     * Get workspace ID
     */
    getWorkspaceId(): string;
    /**
     * Get current configuration
     */
    getConfig(): CliantaConfig;
    /**
     * Force flush event queue
     */
    flush(): Promise<void>;
    /**
     * Reset visitor and session (for logout)
     */
    reset(): void;
    /**
     * Delete all stored user data (GDPR right-to-erasure)
     */
    deleteData(): void;
    /**
     * Create or update a contact by email (upsert).
     * Secured by domain whitelist — no API key needed.
     */
    createContact(data: PublicContactData): Promise<PublicCrmResult>;
    /**
     * Update an existing contact by ID (limited fields only).
     */
    updateContact(contactId: string, data: PublicContactUpdate): Promise<PublicCrmResult>;
    /**
     * Submit a form — creates/updates contact from form data.
     */
    submitForm(formId: string, data: PublicFormSubmission): Promise<PublicCrmResult>;
    /**
     * Log an activity linked to a contact (append-only).
     */
    logActivity(data: PublicActivityData): Promise<PublicCrmResult>;
    /**
     * Create an opportunity (e.g., from "Request Demo" forms).
     */
    createOpportunity(data: PublicOpportunityData): Promise<PublicCrmResult>;
    /**
     * Internal helper for public CRM API calls.
     */
    private publicCrmRequest;
    /**
     * Destroy tracker and cleanup
     */
    destroy(): Promise<void>;
}

/**
 * Clianta SDK - Consent Manager
 * Manages consent state and event buffering for GDPR/CCPA compliance
 * @see SDK_VERSION in core/config.ts
 */

type ConsentChangeCallback = (state: ConsentState, previous: ConsentState) => void;
interface ConsentManagerConfig extends ConsentConfig {
    onConsentChange?: ConsentChangeCallback;
}
/**
 * Manages user consent state for tracking
 */
declare class ConsentManager {
    private state;
    private config;
    private eventBuffer;
    private callbacks;
    private hasExplicitConsent;
    constructor(config?: ConsentManagerConfig);
    /**
     * Grant consent for specified categories
     */
    grant(categories: Partial<ConsentState>): void;
    /**
     * Revoke consent for specified categories
     */
    revoke(categories: (keyof ConsentState)[]): void;
    /**
     * Update entire consent state
     */
    update(state: ConsentState): void;
    /**
     * Reset consent to default (clear stored consent)
     */
    reset(): void;
    /**
     * Get current consent state
     */
    getState(): ConsentState;
    /**
     * Check if a specific consent category is granted
     */
    hasConsent(category: keyof ConsentState): boolean;
    /**
     * Check if analytics consent is granted (most common check)
     */
    canTrack(): boolean;
    /**
     * Check if explicit consent has been given
     */
    hasExplicit(): boolean;
    /**
     * Check if there's stored consent
     */
    hasStored(): boolean;
    /**
     * Buffer an event (for waitForConsent mode)
     */
    bufferEvent(event: TrackingEvent): void;
    /**
     * Get and clear buffered events
     */
    flushBuffer(): TrackingEvent[];
    /**
     * Get buffered event count
     */
    getBufferSize(): number;
    /**
     * Register a consent change callback
     */
    onChange(callback: ConsentChangeCallback): () => void;
    /**
     * Notify all callbacks of consent change
     */
    private notifyChange;
}

/**
 * Clianta SDK - Consent Storage
 * Handles persistence of consent state
 * @see SDK_VERSION in core/config.ts
 */

interface StoredConsent {
    state: ConsentState;
    timestamp: number;
    version: number;
}

/**
 * Clianta SDK - Configuration
 * @see SDK_VERSION in core/config.ts
 */

/** SDK Version */
declare const SDK_VERSION = "1.4.0";

/**
 * Clianta SDK
 * Professional CRM and tracking SDK for lead generation
 * @see SDK_VERSION in core/config.ts
 */

/**
 * Initialize or get the Clianta tracker instance
 *
 * @example
 * // Simple initialization
 * const tracker = clianta('your-workspace-id');
 *
 * @example
 * // With configuration
 * const tracker = clianta('your-workspace-id', {
 *   debug: true,
 *   plugins: ['pageView', 'forms', 'scroll'],
 * });
 *
 * @example
 * // With consent configuration
 * const tracker = clianta('your-workspace-id', {
 *   consent: {
 *     waitForConsent: true,
 *     anonymousMode: true,
 *   },
 *   cookielessMode: true, // GDPR-friendly mode
 * });
 */
declare function clianta(workspaceId: string, config?: CliantaConfig): TrackerCore;

export { CRMClient, ConsentManager, EventTriggersManager, SDK_VERSION, Tracker, clianta, clianta as default };
export type { Activity, ApiResponse, CliantaConfig, Company, ConsentChangeCallback, ConsentConfig, ConsentManagerConfig, ConsentState, Contact, ContactTimelineOptions, ContactUpdateAction, EmailAction, EmailTemplate, EngagementMetrics, EventTrigger, EventType, InboundEventPayload, InboundEventResult, InboundEventType, Opportunity, PaginatedResponse, Pipeline, PipelineStage, Plugin, PluginName, PublicActivityData, PublicContactData, PublicContactUpdate, PublicCrmResult, PublicFormSubmission, PublicOpportunityData, StoredConsent, Task, TaskAction, TrackerCore, TrackingEvent, TriggerAction, TriggerCondition, TriggerEventType, TriggerExecution, UserTraits, VisitorActivity, VisitorActivityOptions, VisitorProfile, VisitorTimeline, WebhookAction };
