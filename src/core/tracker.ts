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
    GroupTraits,
    MiddlewareFn,
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
    /** groupId after a successful group() call */
    private groupId: string | null = null;
    /** Pending identify retry on next flush */
    private pendingIdentify: { email: string; traits: UserTraits } | null = null;
    /** Registered event schemas for validation */
    private eventSchemas: Map<string, Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>> = new Map();
    /** Event middleware pipeline */
    private middlewares: MiddlewareFn[] = [];
    /** Ready callbacks */
    private readyCallbacks: (() => void)[] = [];

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
            persistMode: this.config.persistMode,
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
            logger.warn('apiEndpoint uses HTTP — events will be sent unencrypted. Use HTTPS in production.');
        }

        // Initialize plugins
        this.initPlugins();

        this.isInitialized = true;
        logger.info('SDK initialized successfully');

        // Fire ready callbacks
        for (const cb of this.readyCallbacks) {
            try { cb(); } catch (e) { logger.error('onReady callback error:', e); }
        }
        this.readyCallbacks = [];
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

        const utmParams = getUTMParams();
        const event: TrackingEvent = {
            workspaceId: this.workspaceId,
            visitorId: this.visitorId,
            sessionId: this.sessionId,
            contactId: this.contactId ?? undefined,
            groupId: this.groupId ?? undefined,
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
            utmSource: utmParams.utmSource,
            utmMedium: utmParams.utmMedium,
            utmCampaign: utmParams.utmCampaign,
            utmTerm: utmParams.utmTerm,
            utmContent: utmParams.utmContent,
            timestamp: new Date().toISOString(),
            sdkVersion: SDK_VERSION,
        };

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

        // Run event through middleware pipeline
        this.runMiddleware(event, () => {
            this.queue.push(event);
            logger.debug('Event tracked:', eventName, properties);
        });
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

    // ============================================
    // GROUP, ALIAS, SCREEN
    // ============================================

    /**
     * Associate the current visitor with a group (company/account).
     * The groupId will be attached to all subsequent track() calls.
     */
    group(groupId: string, traits: GroupTraits = {}): void {
        if (!groupId) {
            logger.warn('groupId is required for group()');
            return;
        }

        this.groupId = groupId;
        logger.info('Visitor grouped:', groupId);

        this.track('group', 'Group Identified', {
            groupId,
            ...traits,
        });
    }

    /**
     * Merge two visitor identities.
     * Links `previousId` (typically the anonymous visitor) to `newId` (the known user).
     * If `previousId` is omitted, the current visitorId is used.
     */
    async alias(newId: string, previousId?: string): Promise<boolean> {
        if (!newId) {
            logger.warn('newId is required for alias()');
            return false;
        }

        const prevId = previousId || this.visitorId;
        logger.info('Aliasing visitor:', { from: prevId, to: newId });

        const result = await this.transport.sendPost('/api/public/track/alias', {
            workspaceId: this.workspaceId,
            previousId: prevId,
            newId,
        });

        if (result.success) {
            logger.info('Alias successful');
            return true;
        }
        logger.error('Alias failed:', result.error ?? result.status);
        return false;
    }

    /**
     * Track a screen view (for mobile-first PWAs and SPAs).
     * Similar to page() but semantically for app screens.
     */
    screen(name: string, properties: Record<string, unknown> = {}): void {
        this.track('screen_view', name, {
            ...properties,
            screenName: name,
        });
    }

    // ============================================
    // MIDDLEWARE
    // ============================================

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
    use(middleware: MiddlewareFn): void {
        this.middlewares.push(middleware);
        logger.debug('Middleware registered');
    }

    /**
     * Run event through the middleware pipeline.
     * Executes each middleware in order; if any skips `next()`, the event is dropped.
     */
    private runMiddleware(event: TrackingEvent, finalCallback: () => void): void {
        if (this.middlewares.length === 0) {
            finalCallback();
            return;
        }

        let index = 0;
        const middlewares = this.middlewares;

        const next = () => {
            index++;
            if (index < middlewares.length) {
                try {
                    middlewares[index](event, next);
                } catch (e) {
                    logger.error('Middleware error:', e);
                    finalCallback();
                }
            } else {
                finalCallback();
            }
        };

        try {
            middlewares[0](event, next);
        } catch (e) {
            logger.error('Middleware error:', e);
            finalCallback();
        }
    }

    // ============================================
    // LIFECYCLE
    // ============================================

    /**
     * Register a callback to be invoked when the SDK is fully initialized.
     * If already initialized, the callback fires immediately.
     */
    onReady(callback: () => void): void {
        if (this.isInitialized) {
            try { callback(); } catch (e) { logger.error('onReady callback error:', e); }
        } else {
            this.readyCallbacks.push(callback);
        }
    }

    /**
     * Check if the SDK is fully initialized and ready.
     */
    isReady(): boolean {
        return this.isInitialized;
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

