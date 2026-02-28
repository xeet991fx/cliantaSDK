/**
 * Clianta SDK - Main Tracker Class
 * @see SDK_VERSION in core/config.ts
 */

import type {
    CliantaConfig,
    TrackerCore,
    TrackingEvent,
    EventType,
    UserTraits,
    ConsentState,
    Plugin,
    PublicContactData,
    PublicContactUpdate,
    PublicActivityData,
    PublicOpportunityData,
    PublicFormSubmission,
    PublicCrmResult,
} from '../types';
import { mergeConfig, SDK_VERSION, STORAGE_KEYS } from './config';
import { Transport } from './transport';
import { EventQueue } from './queue';
import { logger } from './logger';
import { getPlugin } from '../plugins';
import { ConsentManager } from '../consent';
import { CRMClient, type InboundEventPayload, type InboundEventResult } from './crm';
import {
    getOrCreateVisitorId,
    getOrCreateSessionId,
    resetIds,
    getUTMParams,
    getDeviceInfo,
    generateUUID,
    getSessionStorage,
    setSessionStorage,
    isValidEmail,
} from '../utils';

/**
 * Main Clianta Tracker Class
 */
export class Tracker implements TrackerCore {
    private workspaceId: string;
    private config: Required<CliantaConfig>;
    private transport: Transport;
    private queue: EventQueue;
    private plugins: Plugin[] = [];
    private visitorId: string;
    private sessionId: string;
    private isInitialized = false;
    private consentManager: ConsentManager;
    /** contactId after a successful identify() call */
    private contactId: string | null = null;
    /** Pending identify retry on next flush */
    private pendingIdentify: { email: string; traits: UserTraits } | null = null;
    /** Registered event schemas for validation */
    private eventSchemas: Map<string, Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>> = new Map();

    constructor(workspaceId: string, userConfig: CliantaConfig = {}) {
        if (!workspaceId) {
            throw new Error('[Clianta] Workspace ID is required');
        }

        this.workspaceId = workspaceId;
        this.config = mergeConfig(userConfig);

        // Setup debug mode
        logger.enabled = this.config.debug;
        logger.info(`Initializing SDK v${SDK_VERSION}`, { workspaceId });

        // Initialize consent manager
        this.consentManager = new ConsentManager({
            ...this.config.consent,
            onConsentChange: (state, previous) => {
                this.onConsentChange(state, previous);
            },
        });

        // Initialize transport and queue
        this.transport = new Transport({ apiEndpoint: this.config.apiEndpoint });
        this.queue = new EventQueue(this.transport, {
            batchSize: this.config.batchSize,
            flushInterval: this.config.flushInterval,
        });

        // Get or create visitor and session IDs based on mode
        this.visitorId = this.createVisitorId();
        this.sessionId = this.createSessionId();

        logger.debug('IDs created', { visitorId: this.visitorId, sessionId: this.sessionId });

        // Security warnings
        if (this.config.apiEndpoint.startsWith('http://') &&
            typeof window !== 'undefined' &&
            !window.location.hostname.includes('localhost') &&
            !window.location.hostname.includes('127.0.0.1')) {
            logger.warn('apiEndpoint uses HTTP — events and visitor data will be sent unencrypted. Use HTTPS in production.');
        }

        if (this.config.apiKey && typeof window !== 'undefined') {
            logger.warn('API key is exposed in client-side code. Use API keys only in server-side (Node.js) environments.');
        }

        // Initialize plugins
        this.initPlugins();

        this.isInitialized = true;
        logger.info('SDK initialized successfully');
    }

    /**
     * Create visitor ID based on storage mode
     */
    private createVisitorId(): string {
        // Anonymous mode: use temporary ID until consent
        if (this.config.consent.anonymousMode && !this.consentManager.hasExplicit()) {
            const key = STORAGE_KEYS.VISITOR_ID + '_anon';
            let anonId = getSessionStorage(key);
            if (!anonId) {
                anonId = 'anon_' + generateUUID();
                setSessionStorage(key, anonId);
            }
            return anonId;
        }

        // Cookie-less mode: use sessionStorage only
        if (this.config.cookielessMode) {
            let visitorId = getSessionStorage(STORAGE_KEYS.VISITOR_ID);
            if (!visitorId) {
                visitorId = generateUUID();
                setSessionStorage(STORAGE_KEYS.VISITOR_ID, visitorId);
            }
            return visitorId;
        }

        // Normal mode
        return getOrCreateVisitorId(this.config.useCookies);
    }

    /**
     * Create session ID
     */
    private createSessionId(): string {
        return getOrCreateSessionId(this.config.sessionTimeout);
    }

    /**
     * Handle consent state changes
     */
    private onConsentChange(state: ConsentState, previous: ConsentState): void {
        logger.debug('Consent changed:', { from: previous, to: state });

        // If analytics consent was just granted
        if (state.analytics && !previous.analytics) {
            // Upgrade from anonymous ID to persistent ID
            if (this.config.consent.anonymousMode) {
                this.visitorId = getOrCreateVisitorId(this.config.useCookies);
                logger.info('Upgraded from anonymous to persistent visitor ID');
            }

            // Flush buffered events
            const buffered = this.consentManager.flushBuffer();
            for (const event of buffered) {
                // Update event with new visitor ID
                event.visitorId = this.visitorId;
                this.queue.push(event);
            }
        }
    }

    /**
     * Initialize enabled plugins
     * Handles both sync and async plugin init methods
     */
    private initPlugins(): void {
        const pluginsToLoad = this.config.plugins;

        // Skip pageView plugin if autoPageView is disabled
        const filteredPlugins = this.config.autoPageView
            ? pluginsToLoad
            : pluginsToLoad.filter((p) => p !== 'pageView');

        for (const pluginName of filteredPlugins) {
            try {
                const plugin = getPlugin(pluginName);
                // Handle both sync and async init (fire-and-forget for async)
                const result = plugin.init(this);
                if (result instanceof Promise) {
                    result.catch((error) => {
                        logger.error(`Async plugin init failed: ${pluginName}`, error);
                    });
                }
                this.plugins.push(plugin);
                logger.debug(`Plugin loaded: ${pluginName}`);
            } catch (error) {
                logger.error(`Failed to load plugin: ${pluginName}`, error);
            }
        }
    }

    /**
     * Track a custom event
     */
    track(
        eventType: EventType | string,
        eventName: string,
        properties: Record<string, unknown> = {}
    ): void {
        if (!this.isInitialized) {
            logger.warn('SDK not initialized, event dropped');
            return;
        }

        const event: TrackingEvent = {
            workspaceId: this.workspaceId,
            visitorId: this.visitorId,
            sessionId: this.sessionId,
            eventType: eventType as EventType,
            eventName,
            url: typeof window !== 'undefined' ? window.location.href : '',
            referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
            properties: {
                ...properties,
                eventId: generateUUID(), // Unique ID for deduplication on retry
                websiteDomain: typeof window !== 'undefined' ? window.location.hostname : undefined,
            },
            device: getDeviceInfo(),
            ...getUTMParams(),
            timestamp: new Date().toISOString(),
            sdkVersion: SDK_VERSION,
        };

        // Attach contactId if known (from a prior identify() call)
        if (this.contactId) {
            (event as any).contactId = this.contactId;
        }

        // Validate event against registered schema (debug mode only)
        this.validateEventSchema(eventType as string, properties);

        // Check consent before tracking
        if (!this.consentManager.canTrack()) {
            // Buffer event for later if waitForConsent is enabled
            if (this.config.consent.waitForConsent) {
                this.consentManager.bufferEvent(event);
                return;
            }
            // Otherwise drop the event
            logger.debug('Event dropped (no consent):', eventName);
            return;
        }

        this.queue.push(event);
        logger.debug('Event tracked:', eventName, properties);
    }

    /**
     * Track a page view
     */
    page(name?: string, properties: Record<string, unknown> = {}): void {
        const pageName = name || (typeof document !== 'undefined' ? document.title : 'Page View');
        this.track('page_view', pageName, {
            ...properties,
            path: typeof window !== 'undefined' ? window.location.pathname : '',
        });
    }

    /**
     * Identify a visitor.
     * Links the anonymous visitorId to a CRM contact and returns the contactId.
     * All subsequent track() calls will include the contactId automatically.
     */
    async identify(email: string, traits: UserTraits = {}): Promise<string | null> {
        if (!email) {
            logger.warn('Email is required for identification');
            return null;
        }

        if (!isValidEmail(email)) {
            logger.warn('Invalid email format, identification skipped:', email);
            return null;
        }

        logger.info('Identifying visitor:', email);

        const result = await this.transport.sendIdentify({
            workspaceId: this.workspaceId,
            visitorId: this.visitorId,
            email,
            properties: traits,
        });

        if (result.success) {
            logger.info('Visitor identified successfully, contactId:', result.contactId);
            // Store contactId so all future track() calls include it
            this.contactId = result.contactId ?? null;
            this.pendingIdentify = null;
            return this.contactId;
        } else {
            logger.error('Failed to identify visitor:', result.error);
            // Store for retry on next flush
            this.pendingIdentify = { email, traits };
            return null;
        }
    }

    /**
     * Send a server-side inbound event via the API key endpoint.
     * Convenience proxy to CRMClient.sendEvent() — requires apiKey in config.
     */
    async sendEvent(payload: InboundEventPayload): Promise<InboundEventResult> {
        const apiKey = this.config.apiKey;
        if (!apiKey) {
            logger.error('sendEvent() requires an apiKey in the SDK config');
            return { success: false, contactCreated: false, event: payload.event, error: 'No API key configured' };
        }
        const client = new CRMClient(this.config.apiEndpoint, this.workspaceId, undefined, apiKey);
        return client.sendEvent(payload);
    }

    /**
     * Get the current visitor's profile from the CRM.
     * Returns visitor data and linked contact info if identified.
     * Only returns data for the current visitor (privacy-safe for frontend).
     */
    async getVisitorProfile(): Promise<import('../types').VisitorProfile | null> {
        if (!this.isInitialized) {
            logger.warn('SDK not initialized');
            return null;
        }

        const result = await this.transport.fetchData<import('../types').VisitorProfile>(
            `/api/public/track/visitor/${this.workspaceId}/${this.visitorId}/profile`
        );

        if (result.success && result.data) {
            logger.debug('Visitor profile fetched:', result.data);
            return result.data;
        }

        logger.warn('Failed to fetch visitor profile:', result.error);
        return null;
    }

    /**
     * Get the current visitor's recent activity/events.
     * Returns paginated list of tracking events for this visitor.
     */
    async getVisitorActivity(
        options?: import('../types').VisitorActivityOptions
    ): Promise<{ data: import('../types').VisitorActivity[]; pagination: { page: number; limit: number; total: number; pages: number } } | null> {
        if (!this.isInitialized) {
            logger.warn('SDK not initialized');
            return null;
        }

        const params: Record<string, string> = {};
        if (options?.page) params.page = options.page.toString();
        if (options?.limit) params.limit = options.limit.toString();
        if (options?.eventType) params.eventType = options.eventType;
        if (options?.startDate) params.startDate = options.startDate;
        if (options?.endDate) params.endDate = options.endDate;

        const result = await this.transport.fetchData<any>(
            `/api/public/track/visitor/${this.workspaceId}/${this.visitorId}/activity`,
            params
        );

        if (result.success && result.data) {
            return result.data;
        }

        logger.warn('Failed to fetch visitor activity:', result.error);
        return null;
    }

    /**
     * Get a summarized journey timeline for the current visitor.
     * Includes top pages, sessions, time spent, and recent activities.
     */
    async getVisitorTimeline(): Promise<import('../types').VisitorTimeline | null> {
        if (!this.isInitialized) {
            logger.warn('SDK not initialized');
            return null;
        }

        const result = await this.transport.fetchData<import('../types').VisitorTimeline>(
            `/api/public/track/visitor/${this.workspaceId}/${this.visitorId}/timeline`
        );

        if (result.success && result.data) {
            return result.data;
        }

        logger.warn('Failed to fetch visitor timeline:', result.error);
        return null;
    }

    /**
     * Get engagement metrics for the current visitor.
     * Includes time on site, page views, bounce rate, and engagement score.
     */
    async getVisitorEngagement(): Promise<import('../types').EngagementMetrics | null> {
        if (!this.isInitialized) {
            logger.warn('SDK not initialized');
            return null;
        }

        const result = await this.transport.fetchData<import('../types').EngagementMetrics>(
            `/api/public/track/visitor/${this.workspaceId}/${this.visitorId}/engagement`
        );

        if (result.success && result.data) {
            return result.data;
        }

        logger.warn('Failed to fetch visitor engagement:', result.error);
        return null;
    }

    /**
     * Retry pending identify call
     */
    private async retryPendingIdentify(): Promise<void> {
        if (!this.pendingIdentify) return;
        const { email, traits } = this.pendingIdentify;
        this.pendingIdentify = null;
        await this.identify(email, traits);
    }

    /**
     * Update consent state
     */
    consent(state: ConsentState): void {
        this.consentManager.update(state);
    }

    /**
     * Get current consent state
     */
    getConsentState(): ConsentState {
        return this.consentManager.getState();
    }

    /**
     * Toggle debug mode
     */
    debug(enabled: boolean): void {
        logger.enabled = enabled;
        logger.info(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

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
    registerEventSchema(
        eventType: string,
        schema: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>
    ): void {
        this.eventSchemas.set(eventType, schema);
        logger.debug('Event schema registered:', eventType);
    }

    /**
     * Validate event properties against a registered schema (debug mode only)
     */
    private validateEventSchema(eventType: string, properties: Record<string, unknown>): void {
        if (!this.config.debug) return;
        
        const schema = this.eventSchemas.get(eventType);
        if (!schema) return;

        for (const [key, expectedType] of Object.entries(schema)) {
            const value = properties[key];
            if (value === undefined) {
                logger.warn(`[Schema] Missing property "${key}" for event type "${eventType}"`);
                continue;
            }

            let valid = false;
            switch (expectedType) {
                case 'string': valid = typeof value === 'string'; break;
                case 'number': valid = typeof value === 'number'; break;
                case 'boolean': valid = typeof value === 'boolean'; break;
                case 'object': valid = typeof value === 'object' && !Array.isArray(value); break;
                case 'array': valid = Array.isArray(value); break;
            }

            if (!valid) {
                logger.warn(`[Schema] Property "${key}" for event "${eventType}" expected ${expectedType}, got ${typeof value}`);
            }
        }
    }

    /**
     * Get visitor ID
     */
    getVisitorId(): string {
        return this.visitorId;
    }

    /**
     * Get session ID
     */
    getSessionId(): string {
        return this.sessionId;
    }

    /**
     * Get workspace ID
     */
    getWorkspaceId(): string {
        return this.workspaceId;
    }

    /**
     * Get current configuration
     */
    getConfig(): CliantaConfig {
        return { ...this.config };
    }

    /**
     * Force flush event queue
     */
    async flush(): Promise<void> {
        await this.retryPendingIdentify();
        await this.queue.flush();
    }

    /**
     * Reset visitor and session (for logout)
     */
    reset(): void {
        logger.info('Resetting visitor data');
        resetIds(this.config.useCookies);
        this.visitorId = this.createVisitorId();
        this.sessionId = this.createSessionId();
        this.contactId = null;
        this.pendingIdentify = null;
        this.queue.clear();
    }

    /**
     * Delete all stored user data (GDPR right-to-erasure)
     */
    deleteData(): void {
        logger.info('Deleting all user data (GDPR request)');

        // Clear queue
        this.queue.clear();

        // Reset consent
        this.consentManager.reset();

        // Clear all stored IDs
        resetIds(this.config.useCookies);

        // Clear session storage items
        if (typeof sessionStorage !== 'undefined') {
            try {
                sessionStorage.removeItem(STORAGE_KEYS.VISITOR_ID);
                sessionStorage.removeItem(STORAGE_KEYS.VISITOR_ID + '_anon');
                sessionStorage.removeItem(STORAGE_KEYS.SESSION_ID);
                sessionStorage.removeItem(STORAGE_KEYS.SESSION_TIMESTAMP);
            } catch {
                // Ignore errors
            }
        }

        // Clear localStorage items
        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.removeItem(STORAGE_KEYS.VISITOR_ID);
                localStorage.removeItem(STORAGE_KEYS.CONSENT);
                localStorage.removeItem(STORAGE_KEYS.EVENT_QUEUE);
            } catch {
                // Ignore errors
            }
        }

        // Generate new IDs
        this.visitorId = this.createVisitorId();
        this.sessionId = this.createSessionId();

        logger.info('All user data deleted');
    }

    // ============================================
    // PUBLIC CRM METHODS (no API key required)
    // ============================================

    /**
     * Create or update a contact by email (upsert).
     * Secured by domain whitelist — no API key needed.
     */
    async createContact(data: PublicContactData): Promise<PublicCrmResult> {
        return this.publicCrmRequest('/api/public/crm/contacts', 'POST', {
            workspaceId: this.workspaceId,
            ...data,
        });
    }

    /**
     * Update an existing contact by ID (limited fields only).
     */
    async updateContact(contactId: string, data: PublicContactUpdate): Promise<PublicCrmResult> {
        return this.publicCrmRequest(`/api/public/crm/contacts/${contactId}`, 'PUT', {
            workspaceId: this.workspaceId,
            ...data,
        });
    }

    /**
     * Submit a form — creates/updates contact from form data.
     */
    async submitForm(formId: string, data: PublicFormSubmission): Promise<PublicCrmResult> {
        const payload = {
            ...data,
            metadata: {
                ...data.metadata,
                visitorId: this.visitorId,
                sessionId: this.sessionId,
                pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
                referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
            },
        };
        return this.publicCrmRequest(`/api/public/crm/forms/${formId}/submit`, 'POST', payload);
    }

    /**
     * Log an activity linked to a contact (append-only).
     */
    async logActivity(data: PublicActivityData): Promise<PublicCrmResult> {
        return this.publicCrmRequest('/api/public/crm/activities', 'POST', {
            workspaceId: this.workspaceId,
            ...data,
        });
    }

    /**
     * Create an opportunity (e.g., from "Request Demo" forms).
     */
    async createOpportunity(data: PublicOpportunityData): Promise<PublicCrmResult> {
        return this.publicCrmRequest('/api/public/crm/opportunities', 'POST', {
            workspaceId: this.workspaceId,
            ...data,
        });
    }

    /**
     * Internal helper for public CRM API calls.
     */
    private async publicCrmRequest(path: string, method: string, body: unknown): Promise<PublicCrmResult> {
        const url = `${this.config.apiEndpoint}${path}`;
        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await response.json().catch(() => ({}));
            if (response.ok) {
                logger.debug(`Public CRM ${method} ${path} succeeded`);
                return { success: true, data: data.data ?? data, status: response.status };
            }
            logger.error(`Public CRM ${method} ${path} failed (${response.status}):`, data.message);
            return { success: false, error: data.message, status: response.status };
        } catch (error) {
            logger.error(`Public CRM ${method} ${path} error:`, error);
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * Destroy tracker and cleanup
     */
    async destroy(): Promise<void> {
        logger.info('Destroying tracker');

        // Flush any remaining events (await to ensure completion)
        await this.queue.flush();

        // Destroy plugins
        for (const plugin of this.plugins) {
            if (plugin.destroy) {
                plugin.destroy();
            }
        }
        this.plugins = [];

        // Destroy queue
        this.queue.destroy();

        this.isInitialized = false;
    }
}

