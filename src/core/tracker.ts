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
                plugin.init(this);
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
            properties,
            device: getDeviceInfo(),
            utm: getUTMParams() as TrackingEvent['utm'],
            timestamp: new Date().toISOString(),
            sdkVersion: SDK_VERSION,
        };

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
     * Identify a visitor
     */
    async identify(email: string, traits: UserTraits = {}): Promise<void> {
        if (!email) {
            logger.warn('Email is required for identification');
            return;
        }

        logger.info('Identifying visitor:', email);

        const result = await this.transport.sendIdentify({
            workspaceId: this.workspaceId,
            visitorId: this.visitorId,
            email,
            properties: traits,
        });

        if (result.success) {
            logger.info('Visitor identified successfully');
        } else {
            logger.error('Failed to identify visitor:', result.error);
        }
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

    /**
     * Destroy tracker and cleanup
     */
    destroy(): void {
        logger.info('Destroying tracker');

        // Flush any remaining events
        this.queue.flush();

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

