import * as react_jsx_runtime from 'react/jsx-runtime';
import { ReactNode, ErrorInfo } from 'react';

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

interface CliantaProviderProps {
    /** Configuration object (from clianta.config.ts) */
    config: CliantaConfig;
    /** React children */
    children: ReactNode;
    /** Optional error handler when the SDK encounters errors */
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}
/**
 * CliantaProvider - Wrap your app to enable tracking
 *
 * Includes an ErrorBoundary so SDK failures never crash the host app.
 *
 * @example
 * // In clianta.config.ts:
 * import { CliantaConfig } from '@clianta/sdk';
 *
 * const config: CliantaConfig = {
 *   projectId: 'your-project-id',
 *   apiEndpoint: process.env.NEXT_PUBLIC_CLIANTA_API_ENDPOINT || 'http://localhost:5000',
 *   debug: process.env.NODE_ENV === 'development',
 * };
 *
 * export default config;
 *
 * // In app/layout.tsx or main.tsx:
 * import { CliantaProvider } from '@clianta/sdk/react';
 * import cliantaConfig from '../clianta.config';
 *
 * <CliantaProvider config={cliantaConfig}>
 *   {children}
 * </CliantaProvider>
 */
declare function CliantaProvider({ config, children, onError }: CliantaProviderProps): react_jsx_runtime.JSX.Element;
/**
 * useClianta - Hook to access tracker in any component
 *
 * @example
 * const tracker = useClianta();
 * tracker?.track('button_click', 'CTA Button');
 */
declare function useClianta(): TrackerCore | null;
/**
 * useCliantaReady - Hook to check if SDK is initialized
 *
 * @example
 * const { isReady, tracker } = useCliantaReady();
 * if (isReady) {
 *   tracker.track('purchase', 'Order', { value: 99 });
 * }
 */
declare function useCliantaReady(): {
    isReady: boolean;
    tracker: TrackerCore | null;
};
/**
 * useCliantaTrack - Convenience hook for tracking events
 *
 * @example
 * const track = useCliantaTrack();
 * track('purchase', 'Order Completed', { orderId: '123' });
 */
declare function useCliantaTrack(): (eventType: string, eventName: string, properties?: Record<string, unknown>) => void;

export { CliantaProvider, useClianta, useCliantaReady, useCliantaTrack };
export type { CliantaConfig, CliantaProviderProps, TrackerCore };
