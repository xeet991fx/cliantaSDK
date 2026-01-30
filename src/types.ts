/**
 * Clianta SDK - Type Definitions
 * @see SDK_VERSION in core/config.ts
 */

// ============================================
// CONFIGURATION TYPES
// ============================================

export interface CliantaConfig {
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
    | 'popupForms';

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
    | 'custom';

export interface TrackingEvent {
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

    /** Initialize the plugin */
    init(tracker: TrackerCore): void;

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
}

// ============================================
// QUEUE TYPES
// ============================================

export interface QueueConfig {
    batchSize: number;
    flushInterval: number;
    maxQueueSize?: number;
    storageKey?: string;
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
    source?: string;
    tags?: string[];
    customFields?: Record<string, unknown>;
    createdAt?: string;
    updatedAt?: string;
}

export interface Opportunity {
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
