/**
 * Clianta SDK - Type Definitions
 * @see SDK_VERSION in core/config.ts
 */

// ============================================
// CONFIGURATION TYPES
// ============================================

export interface CliantaConfig {
    /** Project ID (required for config file pattern) */
    projectId?: string;

    /** Backend API endpoint URL */
    apiEndpoint?: string;

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

    /**
     * AutoIdentify scanning mode (default: `'auto'`).
     *
     * The whole point of auto-identify is that the customer drops the SDK
     * into their app and never has to call `tracker.identify()` themselves —
     * regardless of whether they use Clerk, Firebase, NextAuth, a custom
     * JWT in localStorage, or anything else. The default `'auto'` mode is
     * tuned for that contract.
     *
     *  - `'auto'` (default) — Provider globals + JWT-only scan in cookies
     *    and storage, with five safeguards that minimise the "wrong email"
     *    class of false positives:
     *      1. JWT freshness — only use tokens whose `exp` is in the future
     *         and whose `iat` is within the last 30 days.
     *      2. Third-party SDK key blocklist — skips keys belonging to
     *         Intercom, FullStory, HubSpot, Drift, Segment, Pendo,
     *         Userpilot, Mixpanel, Amplitude, etc.
     *      3. Domain-match preference — when multiple email candidates are
     *         found, prefer the one whose domain matches the page hostname.
     *      4. Sticky identification — once identified, the email is cached
     *         in localStorage and preferred on subsequent loads until
     *         storage proves it has changed.
     *      5. Auto-logout — when an auth-shaped storage key gets cleared,
     *         the SDK calls `tracker.reset()` automatically so the next
     *         user on the same browser is correctly anonymous.
     *
     *  - `'providers'` — Provider globals only (Clerk, Firebase, Auth0,
     *    Supabase, Google GIS, MSAL, Cognito, Keycloak, NextAuth probe,
     *    `window.__clianta_user`, `clianta:identify` event). Safest mode,
     *    zero false positives. Lower coverage — won't catch custom JWT
     *    auth flows.
     *
     *  - `'aggressive'` — Adds a plain-JSON deep scan of cookies and
     *    storage on top of `'auto'`. Highest coverage but more
     *    false-positive prone. Use only if `'auto'` doesn't pick up your
     *    auth (e.g. you store the user object as plain JSON without a JWT).
     *
     *  - `'off'` — Disables auto-identify completely. Use this if you want
     *    to call `tracker.identify()` yourself.
     */
    autoIdentifyMode?: 'auto' | 'providers' | 'aggressive' | 'off';

    /**
     * Automatic group (company / account / tenant) association mode.
     * Default: `'auto'`.
     *
     * The SDK will try to figure out which company/account a user belongs to
     * the same way it figures out their email — from JWT claims, auth
     * provider globals, a `window.__clianta_group` global, a
     * `clianta:group` window event, or the user's email domain (skipping
     * personal domains like gmail.com).
     *
     *  - `'auto'`   — try every signal: JWT claims (`org_id`, `tenant_id`,
     *                 `workspace_id`, `account_id`, `company_id`), provider
     *                 globals (Clerk `organizationMemberships`, Cognito
     *                 `custom:organization_id`, Keycloak claims), then
     *                 `window.__clianta_group`, then the email-domain
     *                 fallback.
     *  - `'jwt'`    — only use JWT claims and provider globals (no
     *                 email-domain fallback).
     *  - `'domain'` — only use the email-domain fallback. Use this when
     *                 your business model is "one company per email domain"
     *                 and you don't want JWT-based grouping.
     *  - `'off'`    — disable auto-grouping entirely.
     */
    autoGroupMode?: 'auto' | 'jwt' | 'domain' | 'off';
}

export type PluginName =
    | 'pageView'
    | 'forms'
    | 'scroll'
    | 'clicks'
    | 'engagement'
    | 'downloads'
    | 'exitIntent'
    | 'errors'
    | 'performance'
    | 'popupForms'
    | 'autoIdentify';

// ============================================
// CONSENT TYPES
// ============================================

export interface ConsentConfig {
    /** Default consent state before user action */
    defaultConsent?: ConsentState;

    /** Wait for consent before tracking anything */
    waitForConsent?: boolean;

    /** Storage key for consent state */
    storageKey?: string;

    /** Anonymous mode: track without visitor ID until explicit consent */
    anonymousMode?: boolean;
}

export interface ConsentState {
    /** Consent for analytics/essential tracking */
    analytics?: boolean;

    /** Consent for marketing/advertising tracking */
    marketing?: boolean;

    /** Consent for personalization */
    personalization?: boolean;
}

// ============================================
// EVENT TYPES
// ============================================

export type EventType =
    | 'page_view'
    | 'button_click'
    | 'form_view'
    | 'form_submit'
    | 'form_interaction'
    | 'scroll_depth'
    | 'engagement'
    | 'download'
    | 'exit_intent'
    | 'error'
    | 'performance'
    | 'time_on_page'
    | 'screen_view'  // used by tracker.screen()
    | 'group'        // used by tracker.group()
    | 'custom';

export interface TrackingEvent {
    /** Workspace/project ID */
    workspaceId: string;

    /** Anonymous visitor identifier */
    visitorId: string;

    /** Session identifier */
    sessionId: string;

    /** CRM contact ID (set after a successful identify() call) */
    contactId?: string;

    /** Group ID (set after a successful group() call) */
    groupId?: string;

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

    /** UTM parameters (flat, root-level — matches backend schema) */
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;

    /** ISO timestamp */
    timestamp: string;

    /** SDK version */
    sdkVersion: string;
}

export interface DeviceInfo {
    userAgent: string;
    screen: string;
    language: string;
    timezone?: string;
}

export interface UTMParams {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
}

// ============================================
// IDENTIFY TYPES
// ============================================

// ============================================
// GROUP TYPES
// ============================================

export interface GroupTraits {
    /** Company/account name */
    name?: string;
    /** Industry */
    industry?: string;
    /** Company size */
    employees?: number;
    /** Annual revenue */
    revenue?: number;
    /** Company website */
    website?: string;
    /** Company plan/tier */
    plan?: string;
    /** Additional custom properties */
    [key: string]: unknown;
}

// ============================================
// MIDDLEWARE TYPES
// ============================================

/** Event middleware function — intercept or transform events before they are sent */
export type MiddlewareFn = (event: TrackingEvent, next: () => void) => void;

export interface UserTraits {
    firstName?: string;
    lastName?: string;
    company?: string;
    phone?: string;
    title?: string;
    [key: string]: unknown;
}

export interface IdentifyPayload {
    workspaceId: string;
    visitorId: string;
    email: string;
    properties: UserTraits;
}

// ============================================
// PLUGIN TYPES
// ============================================

export interface Plugin {
    /** Unique plugin name */
    name: PluginName;

    /** Initialize the plugin (can be sync or async) */
    init(tracker: TrackerCore): void | Promise<void>;

    /** Cleanup when plugin is disabled */
    destroy?(): void;
}

export interface PluginFactory {
    (config?: Record<string, unknown>): Plugin;
}

// ============================================
// CORE TRACKER INTERFACE
// ============================================

export interface TrackerCore {
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

    /** Associate the current visitor with a group (company/account) */
    group(groupId: string, traits?: GroupTraits): void;

    /** Merge two visitor identities (e.g., anonymous → logged-in) */
    alias(newId: string, previousId?: string): Promise<boolean>;

    /** Track a screen view (for mobile-first PWAs and SPAs) */
    screen(name: string, properties?: Record<string, unknown>): void;

    /** Register event middleware to intercept/transform events before sending */
    use(middleware: MiddlewareFn): void;

    /** Register a callback to be invoked when the SDK is fully initialized */
    onReady(callback: () => void): void;

    /** Check if the SDK is fully initialized and ready */
    isReady(): boolean;

    /** Register a schema for event validation (active in debug mode) */
    registerEventSchema(
        eventType: string,
        schema: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>
    ): void;

    // Public CRM methods (no API key required, secured by domain whitelist)

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

    /** Destroy the tracker instance, flush pending events, and clean up plugins */
    destroy(): Promise<void>;
}

// ============================================
// TRANSPORT TYPES
// ============================================

export interface TransportConfig {
    apiEndpoint: string;
    maxRetries?: number;
    retryDelay?: number;
    timeout?: number;
}

export interface TransportResult {
    success: boolean;
    status?: number;
    error?: Error;
    /** contactId returned from the identify endpoint */
    contactId?: string;
}

// ============================================
// QUEUE TYPES
// ============================================

export interface QueueConfig {
    batchSize: number;
    flushInterval: number;
    maxQueueSize?: number;
    storageKey?: string;
    persistMode?: 'session' | 'local' | 'none';
}

// ============================================
// LOGGER TYPES
// ============================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
    debug(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
    setLevel(level: LogLevel): void;
}

// ============================================
// CRM TYPES
// ============================================

export interface Contact {
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

export interface Company {
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

export interface Pipeline {
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

export interface PipelineStage {
    _id?: string;
    name: string;
    order: number;
    probability?: number;
    color?: string;
    rottenDays?: number;
}

export interface Task {
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

export interface Activity {
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

export interface Opportunity {
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

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    status: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

// ============================================
// EVENT TRIGGERS & AUTOMATION TYPES
// ============================================

export type TriggerEventType =
    | 'contact.created'
    | 'contact.updated'
    | 'contact.deleted'
    | 'opportunity.created'
    | 'opportunity.updated'
    | 'opportunity.stage_changed'
    | 'opportunity.won'
    | 'opportunity.lost'
    | 'task.created'
    | 'task.completed'
    | 'task.overdue'
    | 'activity.logged'
    | 'form.submitted';

export type TriggerActionType = 'send_email' | 'create_task' | 'update_contact' | 'webhook';

export interface TriggerCondition {
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

export interface EmailTemplate {
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

export interface EmailAction {
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

export interface WebhookAction {
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

export interface TaskAction {
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

export interface ContactUpdateAction {
    /** Action type identifier */
    type: 'update_contact';
    /** Fields to update */
    updates: Partial<Contact>;
}

export type TriggerAction = EmailAction | WebhookAction | TaskAction | ContactUpdateAction;

export interface EventTrigger {
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

export interface TriggerExecution {
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

// ============================================
// READ-BACK / VISITOR DATA TYPES
// ============================================

export interface VisitorProfile {
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

export interface VisitorActivity {
    _id?: string;
    eventType: string;
    eventName: string;
    url: string;
    properties?: Record<string, unknown>;
    timestamp: string;
}

export interface VisitorTimeline {
    visitorId: string;
    contactId?: string;
    firstSeen: string;
    lastSeen: string;
    totalSessions: number;
    totalPageViews: number;
    totalEvents: number;
    totalTimeSpentSeconds: number;
    averageSessionDurationSeconds: number;
    topPages: Array<{ url: string; views: number; avgTimeSeconds?: number }>;
    recentActivities: VisitorActivity[];
    devices: Array<{ userAgent: string; lastSeen: string }>;
}

export interface EngagementMetrics {
    visitorId: string;
    totalTimeOnSiteSeconds: number;
    averageSessionDurationSeconds: number;
    totalPageViews: number;
    totalSessions: number;
    engagementScore: number;
    bounceRate: number;
    lastActiveAt: string;
    topEvents: Array<{ eventType: string; count: number }>;
}

export interface VisitorActivityOptions {
    page?: number;
    limit?: number;
    eventType?: string;
    startDate?: string;
    endDate?: string;
}

export interface ContactTimelineOptions {
    page?: number;
    limit?: number;
    includeEvents?: boolean;
    includeActivities?: boolean;
    includeOpportunities?: boolean;
}

// ============================================
// PUBLIC CRM TYPES (Frontend-safe, no API key)
// ============================================

export interface PublicContactData {
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

export interface PublicContactUpdate {
    firstName?: string;
    lastName?: string;
    company?: string;
    jobTitle?: string;
    phone?: string;
    tags?: string[];
    customFields?: Record<string, unknown>;
}

export interface PublicActivityData {
    contactId: string;
    type: 'call' | 'email' | 'meeting' | 'note' | 'other';
    title: string;
    description?: string;
    direction?: 'inbound' | 'outbound';
    duration?: number;
    emailSubject?: string;
    metadata?: Record<string, unknown>;
}

export interface PublicOpportunityData {
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

export interface PublicFormSubmission {
    fields: Record<string, unknown>;
    metadata?: {
        visitorId?: string;
        sessionId?: string;
        pageUrl?: string;
        referrer?: string;
    };
}

export interface PublicCrmResult {
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
    status?: number;
}
