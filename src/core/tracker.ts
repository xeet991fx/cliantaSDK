/**
 * MorrisB Tracking SDK - Main Tracker Class
 * @version 3.0.0
 */

import type {
    MorrisBConfig,
    TrackerCore,
    TrackingEvent,
    EventType,
    UserTraits,
    ConsentState,
    Plugin,
} from '../types';
import { mergeConfig, SDK_VERSION } from './config';
import { Transport } from './transport';
import { EventQueue } from './queue';
import { logger } from './logger';
import { getPlugin } from '../plugins';
import {
    getOrCreateVisitorId,
    getOrCreateSessionId,
    resetIds,
    getUTMParams,
    getDeviceInfo,
} from '../utils';

/**
 * Main MorrisB Tracker Class
 */
export class Tracker implements TrackerCore {
    private workspaceId: string;
    private config: Required<MorrisBConfig>;
    private transport: Transport;
    private queue: EventQueue;
    private plugins: Plugin[] = [];
    private visitorId: string;
    private sessionId: string;
    private isInitialized = false;

    constructor(workspaceId: string, userConfig: MorrisBConfig = {}) {
        if (!workspaceId) {
            throw new Error('[Clianta] Workspace ID is required');
        }

        this.workspaceId = workspaceId;
        this.config = mergeConfig(userConfig);

        // Setup debug mode
        logger.enabled = this.config.debug;
        logger.info(`Initializing SDK v${SDK_VERSION}`, { workspaceId });

        // Initialize transport and queue
        this.transport = new Transport({ apiEndpoint: this.config.apiEndpoint });
        this.queue = new EventQueue(this.transport, {
            batchSize: this.config.batchSize,
            flushInterval: this.config.flushInterval,
        });

        // Get or create visitor and session IDs
        this.visitorId = getOrCreateVisitorId(this.config.useCookies);
        this.sessionId = getOrCreateSessionId(this.config.sessionTimeout);

        logger.debug('IDs created', { visitorId: this.visitorId, sessionId: this.sessionId });

        // Initialize plugins
        this.initPlugins();

        this.isInitialized = true;
        logger.info('SDK initialized successfully');
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
        logger.info('Consent updated:', state);
        // TODO: Implement consent management
        // - Store consent state
        // - Enable/disable tracking based on consent
        // - Notify plugins
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
    getConfig(): MorrisBConfig {
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
        this.visitorId = getOrCreateVisitorId(this.config.useCookies);
        this.sessionId = getOrCreateSessionId(this.config.sessionTimeout);
        this.queue.clear();
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
