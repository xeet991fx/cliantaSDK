/**
 * Clianta SDK - Type Definitions
 * @see SDK_VERSION in core/config.ts
 */
interface CliantaConfig {
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
interface GroupTraits {
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
/** Event middleware function — intercept or transform events before they are sent */
type MiddlewareFn = (event: TrackingEvent, next: () => void) => void;
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
    /** contactId after a successful identify() call */
    private contactId;
    /** groupId after a successful group() call */
    private groupId;
    /** Pending identify retry on next flush */
    private pendingIdentify;
    /** Registered event schemas for validation */
    private eventSchemas;
    /** Event middleware pipeline */
    private middlewares;
    /** Ready callbacks */
    private readyCallbacks;
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
     * Associate the current visitor with a group (company/account).
     * The groupId will be attached to all subsequent track() calls.
     */
    group(groupId: string, traits?: GroupTraits): void;
    /**
     * Merge two visitor identities.
     * Links `previousId` (typically the anonymous visitor) to `newId` (the known user).
     * If `previousId` is omitted, the current visitorId is used.
     */
    alias(newId: string, previousId?: string): Promise<boolean>;
    /**
     * Track a screen view (for mobile-first PWAs and SPAs).
     * Similar to page() but semantically for app screens.
     */
    screen(name: string, properties?: Record<string, unknown>): void;
    /**
     * Register event middleware.
     * Middleware functions receive the event and a `next` callback.
     * Call `next()` to pass the event through, or don't call it to drop the event.
     *
     * @example
     * tracker.use((event, next) => {
     *   // Strip PII from events
     *   delete event.properties.email;
     *   next(); // pass it through
     * });
     */
    use(middleware: MiddlewareFn): void;
    /**
     * Run event through the middleware pipeline.
     * Executes each middleware in order; if any skips `next()`, the event is dropped.
     */
    private runMiddleware;
    /**
     * Register a callback to be invoked when the SDK is fully initialized.
     * If already initialized, the callback fires immediately.
     */
    onReady(callback: () => void): void;
    /**
     * Check if the SDK is fully initialized and ready.
     */
    isReady(): boolean;
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
declare const SDK_VERSION = "1.6.2";

/**
 * Clianta SDK
 * Client-side tracking SDK for CRM — tracks visitors, identifies contacts,
 * captures forms, and writes CRM data from client websites.
 *
 * This SDK is designed to run on CLIENT WEBSITES (React, Next.js, Vue, etc.)
 * It only SENDS data to your CRM — it never reads CRM data back.
 *
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

export { ConsentManager, SDK_VERSION, Tracker, clianta, clianta as default };
export type { CliantaConfig, ConsentChangeCallback, ConsentConfig, ConsentManagerConfig, ConsentState, EventType, GroupTraits, MiddlewareFn, Plugin, PluginName, PublicActivityData, PublicContactData, PublicContactUpdate, PublicCrmResult, PublicFormSubmission, PublicOpportunityData, StoredConsent, TrackerCore, TrackingEvent, UserTraits };
