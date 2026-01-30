/**
 * Clianta SDK - Type Definitions
 * @version 1.0.0
 */
interface MorrisBConfig {
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
}
type PluginName = 'pageView' | 'forms' | 'scroll' | 'clicks' | 'engagement' | 'downloads' | 'exitIntent' | 'errors' | 'performance';
interface ConsentConfig {
    /** Default consent state before user action */
    defaultConsent?: ConsentState;
    /** Wait for consent before tracking anything */
    waitForConsent?: boolean;
    /** Storage key for consent state */
    storageKey?: string;
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
    /** Initialize the plugin */
    init(tracker: TrackerCore): void;
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
    getConfig(): MorrisBConfig;
    /** Get workspace ID */
    getWorkspaceId(): string;
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
    source?: string;
    tags?: string[];
    customFields?: Record<string, unknown>;
    createdAt?: string;
    updatedAt?: string;
}
interface Opportunity {
    _id?: string;
    workspaceId: string;
    contactId: string;
    pipelineId: string;
    stageId: string;
    title: string;
    value?: number;
    currency?: string;
    probability?: number;
    expectedCloseDate?: string;
    status?: 'open' | 'won' | 'lost';
    lostReason?: string;
    customFields?: Record<string, unknown>;
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
 * MorrisB Tracking SDK - Main Tracker Class
 * @version 3.0.0
 */

/**
 * Main MorrisB Tracker Class
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
    constructor(workspaceId: string, userConfig?: MorrisBConfig);
    /**
     * Initialize enabled plugins
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
    getConfig(): MorrisBConfig;
    /**
     * Force flush event queue
     */
    flush(): Promise<void>;
    /**
     * Reset visitor and session (for logout)
     */
    reset(): void;
    /**
     * Destroy tracker and cleanup
     */
    destroy(): void;
}

/**
 * Clianta SDK - CRM API Client
 * @version 1.0.0
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
}

/**
 * Clianta SDK - Configuration
 * @version 1.0.0
 */

/** SDK Version */
declare const SDK_VERSION = "1.0.0";

/**
 * Clianta SDK
 * Professional CRM and tracking SDK for lead generation
 * @version 1.0.0
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
 */
declare function clianta(workspaceId: string, config?: MorrisBConfig): TrackerCore;

export { CRMClient, SDK_VERSION, Tracker, clianta, clianta as default };
export type { ApiResponse, ConsentConfig, ConsentState, Contact, EventType, MorrisBConfig, Opportunity, PaginatedResponse, Plugin, PluginName, TrackerCore, TrackingEvent, UserTraits };
