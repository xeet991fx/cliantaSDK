/**
 * Clianta SDK - Type Definitions
 * @see SDK_VERSION in core/config.ts
 */
interface CliantaConfig {
    /** Project ID (required for config file pattern) */
    projectId?: string;
    /** Backend API endpoint URL */
    apiEndpoint?: string;
    /** Auth token for server-side API access */
    authToken?: string;
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
    /** Identify a visitor */
    identify(email: string, traits?: UserTraits): void;
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

/**
 * Clianta SDK - Main Tracker Class
 * @see SDK_VERSION in core/config.ts
 */

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
     * Identify a visitor
     */
    identify(email: string, traits?: UserTraits): Promise<void>;
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
     * Destroy tracker and cleanup
     */
    destroy(): Promise<void>;
}

/**
 * Clianta SDK - CRM API Client
 * @see SDK_VERSION in core/config.ts
 */

/**
 * CRM API Client for managing contacts and opportunities
 */
declare class CRMClient {
    private apiEndpoint;
    private workspaceId;
    private authToken?;
    constructor(apiEndpoint: string, workspaceId: string, authToken?: string);
    /**
     * Set authentication token for API requests
     */
    setAuthToken(token: string): void;
    /**
     * Make authenticated API request
     */
    private request;
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
declare const SDK_VERSION = "1.2.0";

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

export { CRMClient, ConsentManager, SDK_VERSION, Tracker, clianta, clianta as default };
export type { Activity, ApiResponse, CliantaConfig, Company, ConsentChangeCallback, ConsentConfig, ConsentManagerConfig, ConsentState, Contact, EventType, Opportunity, PaginatedResponse, Pipeline, PipelineStage, Plugin, PluginName, StoredConsent, Task, TrackerCore, TrackingEvent, UserTraits };
