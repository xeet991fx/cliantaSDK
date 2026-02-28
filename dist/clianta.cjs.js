/*!
 * Clianta SDK v1.4.0
 * (c) 2026 Clianta
 * Released under the MIT License.
 */
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

/**
 * Clianta SDK - Configuration
 * @see SDK_VERSION in core/config.ts
 */
/** SDK Version */
const SDK_VERSION = '1.4.0';
/** Default API endpoint based on environment */
const getDefaultApiEndpoint = () => {
    if (typeof window === 'undefined')
        return 'https://api.clianta.online';
    const hostname = window.location.hostname;
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
        return 'http://localhost:5000';
    }
    return 'https://api.clianta.online';
};
/** Core plugins enabled by default */
const DEFAULT_PLUGINS = [
    'pageView',
    'forms',
    'scroll',
    'clicks',
    'engagement',
    'downloads',
    'exitIntent',
];
/** Default configuration values */
const DEFAULT_CONFIG = {
    projectId: '',
    apiEndpoint: getDefaultApiEndpoint(),
    authToken: '',
    apiKey: '',
    debug: false,
    autoPageView: true,
    plugins: DEFAULT_PLUGINS,
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    batchSize: 10,
    flushInterval: 5000, // 5 seconds
    consent: {
        defaultConsent: { analytics: true, marketing: false, personalization: false },
        waitForConsent: false,
        storageKey: 'mb_consent',
        anonymousMode: false,
    },
    cookieDomain: '',
    useCookies: false,
    cookielessMode: false,
    persistMode: 'session',
};
/** Storage keys */
const STORAGE_KEYS = {
    VISITOR_ID: 'mb_vid',
    SESSION_ID: 'mb_sid',
    SESSION_TIMESTAMP: 'mb_st',
    CONSENT: 'mb_consent',
    EVENT_QUEUE: 'mb_queue',
};
/** Scroll depth milestones to track */
const SCROLL_MILESTONES = [25, 50, 75, 100];
/** File extensions to track as downloads */
const DOWNLOAD_EXTENSIONS = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.zip', '.rar', '.tar', '.gz', '.7z',
    '.csv', '.txt', '.json', '.xml',
    '.mp3', '.mp4', '.wav', '.avi', '.mov',
];
/**
 * Merge user config with defaults
 */
function mergeConfig(userConfig = {}) {
    return {
        ...DEFAULT_CONFIG,
        ...userConfig,
        consent: {
            ...DEFAULT_CONFIG.consent,
            ...userConfig.consent,
        },
    };
}

/**
 * Clianta SDK - Debug Logger
 * @see SDK_VERSION in core/config.ts
 */
const LOG_PREFIX = '[Clianta]';
const LOG_STYLES = {
    debug: 'color: #6b7280; font-weight: normal;',
    info: 'color: #3b82f6; font-weight: normal;',
    warn: 'color: #f59e0b; font-weight: bold;',
    error: 'color: #ef4444; font-weight: bold;',
};
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
/**
 * Create a logger instance
 */
function createLogger(enabled = false) {
    let currentLevel = 'debug';
    let isEnabled = enabled;
    const shouldLog = (level) => {
        if (!isEnabled)
            return false;
        return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
    };
    const formatArgs = (level, args) => {
        if (typeof console !== 'undefined' && typeof window !== 'undefined') {
            // Browser with styled console
            return [`%c${LOG_PREFIX}`, LOG_STYLES[level], ...args];
        }
        // Node.js or basic console
        return [`${LOG_PREFIX} [${level.toUpperCase()}]`, ...args];
    };
    return {
        get enabled() {
            return isEnabled;
        },
        set enabled(value) {
            isEnabled = value;
        },
        debug(...args) {
            if (shouldLog('debug') && typeof console !== 'undefined') {
                console.log(...formatArgs('debug', args));
            }
        },
        info(...args) {
            if (shouldLog('info') && typeof console !== 'undefined') {
                console.info(...formatArgs('info', args));
            }
        },
        warn(...args) {
            if (shouldLog('warn') && typeof console !== 'undefined') {
                console.warn(...formatArgs('warn', args));
            }
        },
        error(...args) {
            if (shouldLog('error') && typeof console !== 'undefined') {
                console.error(...formatArgs('error', args));
            }
        },
        setLevel(level) {
            currentLevel = level;
        },
    };
}
/** Global logger instance */
const logger = createLogger(false);

/**
 * Clianta SDK - Transport Layer
 * Handles sending events to the backend with retry logic
 * @see SDK_VERSION in core/config.ts
 */
const DEFAULT_TIMEOUT = 10000; // 10 seconds
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000; // 1 second
/**
 * Transport class for sending data to the backend
 */
class Transport {
    constructor(config) {
        this.config = {
            apiEndpoint: config.apiEndpoint,
            maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
            retryDelay: config.retryDelay ?? DEFAULT_RETRY_DELAY,
            timeout: config.timeout ?? DEFAULT_TIMEOUT,
        };
    }
    /**
     * Send events to the tracking endpoint
     */
    async sendEvents(events) {
        const url = `${this.config.apiEndpoint}/api/public/track/event`;
        const payload = JSON.stringify({ events });
        return this.send(url, payload);
    }
    /**
     * Send identify request.
     * Returns contactId from the server response so the Tracker can store it.
     */
    async sendIdentify(data) {
        const url = `${this.config.apiEndpoint}/api/public/track/identify`;
        try {
            const response = await this.fetchWithTimeout(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                keepalive: true,
            });
            const body = await response.json().catch(() => ({}));
            if (response.ok) {
                logger.debug('Identify successful, contactId:', body.contactId);
                return {
                    success: true,
                    status: response.status,
                    contactId: body.contactId ?? undefined,
                };
            }
            if (response.status >= 500) {
                logger.warn(`Identify server error (${response.status})`);
            }
            else {
                logger.error(`Identify failed with status ${response.status}:`, body.message);
            }
            return { success: false, status: response.status };
        }
        catch (error) {
            logger.error('Identify request failed:', error);
            return { success: false, error: error };
        }
    }
    /**
     * Send events synchronously (for page unload)
     * Uses navigator.sendBeacon for reliability
     */
    sendBeacon(events) {
        if (typeof navigator === 'undefined' || !navigator.sendBeacon) {
            logger.warn('sendBeacon not available, events may be lost');
            return false;
        }
        const url = `${this.config.apiEndpoint}/api/public/track/event`;
        const payload = JSON.stringify({ events });
        const blob = new Blob([payload], { type: 'application/json' });
        try {
            const success = navigator.sendBeacon(url, blob);
            if (success) {
                logger.debug(`Beacon sent ${events.length} events`);
            }
            else {
                logger.warn('sendBeacon returned false');
            }
            return success;
        }
        catch (error) {
            logger.error('sendBeacon error:', error);
            return false;
        }
    }
    /**
     * Fetch data from the tracking API (GET request)
     * Used for read-back APIs (visitor profile, activity, etc.)
     */
    async fetchData(path, params) {
        const url = new URL(`${this.config.apiEndpoint}${path}`);
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    url.searchParams.set(key, value);
                }
            });
        }
        try {
            const response = await this.fetchWithTimeout(url.toString(), {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });
            if (response.ok) {
                const body = await response.json();
                logger.debug('Fetch successful:', path);
                return { success: true, data: body.data ?? body, status: response.status };
            }
            logger.error(`Fetch failed with status ${response.status}`);
            return { success: false, status: response.status };
        }
        catch (error) {
            logger.error('Fetch request failed:', error);
            return { success: false, error: error };
        }
    }
    /**
     * Internal send with retry logic
     */
    async send(url, payload, attempt = 1) {
        try {
            const response = await this.fetchWithTimeout(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: payload,
                keepalive: true,
            });
            if (response.ok) {
                logger.debug('Request successful:', url);
                return { success: true, status: response.status };
            }
            // Server error - may retry
            if (response.status >= 500 && attempt < this.config.maxRetries) {
                logger.warn(`Server error (${response.status}), retrying...`);
                await this.delay(this.config.retryDelay * attempt);
                return this.send(url, payload, attempt + 1);
            }
            // Client error - don't retry
            logger.error(`Request failed with status ${response.status}`);
            return { success: false, status: response.status };
        }
        catch (error) {
            // Network error - retry if possible
            if (attempt < this.config.maxRetries) {
                logger.warn(`Network error, retrying (${attempt}/${this.config.maxRetries})...`);
                await this.delay(this.config.retryDelay * attempt);
                return this.send(url, payload, attempt + 1);
            }
            logger.error('Request failed after retries:', error);
            return { success: false, error: error };
        }
    }
    /**
     * Fetch with timeout
     */
    async fetchWithTimeout(url, options) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeout);
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
            });
            return response;
        }
        finally {
            clearTimeout(timeout);
        }
    }
    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

/**
 * Clianta SDK - Utility Functions
 * @see SDK_VERSION in core/config.ts
 */
// ============================================
// UUID GENERATION
// ============================================
/**
 * Generate a UUID v4
 */
function generateUUID() {
    // Use crypto.randomUUID if available (modern browsers)
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback to manual generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
// ============================================
// STORAGE UTILITIES
// ============================================
/**
 * Safely get from localStorage
 */
function getLocalStorage(key) {
    try {
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem(key);
        }
    }
    catch {
        // localStorage not available or blocked
    }
    return null;
}
/**
 * Safely set to localStorage
 */
function setLocalStorage(key, value) {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, value);
            return true;
        }
    }
    catch {
        // localStorage not available or blocked
    }
    return false;
}
/**
 * Safely get from sessionStorage
 */
function getSessionStorage(key) {
    try {
        if (typeof sessionStorage !== 'undefined') {
            return sessionStorage.getItem(key);
        }
    }
    catch {
        // sessionStorage not available or blocked
    }
    return null;
}
/**
 * Safely set to sessionStorage
 */
function setSessionStorage(key, value) {
    try {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(key, value);
            return true;
        }
    }
    catch {
        // sessionStorage not available or blocked
    }
    return false;
}
/**
 * Get or set a cookie
 */
function cookie(name, value, days) {
    if (typeof document === 'undefined')
        return null;
    // Get cookie
    if (value === undefined) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
    }
    // Set cookie
    let expires = '';
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
        expires = '; expires=' + date.toUTCString();
    }
    // Add Secure flag on HTTPS to prevent cookie leakage over plaintext
    const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = name + '=' + value + expires + '; path=/; SameSite=Lax' + secure;
    return value;
}
// ============================================
// VISITOR & SESSION MANAGEMENT
// ============================================
/**
 * Get or create a persistent visitor ID
 */
function getOrCreateVisitorId(useCookies = false) {
    const key = STORAGE_KEYS.VISITOR_ID;
    // Try to get existing ID
    let visitorId = null;
    if (useCookies) {
        visitorId = cookie(key);
    }
    else {
        visitorId = getLocalStorage(key);
    }
    // Create new ID if not found
    if (!visitorId) {
        visitorId = generateUUID();
        if (useCookies) {
            cookie(key, visitorId, 365); // 1 year
        }
        else {
            setLocalStorage(key, visitorId);
        }
    }
    return visitorId;
}
/**
 * Get or create a session ID (expires after timeout)
 */
function getOrCreateSessionId(timeout) {
    const sidKey = STORAGE_KEYS.SESSION_ID;
    const tsKey = STORAGE_KEYS.SESSION_TIMESTAMP;
    let sessionId = getSessionStorage(sidKey);
    const lastActivity = parseInt(getSessionStorage(tsKey) || '0', 10);
    const now = Date.now();
    // Check if session expired
    if (!sessionId || now - lastActivity > timeout) {
        sessionId = generateUUID();
        setSessionStorage(sidKey, sessionId);
    }
    // Update last activity
    setSessionStorage(tsKey, now.toString());
    return sessionId;
}
/**
 * Reset visitor and session IDs
 */
function resetIds(useCookies = false) {
    const visitorKey = STORAGE_KEYS.VISITOR_ID;
    if (useCookies) {
        cookie(visitorKey, '', -1); // Delete cookie
    }
    else {
        try {
            localStorage.removeItem(visitorKey);
        }
        catch {
            // Ignore
        }
    }
    try {
        sessionStorage.removeItem(STORAGE_KEYS.SESSION_ID);
        sessionStorage.removeItem(STORAGE_KEYS.SESSION_TIMESTAMP);
    }
    catch {
        // Ignore
    }
}
// ============================================
// URL UTILITIES
// ============================================
/**
 * Extract UTM parameters from URL
 */
function getUTMParams() {
    if (typeof window === 'undefined')
        return {};
    try {
        const params = new URLSearchParams(window.location.search);
        return {
            utmSource: params.get('utm_source') || undefined,
            utmMedium: params.get('utm_medium') || undefined,
            utmCampaign: params.get('utm_campaign') || undefined,
            utmTerm: params.get('utm_term') || undefined,
            utmContent: params.get('utm_content') || undefined,
        };
    }
    catch {
        return {};
    }
}
/**
 * Check if URL is a download link
 */
function isDownloadUrl(url) {
    const lowerUrl = url.toLowerCase();
    return DOWNLOAD_EXTENSIONS.some((ext) => lowerUrl.includes(ext));
}
/**
 * Extract filename from URL
 */
function getFilenameFromUrl(url) {
    try {
        return url.split('/').pop()?.split('?')[0] || 'unknown';
    }
    catch {
        return 'unknown';
    }
}
/**
 * Extract file extension from URL
 */
function getFileExtension(url) {
    const filename = getFilenameFromUrl(url);
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop() || 'unknown' : 'unknown';
}
// ============================================
// DOM UTILITIES
// ============================================
/**
 * Get text content from element (truncated)
 */
function getElementText(element, maxLength = 100) {
    const text = element.innerText ||
        element.textContent ||
        element.value ||
        '';
    return text.trim().substring(0, maxLength);
}
/**
 * Get element identification info
 */
function getElementInfo(element) {
    return {
        tag: element.tagName?.toLowerCase() || 'unknown',
        id: element.id || '',
        className: element.className || '',
        text: getElementText(element, 50),
    };
}
/**
 * Check if element is a trackable click target
 */
function isTrackableClickElement(element) {
    const trackableTags = ['BUTTON', 'A', 'INPUT'];
    return (trackableTags.includes(element.tagName) ||
        element.hasAttribute('data-track-click') ||
        element.classList.contains('track-click'));
}
/**
 * Check if device is mobile
 */
function isMobile() {
    if (typeof navigator === 'undefined')
        return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
// ============================================
// VALIDATION UTILITIES
// ============================================
/**
 * Validate email format
 */
function isValidEmail(email) {
    if (typeof email !== 'string' || !email)
        return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
// ============================================
// DEVICE INFO
// ============================================
/**
 * Get current device information
 */
function getDeviceInfo() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return {
            userAgent: 'unknown',
            screen: 'unknown',
            language: 'unknown',
            timezone: 'unknown',
        };
    }
    return {
        userAgent: navigator.userAgent,
        screen: `${screen.width}x${screen.height}`,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
    };
}

/**
 * Clianta SDK - Event Queue
 * Handles batching and flushing of events
 * @see SDK_VERSION in core/config.ts
 */
const MAX_QUEUE_SIZE = 1000;
/** Rate limit: max events per window */
const RATE_LIMIT_MAX_EVENTS = 100;
/** Rate limit window in ms (1 minute) */
const RATE_LIMIT_WINDOW_MS = 60000;
/**
 * Event queue with batching, persistence, rate limiting, and auto-flush
 */
class EventQueue {
    constructor(transport, config = {}) {
        this.queue = [];
        this.flushTimer = null;
        this.isFlushing = false;
        /** Rate limiting: timestamps of recent events */
        this.eventTimestamps = [];
        /** Unload handler references for cleanup */
        this.boundBeforeUnload = null;
        this.boundVisibilityChange = null;
        this.boundPageHide = null;
        this.transport = transport;
        this.config = {
            batchSize: config.batchSize ?? 10,
            flushInterval: config.flushInterval ?? 5000,
            maxQueueSize: config.maxQueueSize ?? MAX_QUEUE_SIZE,
            storageKey: config.storageKey ?? STORAGE_KEYS.EVENT_QUEUE,
        };
        this.persistMode = config.persistMode || 'session';
        // Restore persisted queue
        this.restoreQueue();
        // Start auto-flush timer
        this.startFlushTimer();
        // Setup unload handlers
        this.setupUnloadHandlers();
    }
    /**
     * Add an event to the queue
     */
    push(event) {
        // Rate limiting check
        if (!this.checkRateLimit()) {
            logger.warn('Rate limit exceeded, event dropped:', event.eventName);
            return;
        }
        // Don't exceed max queue size
        if (this.queue.length >= this.config.maxQueueSize) {
            logger.warn('Queue full, dropping oldest event');
            this.queue.shift();
        }
        this.queue.push(event);
        logger.debug('Event queued:', event.eventName, `(${this.queue.length} in queue)`);
        // Flush if batch size reached
        if (this.queue.length >= this.config.batchSize) {
            this.flush();
        }
    }
    /**
     * Check and enforce rate limiting
     * @returns true if event is allowed, false if rate limited
     */
    checkRateLimit() {
        const now = Date.now();
        // Remove timestamps outside the window
        this.eventTimestamps = this.eventTimestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
        // Check if under limit
        if (this.eventTimestamps.length >= RATE_LIMIT_MAX_EVENTS) {
            return false;
        }
        // Record this event
        this.eventTimestamps.push(now);
        return true;
    }
    /**
     * Flush the queue (send all events)
     */
    async flush() {
        if (this.isFlushing || this.queue.length === 0) {
            return;
        }
        this.isFlushing = true;
        // Atomically take snapshot of current queue length to avoid race condition
        const count = this.queue.length;
        const events = this.queue.splice(0, count);
        try {
            logger.debug(`Flushing ${events.length} events`);
            // Clear persisted queue
            this.persistQueue([]);
            // Send to backend
            const result = await this.transport.sendEvents(events);
            if (!result.success) {
                // Re-queue events on failure (at the front)
                logger.warn('Flush failed, re-queuing events');
                this.queue.unshift(...events);
                this.persistQueue(this.queue);
            }
            else {
                logger.debug('Flush successful');
            }
        }
        catch (error) {
            logger.error('Flush error:', error);
        }
        finally {
            this.isFlushing = false;
        }
    }
    /**
     * Flush synchronously using sendBeacon (for page unload)
     */
    flushSync() {
        if (this.queue.length === 0)
            return;
        const events = this.queue.splice(0, this.queue.length);
        logger.debug(`Sync flushing ${events.length} events via beacon`);
        const success = this.transport.sendBeacon(events);
        if (!success) {
            // Re-queue and persist for next page load
            this.queue.unshift(...events);
            this.persistQueue(this.queue);
        }
    }
    /**
     * Get current queue length
     */
    get length() {
        return this.queue.length;
    }
    /**
     * Clear the queue
     */
    clear() {
        this.queue = [];
        this.persistQueue([]);
        // Also clear localStorage if used
        if (this.persistMode === 'local' && typeof localStorage !== 'undefined') {
            try {
                localStorage.removeItem(this.config.storageKey);
            }
            catch { /* ignore */ }
        }
    }
    /**
     * Stop the flush timer and cleanup handlers
     */
    destroy() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        // Remove unload handlers
        if (typeof window !== 'undefined') {
            if (this.boundBeforeUnload) {
                window.removeEventListener('beforeunload', this.boundBeforeUnload);
            }
            if (this.boundVisibilityChange) {
                window.removeEventListener('visibilitychange', this.boundVisibilityChange);
            }
            if (this.boundPageHide) {
                window.removeEventListener('pagehide', this.boundPageHide);
            }
        }
    }
    /**
     * Start auto-flush timer
     */
    startFlushTimer() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        this.flushTimer = setInterval(() => {
            this.flush();
        }, this.config.flushInterval);
    }
    /**
     * Setup page unload handlers
     */
    setupUnloadHandlers() {
        if (typeof window === 'undefined')
            return;
        // Flush on page unload
        this.boundBeforeUnload = () => this.flushSync();
        window.addEventListener('beforeunload', this.boundBeforeUnload);
        // Flush when page becomes hidden
        this.boundVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                this.flushSync();
            }
        };
        window.addEventListener('visibilitychange', this.boundVisibilityChange);
        // Flush on page hide (iOS Safari)
        this.boundPageHide = () => this.flushSync();
        window.addEventListener('pagehide', this.boundPageHide);
    }
    /**
     * Persist queue to storage based on persistMode
     */
    persistQueue(events) {
        if (this.persistMode === 'none')
            return;
        try {
            const serialized = JSON.stringify(events);
            if (this.persistMode === 'local' && typeof localStorage !== 'undefined') {
                try {
                    localStorage.setItem(this.config.storageKey, serialized);
                }
                catch {
                    // localStorage quota exceeded — fallback to sessionStorage
                    setSessionStorage(this.config.storageKey, serialized);
                }
            }
            else {
                setSessionStorage(this.config.storageKey, serialized);
            }
        }
        catch {
            // Ignore storage errors
        }
    }
    /**
     * Restore queue from storage
     */
    restoreQueue() {
        try {
            let stored = null;
            // Check localStorage first (cross-session persistence)
            if (this.persistMode === 'local' && typeof localStorage !== 'undefined') {
                stored = localStorage.getItem(this.config.storageKey);
            }
            // Fall back to sessionStorage
            if (!stored) {
                stored = getSessionStorage(this.config.storageKey);
            }
            if (stored) {
                const events = JSON.parse(stored);
                if (Array.isArray(events) && events.length > 0) {
                    this.queue = events;
                    logger.debug(`Restored ${events.length} events from storage`);
                }
            }
        }
        catch {
            // Ignore parse errors
        }
    }
}

/**
 * Clianta SDK - Plugin Base
 * @see SDK_VERSION in core/config.ts
 */
/**
 * Base class for plugins
 */
class BasePlugin {
    constructor() {
        this.tracker = null;
    }
    init(tracker) {
        this.tracker = tracker;
    }
    destroy() {
        this.tracker = null;
    }
    track(eventType, eventName, properties) {
        if (this.tracker) {
            this.tracker.track(eventType, eventName, properties);
        }
    }
}

/**
 * Clianta SDK - Page View Plugin
 * @see SDK_VERSION in core/config.ts
 */
/**
 * Page View Plugin - Tracks page views
 */
class PageViewPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.name = 'pageView';
        this.originalPushState = null;
        this.originalReplaceState = null;
        this.popstateHandler = null;
    }
    init(tracker) {
        super.init(tracker);
        // Track initial page view
        this.trackPageView();
        // Track SPA navigation (History API)
        if (typeof window !== 'undefined') {
            // Store originals for cleanup
            this.originalPushState = history.pushState;
            this.originalReplaceState = history.replaceState;
            // Intercept pushState and replaceState
            const self = this;
            history.pushState = function (...args) {
                self.originalPushState.apply(history, args);
                self.trackPageView();
                // Notify other plugins (e.g. ScrollPlugin) about navigation
                window.dispatchEvent(new Event('clianta:navigation'));
            };
            history.replaceState = function (...args) {
                self.originalReplaceState.apply(history, args);
                self.trackPageView();
                window.dispatchEvent(new Event('clianta:navigation'));
            };
            // Handle back/forward navigation
            this.popstateHandler = () => this.trackPageView();
            window.addEventListener('popstate', this.popstateHandler);
        }
    }
    destroy() {
        // Restore original history methods
        if (this.originalPushState) {
            history.pushState = this.originalPushState;
            this.originalPushState = null;
        }
        if (this.originalReplaceState) {
            history.replaceState = this.originalReplaceState;
            this.originalReplaceState = null;
        }
        // Remove popstate listener
        if (this.popstateHandler && typeof window !== 'undefined') {
            window.removeEventListener('popstate', this.popstateHandler);
            this.popstateHandler = null;
        }
        super.destroy();
    }
    trackPageView() {
        if (typeof window === 'undefined' || typeof document === 'undefined')
            return;
        this.track('page_view', 'Page Viewed', {
            title: document.title,
            path: window.location.pathname,
            search: window.location.search,
            hash: window.location.hash,
            referrer: document.referrer || 'direct',
            viewport: `${window.innerWidth}x${window.innerHeight}`,
        });
    }
}

/**
 * Clianta SDK - Scroll Depth Plugin
 * @see SDK_VERSION in core/config.ts
 */
/**
 * Scroll Depth Plugin - Tracks scroll milestones
 */
class ScrollPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.name = 'scroll';
        this.milestonesReached = new Set();
        this.maxScrollDepth = 0;
        this.pageLoadTime = 0;
        this.scrollTimeout = null;
        this.boundHandler = null;
        /** SPA navigation — listen for PageViewPlugin's custom event instead of patching history */
        this.navigationHandler = null;
        this.popstateHandler = null;
    }
    init(tracker) {
        super.init(tracker);
        this.pageLoadTime = Date.now();
        if (typeof window !== 'undefined') {
            this.boundHandler = this.handleScroll.bind(this);
            window.addEventListener('scroll', this.boundHandler, { passive: true });
            // Listen for navigation events dispatched by PageViewPlugin
            // instead of independently monkey-patching history.pushState
            this.navigationHandler = () => this.resetForNavigation();
            window.addEventListener('clianta:navigation', this.navigationHandler);
            // Handle back/forward navigation
            this.popstateHandler = () => this.resetForNavigation();
            window.addEventListener('popstate', this.popstateHandler);
        }
    }
    destroy() {
        if (this.boundHandler && typeof window !== 'undefined') {
            window.removeEventListener('scroll', this.boundHandler);
        }
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }
        if (this.navigationHandler && typeof window !== 'undefined') {
            window.removeEventListener('clianta:navigation', this.navigationHandler);
            this.navigationHandler = null;
        }
        if (this.popstateHandler && typeof window !== 'undefined') {
            window.removeEventListener('popstate', this.popstateHandler);
            this.popstateHandler = null;
        }
        super.destroy();
    }
    /**
     * Reset scroll tracking for SPA navigation
     */
    resetForNavigation() {
        this.milestonesReached.clear();
        this.maxScrollDepth = 0;
        this.pageLoadTime = Date.now();
    }
    handleScroll() {
        // Debounce scroll tracking
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }
        this.scrollTimeout = setTimeout(() => this.trackScrollDepth(), 150);
    }
    trackScrollDepth() {
        if (typeof window === 'undefined' || typeof document === 'undefined')
            return;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollableHeight = documentHeight - windowHeight;
        // Guard against divide-by-zero on short pages
        if (scrollableHeight <= 0)
            return;
        const scrollPercent = Math.floor((scrollTop / scrollableHeight) * 100);
        // Clamp to valid range
        const clampedPercent = Math.max(0, Math.min(100, scrollPercent));
        // Update max scroll depth
        if (clampedPercent > this.maxScrollDepth) {
            this.maxScrollDepth = clampedPercent;
        }
        // Track milestones
        for (const milestone of SCROLL_MILESTONES) {
            if (clampedPercent >= milestone && !this.milestonesReached.has(milestone)) {
                this.milestonesReached.add(milestone);
                this.track('scroll_depth', `Scrolled ${milestone}%`, {
                    depth: milestone,
                    maxDepth: this.maxScrollDepth,
                    timeToReach: Date.now() - this.pageLoadTime,
                });
            }
        }
    }
}

/**
 * Clianta SDK - Form Tracking Plugin
 * @see SDK_VERSION in core/config.ts
 */
/**
 * Form Tracking Plugin - Auto-tracks form views, interactions, and submissions
 */
class FormsPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.name = 'forms';
        this.trackedForms = new WeakSet();
        this.formInteractions = new Set();
        this.observer = null;
        this.listeners = [];
    }
    init(tracker) {
        super.init(tracker);
        if (typeof document === 'undefined')
            return;
        // Track existing forms
        this.trackAllForms();
        // Watch for dynamically added forms
        if (typeof MutationObserver !== 'undefined') {
            this.observer = new MutationObserver(() => this.trackAllForms());
            this.observer.observe(document.body, { childList: true, subtree: true });
        }
    }
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        // Remove all tracked event listeners
        for (const { element, event, handler } of this.listeners) {
            element.removeEventListener(event, handler);
        }
        this.listeners = [];
        super.destroy();
    }
    /**
     * Track event listener for cleanup
     */
    addListener(element, event, handler) {
        element.addEventListener(event, handler);
        this.listeners.push({ element, event, handler });
    }
    trackAllForms() {
        document.querySelectorAll('form').forEach((form) => {
            this.setupFormTracking(form);
        });
    }
    setupFormTracking(form) {
        if (this.trackedForms.has(form))
            return;
        this.trackedForms.add(form);
        const formId = form.id || form.name || `form-${Math.random().toString(36).substr(2, 9)}`;
        // Track form view
        this.track('form_view', 'Form Viewed', {
            formId,
            action: form.action,
            method: form.method,
            fieldCount: form.elements.length,
        });
        // Track field interactions
        Array.from(form.elements).forEach((field) => {
            if (field instanceof HTMLInputElement ||
                field instanceof HTMLSelectElement ||
                field instanceof HTMLTextAreaElement) {
                if (!field.name || field.type === 'submit' || field.type === 'button')
                    return;
                ['focus', 'blur', 'change'].forEach((eventType) => {
                    const handler = () => {
                        const key = `${formId}-${field.name}-${eventType}`;
                        if (!this.formInteractions.has(key)) {
                            this.formInteractions.add(key);
                            this.track('form_interaction', 'Form Field Interaction', {
                                formId,
                                fieldName: field.name,
                                fieldType: field.type,
                                interactionType: eventType,
                            });
                        }
                    };
                    this.addListener(field, eventType, handler);
                });
            }
        });
        // Track form submission
        const submitHandler = () => {
            this.track('form_submit', 'Form Submitted', {
                formId,
                action: form.action,
                method: form.method,
            });
            // Auto-identify if email field found
            this.autoIdentify(form);
        };
        this.addListener(form, 'submit', submitHandler);
    }
    autoIdentify(form) {
        const emailField = form.querySelector('input[type="email"], input[name*="email"]');
        if (!emailField?.value || !this.tracker)
            return;
        const email = emailField.value;
        const traits = {};
        // Capture common fields
        const firstNameField = form.querySelector('[name*="first"], [name*="fname"]');
        const lastNameField = form.querySelector('[name*="last"], [name*="lname"]');
        const companyField = form.querySelector('[name*="company"], [name*="organization"]');
        const phoneField = form.querySelector('[type="tel"], [name*="phone"]');
        if (firstNameField?.value)
            traits.firstName = firstNameField.value;
        if (lastNameField?.value)
            traits.lastName = lastNameField.value;
        if (companyField?.value)
            traits.company = companyField.value;
        if (phoneField?.value)
            traits.phone = phoneField.value;
        this.tracker.identify(email, traits);
    }
}

/**
 * Clianta SDK - Click Tracking Plugin
 * @see SDK_VERSION in core/config.ts
 */
/**
 * Click Tracking Plugin - Tracks button and CTA clicks
 */
class ClicksPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.name = 'clicks';
        this.boundHandler = null;
    }
    init(tracker) {
        super.init(tracker);
        if (typeof document !== 'undefined') {
            this.boundHandler = this.handleClick.bind(this);
            document.addEventListener('click', this.boundHandler, true);
        }
    }
    destroy() {
        if (this.boundHandler && typeof document !== 'undefined') {
            document.removeEventListener('click', this.boundHandler, true);
        }
        super.destroy();
    }
    handleClick(e) {
        const target = e.target;
        if (!target || !isTrackableClickElement(target))
            return;
        const buttonText = getElementText(target, 100);
        const elementInfo = getElementInfo(target);
        this.track('button_click', 'Button Clicked', {
            buttonText,
            elementType: target.tagName.toLowerCase(),
            elementId: elementInfo.id,
            elementClass: elementInfo.className,
            href: target.href || undefined,
            x: Math.round((e.clientX / window.innerWidth) * 100),
            y: Math.round((e.clientY / window.innerHeight) * 100),
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
        });
    }
}

/**
 * Clianta SDK - Engagement Plugin
 * @see SDK_VERSION in core/config.ts
 */
/**
 * Engagement Plugin - Tracks user engagement and time on page
 */
class EngagementPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.name = 'engagement';
        this.pageLoadTime = 0;
        this.engagementStartTime = 0;
        this.isEngaged = false;
        this.engagementTimeout = null;
        this.boundMarkEngaged = null;
        this.boundTrackTimeOnPage = null;
        this.boundVisibilityHandler = null;
        /** SPA navigation — listen for PageViewPlugin's custom event instead of patching history */
        this.navigationHandler = null;
        this.popstateHandler = null;
    }
    init(tracker) {
        super.init(tracker);
        this.pageLoadTime = Date.now();
        this.engagementStartTime = Date.now();
        if (typeof document === 'undefined' || typeof window === 'undefined')
            return;
        // Setup engagement detection
        this.boundMarkEngaged = this.markEngaged.bind(this);
        this.boundTrackTimeOnPage = this.trackTimeOnPage.bind(this);
        this.boundVisibilityHandler = () => {
            if (document.visibilityState === 'hidden') {
                this.trackTimeOnPage();
            }
            else {
                // Reset engagement timer when page becomes visible again
                this.engagementStartTime = Date.now();
            }
        };
        ['mousemove', 'keydown', 'touchstart', 'scroll'].forEach((event) => {
            document.addEventListener(event, this.boundMarkEngaged, { passive: true });
        });
        // Track time on page before unload
        window.addEventListener('beforeunload', this.boundTrackTimeOnPage);
        document.addEventListener('visibilitychange', this.boundVisibilityHandler);
        // Listen for navigation events dispatched by PageViewPlugin
        // instead of independently monkey-patching history.pushState
        this.navigationHandler = () => this.resetForNavigation();
        window.addEventListener('clianta:navigation', this.navigationHandler);
        // Handle back/forward navigation
        this.popstateHandler = () => this.resetForNavigation();
        window.addEventListener('popstate', this.popstateHandler);
    }
    destroy() {
        if (this.boundMarkEngaged && typeof document !== 'undefined') {
            ['mousemove', 'keydown', 'touchstart', 'scroll'].forEach((event) => {
                document.removeEventListener(event, this.boundMarkEngaged);
            });
        }
        if (this.boundTrackTimeOnPage && typeof window !== 'undefined') {
            window.removeEventListener('beforeunload', this.boundTrackTimeOnPage);
        }
        if (this.boundVisibilityHandler && typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
        }
        if (this.navigationHandler && typeof window !== 'undefined') {
            window.removeEventListener('clianta:navigation', this.navigationHandler);
            this.navigationHandler = null;
        }
        if (this.popstateHandler && typeof window !== 'undefined') {
            window.removeEventListener('popstate', this.popstateHandler);
            this.popstateHandler = null;
        }
        if (this.engagementTimeout) {
            clearTimeout(this.engagementTimeout);
        }
        super.destroy();
    }
    resetForNavigation() {
        this.pageLoadTime = Date.now();
        this.engagementStartTime = Date.now();
        this.isEngaged = false;
        if (this.engagementTimeout) {
            clearTimeout(this.engagementTimeout);
            this.engagementTimeout = null;
        }
    }
    markEngaged() {
        if (!this.isEngaged) {
            this.isEngaged = true;
            this.track('engagement', 'User Engaged', {
                timeToEngage: Date.now() - this.pageLoadTime,
            });
        }
        // Reset engagement timeout
        if (this.engagementTimeout) {
            clearTimeout(this.engagementTimeout);
        }
        this.engagementTimeout = setTimeout(() => {
            this.isEngaged = false;
        }, 30000); // 30 seconds of inactivity
    }
    trackTimeOnPage() {
        const timeSpent = Math.floor((Date.now() - this.engagementStartTime) / 1000);
        if (timeSpent > 0) {
            this.track('time_on_page', 'Time Spent', {
                seconds: timeSpent,
                engaged: this.isEngaged,
            });
        }
    }
}

/**
 * Clianta SDK - Downloads Plugin
 * @see SDK_VERSION in core/config.ts
 */
/**
 * Downloads Plugin - Tracks file downloads
 */
class DownloadsPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.name = 'downloads';
        this.trackedDownloads = new Set();
        this.boundHandler = null;
        /** SPA navigation — listen for PageViewPlugin's custom event instead of patching history */
        this.navigationHandler = null;
        this.popstateHandler = null;
    }
    init(tracker) {
        super.init(tracker);
        if (typeof document !== 'undefined') {
            this.boundHandler = this.handleClick.bind(this);
            document.addEventListener('click', this.boundHandler, true);
        }
        if (typeof window !== 'undefined') {
            // Listen for navigation events dispatched by PageViewPlugin
            // instead of independently monkey-patching history.pushState
            this.navigationHandler = () => this.resetForNavigation();
            window.addEventListener('clianta:navigation', this.navigationHandler);
            // Handle back/forward navigation
            this.popstateHandler = () => this.resetForNavigation();
            window.addEventListener('popstate', this.popstateHandler);
        }
    }
    destroy() {
        if (this.boundHandler && typeof document !== 'undefined') {
            document.removeEventListener('click', this.boundHandler, true);
        }
        if (this.navigationHandler && typeof window !== 'undefined') {
            window.removeEventListener('clianta:navigation', this.navigationHandler);
            this.navigationHandler = null;
        }
        if (this.popstateHandler && typeof window !== 'undefined') {
            window.removeEventListener('popstate', this.popstateHandler);
            this.popstateHandler = null;
        }
        super.destroy();
    }
    /**
     * Reset download tracking for SPA navigation
     */
    resetForNavigation() {
        this.trackedDownloads.clear();
    }
    handleClick(e) {
        const link = e.target.closest('a');
        if (!link || !link.href)
            return;
        const url = link.href;
        // Check if it's a download link
        if (!isDownloadUrl(url))
            return;
        // Avoid tracking the same download multiple times
        if (this.trackedDownloads.has(url))
            return;
        this.trackedDownloads.add(url);
        this.track('download', 'File Download', {
            url,
            filename: getFilenameFromUrl(url),
            fileType: getFileExtension(url),
            linkText: getElementText(link, 100),
        });
    }
}

/**
 * Clianta SDK - Exit Intent Plugin
 * @see SDK_VERSION in core/config.ts
 */
/**
 * Exit Intent Plugin - Detects when user intends to leave the page
 */
class ExitIntentPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.name = 'exitIntent';
        this.exitIntentShown = false;
        this.pageLoadTime = 0;
        this.boundHandler = null;
        /** SPA navigation — listen for PageViewPlugin's custom event instead of patching history */
        this.navigationHandler = null;
        this.popstateHandler = null;
    }
    init(tracker) {
        super.init(tracker);
        this.pageLoadTime = Date.now();
        // Skip on mobile (no mouse events)
        if (isMobile())
            return;
        if (typeof document !== 'undefined') {
            this.boundHandler = this.handleMouseLeave.bind(this);
            document.addEventListener('mouseleave', this.boundHandler);
        }
        if (typeof window !== 'undefined') {
            // Listen for navigation events dispatched by PageViewPlugin
            // instead of independently monkey-patching history.pushState
            this.navigationHandler = () => this.resetForNavigation();
            window.addEventListener('clianta:navigation', this.navigationHandler);
            // Handle back/forward navigation
            this.popstateHandler = () => this.resetForNavigation();
            window.addEventListener('popstate', this.popstateHandler);
        }
    }
    destroy() {
        if (this.boundHandler && typeof document !== 'undefined') {
            document.removeEventListener('mouseleave', this.boundHandler);
        }
        if (this.navigationHandler && typeof window !== 'undefined') {
            window.removeEventListener('clianta:navigation', this.navigationHandler);
            this.navigationHandler = null;
        }
        if (this.popstateHandler && typeof window !== 'undefined') {
            window.removeEventListener('popstate', this.popstateHandler);
            this.popstateHandler = null;
        }
        super.destroy();
    }
    resetForNavigation() {
        this.exitIntentShown = false;
        this.pageLoadTime = Date.now();
    }
    handleMouseLeave(e) {
        // Only trigger when mouse leaves from the top of the page
        if (e.clientY > 0 || this.exitIntentShown)
            return;
        this.exitIntentShown = true;
        this.track('exit_intent', 'Exit Intent Detected', {
            timeOnPage: Date.now() - this.pageLoadTime,
        });
    }
}

/**
 * Clianta SDK - Error Tracking Plugin
 * @see SDK_VERSION in core/config.ts
 */
/**
 * Error Tracking Plugin - Tracks JavaScript errors
 */
class ErrorsPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.name = 'errors';
        this.boundErrorHandler = null;
        this.boundRejectionHandler = null;
    }
    init(tracker) {
        super.init(tracker);
        if (typeof window !== 'undefined') {
            this.boundErrorHandler = this.handleError.bind(this);
            this.boundRejectionHandler = this.handleRejection.bind(this);
            window.addEventListener('error', this.boundErrorHandler);
            window.addEventListener('unhandledrejection', this.boundRejectionHandler);
        }
    }
    destroy() {
        if (typeof window !== 'undefined') {
            if (this.boundErrorHandler) {
                window.removeEventListener('error', this.boundErrorHandler);
            }
            if (this.boundRejectionHandler) {
                window.removeEventListener('unhandledrejection', this.boundRejectionHandler);
            }
        }
        super.destroy();
    }
    handleError(e) {
        this.track('error', 'JavaScript Error', {
            message: e.message,
            filename: e.filename,
            line: e.lineno,
            column: e.colno,
            stack: e.error?.stack?.substring(0, 500),
        });
    }
    handleRejection(e) {
        this.track('error', 'Unhandled Promise Rejection', {
            reason: String(e.reason).substring(0, 200),
        });
    }
}

/**
 * Clianta SDK - Performance Plugin
 * @see SDK_VERSION in core/config.ts
 */
/**
 * Performance Plugin - Tracks page performance and Web Vitals
 */
class PerformancePlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.name = 'performance';
        this.boundLoadHandler = null;
        this.observers = [];
        this.boundClsVisibilityHandler = null;
    }
    init(tracker) {
        super.init(tracker);
        if (typeof window !== 'undefined') {
            // Track performance after page load
            this.boundLoadHandler = () => {
                // Delay to ensure all metrics are available
                setTimeout(() => this.trackPerformance(), 100);
            };
            window.addEventListener('load', this.boundLoadHandler);
        }
    }
    destroy() {
        if (this.boundLoadHandler && typeof window !== 'undefined') {
            window.removeEventListener('load', this.boundLoadHandler);
        }
        for (const observer of this.observers) {
            observer.disconnect();
        }
        this.observers = [];
        if (this.boundClsVisibilityHandler && typeof window !== 'undefined') {
            window.removeEventListener('visibilitychange', this.boundClsVisibilityHandler);
        }
        super.destroy();
    }
    trackPerformance() {
        if (typeof performance === 'undefined')
            return;
        // Use modern Navigation Timing API (PerformanceNavigationTiming)
        const entries = performance.getEntriesByType('navigation');
        if (entries.length > 0) {
            const navTiming = entries[0];
            const loadTime = Math.round(navTiming.loadEventEnd - navTiming.startTime);
            const domReady = Math.round(navTiming.domContentLoadedEventEnd - navTiming.startTime);
            const ttfb = Math.round(navTiming.responseStart - navTiming.requestStart);
            const domInteractive = Math.round(navTiming.domInteractive - navTiming.startTime);
            this.track('performance', 'Page Performance', {
                loadTime,
                domReady,
                ttfb, // Time to First Byte
                domInteractive,
                // Additional modern metrics
                dns: Math.round(navTiming.domainLookupEnd - navTiming.domainLookupStart),
                connection: Math.round(navTiming.connectEnd - navTiming.connectStart),
                transferSize: navTiming.transferSize,
            });
        }
        else {
            // Fallback for older browsers using deprecated API
            const timing = performance.timing;
            if (!timing)
                return;
            const loadTime = timing.loadEventEnd - timing.navigationStart;
            const domReady = timing.domContentLoadedEventEnd - timing.navigationStart;
            const ttfb = timing.responseStart - timing.navigationStart;
            const domInteractive = timing.domInteractive - timing.navigationStart;
            this.track('performance', 'Page Performance', {
                loadTime,
                domReady,
                ttfb,
                domInteractive,
            });
        }
        // Track Web Vitals if available
        this.trackWebVitals();
    }
    trackWebVitals() {
        // LCP (Largest Contentful Paint)
        if ('PerformanceObserver' in window) {
            try {
                const lcpObserver = new PerformanceObserver((entryList) => {
                    const entries = entryList.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    if (lastEntry) {
                        this.track('performance', 'Web Vital - LCP', {
                            metric: 'LCP',
                            value: Math.round(lastEntry.startTime),
                        });
                    }
                });
                lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
                this.observers.push(lcpObserver);
            }
            catch {
                // LCP not supported
            }
            // FID (First Input Delay)
            try {
                const fidObserver = new PerformanceObserver((entryList) => {
                    const entries = entryList.getEntries();
                    const firstEntry = entries[0];
                    if (firstEntry) {
                        this.track('performance', 'Web Vital - FID', {
                            metric: 'FID',
                            value: Math.round(firstEntry.processingStart - firstEntry.startTime),
                        });
                    }
                });
                fidObserver.observe({ type: 'first-input', buffered: true });
                this.observers.push(fidObserver);
            }
            catch {
                // FID not supported
            }
            // CLS (Cumulative Layout Shift)
            try {
                let clsValue = 0;
                const clsObserver = new PerformanceObserver((entryList) => {
                    const entries = entryList.getEntries();
                    entries.forEach((entry) => {
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value || 0;
                        }
                    });
                });
                clsObserver.observe({ type: 'layout-shift', buffered: true });
                this.observers.push(clsObserver);
                // Report CLS after page is hidden
                this.boundClsVisibilityHandler = () => {
                    if (document.visibilityState === 'hidden' && clsValue > 0) {
                        this.track('performance', 'Web Vital - CLS', {
                            metric: 'CLS',
                            value: Math.round(clsValue * 1000) / 1000,
                        });
                    }
                };
                window.addEventListener('visibilitychange', this.boundClsVisibilityHandler, { once: true });
            }
            catch {
                // CLS not supported
            }
        }
    }
}

/**
 * Clianta Tracking SDK - Popup Forms Plugin
 * @see SDK_VERSION in core/config.ts
 *
 * Auto-loads and displays lead capture popups based on triggers
 */
/**
 * Popup Forms Plugin - Fetches and displays lead capture forms
 */
class PopupFormsPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.name = 'popupForms';
        this.forms = [];
        this.shownForms = new Set();
        this.scrollHandler = null;
        this.exitHandler = null;
        this.delayTimers = [];
        this.clickTriggerListeners = [];
    }
    async init(tracker) {
        super.init(tracker);
        if (typeof window === 'undefined')
            return;
        // Load shown forms from storage
        this.loadShownForms();
        // Fetch active forms
        await this.fetchForms();
        // Setup triggers
        this.setupTriggers();
    }
    destroy() {
        this.removeTriggers();
        for (const timer of this.delayTimers) {
            clearTimeout(timer);
        }
        this.delayTimers = [];
        for (const { element, handler } of this.clickTriggerListeners) {
            element.removeEventListener('click', handler);
        }
        this.clickTriggerListeners = [];
        super.destroy();
    }
    loadShownForms() {
        try {
            const stored = localStorage.getItem('clianta_shown_forms');
            if (stored) {
                const data = JSON.parse(stored);
                this.shownForms = new Set(data.forms || []);
            }
        }
        catch (e) {
            // Ignore storage errors
        }
    }
    saveShownForms() {
        try {
            localStorage.setItem('clianta_shown_forms', JSON.stringify({
                forms: Array.from(this.shownForms),
                timestamp: Date.now(),
            }));
        }
        catch (e) {
            // Ignore storage errors
        }
    }
    async fetchForms() {
        if (!this.tracker)
            return;
        const config = this.tracker.getConfig();
        const workspaceId = this.tracker.getWorkspaceId();
        const apiEndpoint = config.apiEndpoint || 'https://api.clianta.online';
        try {
            const url = encodeURIComponent(window.location.href);
            const response = await fetch(`${apiEndpoint}/api/public/lead-forms/${workspaceId}?url=${url}`);
            if (!response.ok)
                return;
            const data = await response.json();
            if (data.success && Array.isArray(data.data)) {
                this.forms = data.data.filter((form) => this.shouldShowForm(form));
            }
        }
        catch (error) {
            console.error('[Clianta] Failed to fetch forms:', error);
        }
    }
    shouldShowForm(form) {
        // Check show frequency
        if (form.showFrequency === 'once_per_visitor') {
            if (this.shownForms.has(form._id))
                return false;
        }
        else if (form.showFrequency === 'once_per_session') {
            const sessionKey = `clianta_form_${form._id}_shown`;
            if (sessionStorage.getItem(sessionKey))
                return false;
        }
        return true;
    }
    setupTriggers() {
        this.forms.forEach(form => {
            switch (form.trigger.type) {
                case 'delay':
                    this.delayTimers.push(setTimeout(() => this.showForm(form), (form.trigger.value || 5) * 1000));
                    break;
                case 'scroll':
                    this.setupScrollTrigger(form);
                    break;
                case 'exit_intent':
                    this.setupExitIntentTrigger(form);
                    break;
                case 'click':
                    this.setupClickTrigger(form);
                    break;
            }
        });
    }
    setupScrollTrigger(form) {
        const threshold = form.trigger.value || 50;
        this.scrollHandler = () => {
            const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
            if (scrollPercent >= threshold) {
                this.showForm(form);
                if (this.scrollHandler) {
                    window.removeEventListener('scroll', this.scrollHandler);
                }
            }
        };
        window.addEventListener('scroll', this.scrollHandler, { passive: true });
    }
    setupExitIntentTrigger(form) {
        this.exitHandler = (e) => {
            if (e.clientY <= 0) {
                this.showForm(form);
                if (this.exitHandler) {
                    document.removeEventListener('mouseout', this.exitHandler);
                }
            }
        };
        document.addEventListener('mouseout', this.exitHandler);
    }
    setupClickTrigger(form) {
        if (!form.trigger.selector)
            return;
        const elements = document.querySelectorAll(form.trigger.selector);
        elements.forEach(el => {
            const handler = () => this.showForm(form);
            el.addEventListener('click', handler);
            this.clickTriggerListeners.push({ element: el, handler });
        });
    }
    removeTriggers() {
        if (this.scrollHandler) {
            window.removeEventListener('scroll', this.scrollHandler);
        }
        if (this.exitHandler) {
            document.removeEventListener('mouseout', this.exitHandler);
        }
    }
    async showForm(form) {
        // Check if already shown in this session
        if (!this.shouldShowForm(form))
            return;
        // Mark as shown
        this.shownForms.add(form._id);
        this.saveShownForms();
        sessionStorage.setItem(`clianta_form_${form._id}_shown`, 'true');
        // Track view
        await this.trackFormView(form._id);
        // Render form
        this.renderForm(form);
    }
    async trackFormView(formId) {
        if (!this.tracker)
            return;
        const config = this.tracker.getConfig();
        const apiEndpoint = config.apiEndpoint || 'https://api.clianta.online';
        try {
            await fetch(`${apiEndpoint}/api/public/lead-forms/${formId}/view`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
        }
        catch (e) {
            // Ignore tracking errors
        }
    }
    renderForm(form) {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = `clianta-form-overlay-${form._id}`;
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 999998;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        // Create form container
        const container = document.createElement('div');
        container.id = `clianta-form-${form._id}`;
        const style = form.style || {};
        container.style.cssText = `
            background: ${style.backgroundColor || '#FFFFFF'};
            border-radius: ${style.borderRadius || 12}px;
            padding: 24px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            transform: translateY(20px);
            opacity: 0;
            transition: all 0.3s ease;
        `;
        // Build form using safe DOM APIs (no innerHTML for user content)
        this.buildFormDOM(form, container);
        overlay.appendChild(container);
        document.body.appendChild(overlay);
        // Animate in
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            container.style.transform = 'translateY(0)';
            container.style.opacity = '1';
        });
        // Setup event listeners
        this.setupFormEvents(form, overlay, container);
    }
    /**
     * Escape HTML to prevent XSS - used only for static structure
     */
    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    /**
     * Build form using safe DOM APIs (prevents XSS)
     */
    buildFormDOM(form, container) {
        const style = form.style || {};
        const primaryColor = style.primaryColor || '#10B981';
        const textColor = style.textColor || '#18181B';
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.id = 'clianta-form-close';
        closeBtn.style.cssText = `
            position: absolute;
            top: 12px;
            right: 12px;
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #71717A;
            padding: 4px;
        `;
        closeBtn.textContent = '×';
        container.appendChild(closeBtn);
        // Headline
        const headline = document.createElement('h2');
        headline.style.cssText = `font-size: 20px; font-weight: 700; margin-bottom: 8px; color: ${this.escapeHTML(textColor)};`;
        headline.textContent = form.headline || 'Stay in touch';
        container.appendChild(headline);
        // Subheadline
        const subheadline = document.createElement('p');
        subheadline.style.cssText = 'font-size: 14px; color: #71717A; margin-bottom: 16px;';
        subheadline.textContent = form.subheadline || 'Get the latest updates';
        container.appendChild(subheadline);
        // Form element
        const formElement = document.createElement('form');
        formElement.id = 'clianta-form-element';
        // Build fields
        form.fields.forEach(field => {
            const fieldWrapper = document.createElement('div');
            fieldWrapper.style.marginBottom = '12px';
            if (field.type === 'checkbox') {
                // Checkbox layout
                const label = document.createElement('label');
                label.style.cssText = `display: flex; align-items: center; gap: 8px; font-size: 14px; color: ${this.escapeHTML(textColor)}; cursor: pointer;`;
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.name = field.name;
                if (field.required)
                    input.required = true;
                input.style.cssText = 'width: 16px; height: 16px;';
                label.appendChild(input);
                const labelText = document.createTextNode(field.label + ' ');
                label.appendChild(labelText);
                if (field.required) {
                    const requiredMark = document.createElement('span');
                    requiredMark.style.color = '#EF4444';
                    requiredMark.textContent = '*';
                    label.appendChild(requiredMark);
                }
                fieldWrapper.appendChild(label);
            }
            else {
                // Label
                const label = document.createElement('label');
                label.style.cssText = `display: block; font-size: 14px; font-weight: 500; margin-bottom: 4px; color: ${this.escapeHTML(textColor)};`;
                label.textContent = field.label + ' ';
                if (field.required) {
                    const requiredMark = document.createElement('span');
                    requiredMark.style.color = '#EF4444';
                    requiredMark.textContent = '*';
                    label.appendChild(requiredMark);
                }
                fieldWrapper.appendChild(label);
                // Input/Textarea/Select
                if (field.type === 'textarea') {
                    const textarea = document.createElement('textarea');
                    textarea.name = field.name;
                    if (field.placeholder)
                        textarea.placeholder = field.placeholder;
                    if (field.required)
                        textarea.required = true;
                    textarea.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid #E4E4E7; border-radius: 6px; font-size: 14px; resize: vertical; min-height: 80px; box-sizing: border-box;';
                    fieldWrapper.appendChild(textarea);
                }
                else if (field.type === 'select') {
                    const select = document.createElement('select');
                    select.name = field.name;
                    if (field.required)
                        select.required = true;
                    select.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid #E4E4E7; border-radius: 6px; font-size: 14px; box-sizing: border-box; background: white; cursor: pointer;';
                    // Add placeholder option
                    if (field.placeholder) {
                        const placeholderOption = document.createElement('option');
                        placeholderOption.value = '';
                        placeholderOption.textContent = field.placeholder;
                        placeholderOption.disabled = true;
                        placeholderOption.selected = true;
                        select.appendChild(placeholderOption);
                    }
                    // Add options from field.options array if provided
                    if (field.options && Array.isArray(field.options)) {
                        field.options.forEach((opt) => {
                            const option = document.createElement('option');
                            if (typeof opt === 'string') {
                                option.value = opt;
                                option.textContent = opt;
                            }
                            else {
                                option.value = opt.value;
                                option.textContent = opt.label;
                            }
                            select.appendChild(option);
                        });
                    }
                    fieldWrapper.appendChild(select);
                }
                else {
                    const input = document.createElement('input');
                    input.type = field.type;
                    input.name = field.name;
                    if (field.placeholder)
                        input.placeholder = field.placeholder;
                    if (field.required)
                        input.required = true;
                    input.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid #E4E4E7; border-radius: 6px; font-size: 14px; box-sizing: border-box;';
                    fieldWrapper.appendChild(input);
                }
            }
            formElement.appendChild(fieldWrapper);
        });
        // Submit button
        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.style.cssText = `
            width: 100%;
            padding: 10px 16px;
            background: ${this.escapeHTML(primaryColor)};
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            margin-top: 8px;
        `;
        submitBtn.textContent = form.submitButtonText || 'Subscribe';
        formElement.appendChild(submitBtn);
        container.appendChild(formElement);
    }
    setupFormEvents(form, overlay, container) {
        // Close button
        const closeBtn = container.querySelector('#clianta-form-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeForm(form._id, overlay, container));
        }
        // Overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.closeForm(form._id, overlay, container);
            }
        });
        // Form submit
        const formElement = container.querySelector('#clianta-form-element');
        if (formElement) {
            formElement.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleSubmit(form, formElement, container);
            });
        }
    }
    closeForm(formId, overlay, container) {
        container.style.transform = 'translateY(20px)';
        container.style.opacity = '0';
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.remove();
        }, 300);
    }
    async handleSubmit(form, formElement, container) {
        if (!this.tracker)
            return;
        const config = this.tracker.getConfig();
        const apiEndpoint = config.apiEndpoint || 'https://api.clianta.online';
        const visitorId = this.tracker.getVisitorId();
        // Collect form data
        const formData = new FormData(formElement);
        const data = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });
        // Disable submit button
        const submitBtn = formElement.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
        }
        try {
            const response = await fetch(`${apiEndpoint}/api/public/lead-forms/${form._id}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    visitorId,
                    data,
                    url: window.location.href,
                }),
            });
            const result = await response.json();
            if (result.success) {
                // Show success message using safe DOM APIs
                container.innerHTML = '';
                const successWrapper = document.createElement('div');
                successWrapper.style.cssText = 'text-align: center; padding: 20px;';
                const iconWrapper = document.createElement('div');
                iconWrapper.style.cssText = 'width: 48px; height: 48px; background: #10B981; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;';
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('width', '24');
                svg.setAttribute('height', '24');
                svg.setAttribute('viewBox', '0 0 24 24');
                svg.setAttribute('fill', 'none');
                svg.setAttribute('stroke', 'white');
                svg.setAttribute('stroke-width', '2');
                const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
                polyline.setAttribute('points', '20 6 9 17 4 12');
                svg.appendChild(polyline);
                iconWrapper.appendChild(svg);
                const message = document.createElement('p');
                message.style.cssText = 'font-size: 16px; font-weight: 500; color: #18181B;';
                message.textContent = form.successMessage || 'Thank you!';
                successWrapper.appendChild(iconWrapper);
                successWrapper.appendChild(message);
                container.appendChild(successWrapper);
                // Track identify
                if (data.email) {
                    this.tracker?.identify(data.email, data);
                }
                // Redirect if configured (validate URL to prevent open redirect)
                if (form.redirectUrl) {
                    try {
                        const redirect = new URL(form.redirectUrl, window.location.origin);
                        const isSameOrigin = redirect.origin === window.location.origin;
                        const isSafeProtocol = redirect.protocol === 'https:' || redirect.protocol === 'http:';
                        if (isSameOrigin || isSafeProtocol) {
                            setTimeout(() => {
                                window.location.href = redirect.href;
                            }, 1500);
                        }
                        else {
                            console.warn('[Clianta] Blocked unsafe redirect URL:', form.redirectUrl);
                        }
                    }
                    catch {
                        console.warn('[Clianta] Invalid redirect URL:', form.redirectUrl);
                    }
                }
                // Close after delay
                setTimeout(() => {
                    const overlay = document.getElementById(`clianta-form-overlay-${form._id}`);
                    if (overlay) {
                        this.closeForm(form._id, overlay, container);
                    }
                }, 2000);
            }
        }
        catch (error) {
            console.error('[Clianta] Form submit error:', error);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = form.submitButtonText || 'Subscribe';
            }
        }
    }
}

/**
 * Clianta SDK - Plugins Index
 * Version is defined in core/config.ts as SDK_VERSION
 */
/**
 * Get plugin instance by name
 */
function getPlugin(name) {
    switch (name) {
        case 'pageView':
            return new PageViewPlugin();
        case 'scroll':
            return new ScrollPlugin();
        case 'forms':
            return new FormsPlugin();
        case 'clicks':
            return new ClicksPlugin();
        case 'engagement':
            return new EngagementPlugin();
        case 'downloads':
            return new DownloadsPlugin();
        case 'exitIntent':
            return new ExitIntentPlugin();
        case 'errors':
            return new ErrorsPlugin();
        case 'performance':
            return new PerformancePlugin();
        case 'popupForms':
            return new PopupFormsPlugin();
        default:
            throw new Error(`Unknown plugin: ${name}`);
    }
}

/**
 * Clianta SDK - Consent Storage
 * Handles persistence of consent state
 * @see SDK_VERSION in core/config.ts
 */
const CONSENT_VERSION = 1;
/**
 * Save consent state to storage
 */
function saveConsent(state) {
    try {
        if (typeof localStorage === 'undefined')
            return false;
        const stored = {
            state,
            timestamp: Date.now(),
            version: CONSENT_VERSION,
        };
        localStorage.setItem(STORAGE_KEYS.CONSENT, JSON.stringify(stored));
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Load consent state from storage
 */
function loadConsent() {
    try {
        if (typeof localStorage === 'undefined')
            return null;
        const stored = localStorage.getItem(STORAGE_KEYS.CONSENT);
        if (!stored)
            return null;
        const parsed = JSON.parse(stored);
        // Validate version
        if (parsed.version !== CONSENT_VERSION) {
            clearConsent();
            return null;
        }
        return parsed;
    }
    catch {
        return null;
    }
}
/**
 * Clear consent state from storage
 */
function clearConsent() {
    try {
        if (typeof localStorage === 'undefined')
            return false;
        localStorage.removeItem(STORAGE_KEYS.CONSENT);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Check if consent has been explicitly set
 */
function hasStoredConsent() {
    return loadConsent() !== null;
}

/**
 * Clianta SDK - Consent Manager
 * Manages consent state and event buffering for GDPR/CCPA compliance
 * @see SDK_VERSION in core/config.ts
 */
/** Maximum events to buffer while waiting for consent */
const MAX_BUFFER_SIZE = 100;
/**
 * Manages user consent state for tracking
 */
class ConsentManager {
    constructor(config = {}) {
        this.eventBuffer = [];
        this.callbacks = [];
        this.hasExplicitConsent = false;
        this.config = {
            defaultConsent: { analytics: true, marketing: false, personalization: false },
            waitForConsent: false,
            storageKey: 'mb_consent',
            ...config,
        };
        // Load stored consent or use default
        const stored = loadConsent();
        if (stored) {
            this.state = stored.state;
            this.hasExplicitConsent = true;
            logger.debug('Loaded stored consent:', this.state);
        }
        else {
            this.state = this.config.defaultConsent || { analytics: true };
            this.hasExplicitConsent = false;
            logger.debug('Using default consent:', this.state);
        }
        // Register callback if provided
        if (config.onConsentChange) {
            this.callbacks.push(config.onConsentChange);
        }
    }
    /**
     * Grant consent for specified categories
     */
    grant(categories) {
        const previous = { ...this.state };
        this.state = { ...this.state, ...categories };
        this.hasExplicitConsent = true;
        saveConsent(this.state);
        logger.info('Consent granted:', categories);
        this.notifyChange(previous);
    }
    /**
     * Revoke consent for specified categories
     */
    revoke(categories) {
        const previous = { ...this.state };
        for (const category of categories) {
            this.state[category] = false;
        }
        this.hasExplicitConsent = true;
        saveConsent(this.state);
        logger.info('Consent revoked:', categories);
        this.notifyChange(previous);
    }
    /**
     * Update entire consent state
     */
    update(state) {
        const previous = { ...this.state };
        this.state = { ...state };
        this.hasExplicitConsent = true;
        saveConsent(this.state);
        logger.info('Consent updated:', this.state);
        this.notifyChange(previous);
    }
    /**
     * Reset consent to default (clear stored consent)
     */
    reset() {
        const previous = { ...this.state };
        this.state = this.config.defaultConsent || { analytics: true };
        this.hasExplicitConsent = false;
        this.eventBuffer = [];
        clearConsent();
        logger.info('Consent reset to defaults');
        this.notifyChange(previous);
    }
    /**
     * Get current consent state
     */
    getState() {
        return { ...this.state };
    }
    /**
     * Check if a specific consent category is granted
     */
    hasConsent(category) {
        return this.state[category] === true;
    }
    /**
     * Check if analytics consent is granted (most common check)
     */
    canTrack() {
        // If waiting for consent and no explicit consent given, cannot track
        if (this.config.waitForConsent && !this.hasExplicitConsent) {
            return false;
        }
        return this.state.analytics === true;
    }
    /**
     * Check if explicit consent has been given
     */
    hasExplicit() {
        return this.hasExplicitConsent;
    }
    /**
     * Check if there's stored consent
     */
    hasStored() {
        return hasStoredConsent();
    }
    /**
     * Buffer an event (for waitForConsent mode)
     */
    bufferEvent(event) {
        // Prevent unbounded buffer growth
        if (this.eventBuffer.length >= MAX_BUFFER_SIZE) {
            logger.warn('Consent event buffer full, dropping oldest event');
            this.eventBuffer.shift();
        }
        this.eventBuffer.push(event);
        logger.debug('Event buffered (waiting for consent):', event.eventName);
    }
    /**
     * Get and clear buffered events
     */
    flushBuffer() {
        const events = [...this.eventBuffer];
        this.eventBuffer = [];
        if (events.length > 0) {
            logger.debug(`Flushing ${events.length} buffered events`);
        }
        return events;
    }
    /**
     * Get buffered event count
     */
    getBufferSize() {
        return this.eventBuffer.length;
    }
    /**
     * Register a consent change callback
     */
    onChange(callback) {
        this.callbacks.push(callback);
        // Return unsubscribe function
        return () => {
            const index = this.callbacks.indexOf(callback);
            if (index > -1) {
                this.callbacks.splice(index, 1);
            }
        };
    }
    /**
     * Notify all callbacks of consent change
     */
    notifyChange(previous) {
        for (const callback of this.callbacks) {
            try {
                callback(this.state, previous);
            }
            catch (error) {
                logger.error('Consent change callback error:', error);
            }
        }
    }
}

/**
 * Clianta SDK - Event Triggers Manager
 * Manages event-driven automation and email notifications
 */
/**
 * Event Triggers Manager
 * Handles event-driven automation based on CRM actions
 *
 * Similar to:
 * - Salesforce: Process Builder, Flow Automation
 * - HubSpot: Workflows, Email Sequences
 * - Pipedrive: Workflow Automation
 */
class EventTriggersManager {
    constructor(apiEndpoint, workspaceId, authToken) {
        this.triggers = new Map();
        this.listeners = new Map();
        this.apiEndpoint = apiEndpoint;
        this.workspaceId = workspaceId;
        this.authToken = authToken;
    }
    /**
     * Set authentication token
     */
    setAuthToken(token) {
        this.authToken = token;
    }
    /**
     * Make authenticated API request
     */
    async request(endpoint, options = {}) {
        const url = `${this.apiEndpoint}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        };
        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }
        try {
            const response = await fetch(url, {
                ...options,
                headers,
            });
            const data = await response.json();
            if (!response.ok) {
                return {
                    success: false,
                    error: data.message || 'Request failed',
                    status: response.status,
                };
            }
            return {
                success: true,
                data: data.data || data,
                status: response.status,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Network error',
                status: 0,
            };
        }
    }
    // ============================================
    // TRIGGER MANAGEMENT
    // ============================================
    /**
     * Get all event triggers
     */
    async getTriggers() {
        return this.request(`/api/workspaces/${this.workspaceId}/triggers`);
    }
    /**
     * Get a single trigger by ID
     */
    async getTrigger(triggerId) {
        return this.request(`/api/workspaces/${this.workspaceId}/triggers/${triggerId}`);
    }
    /**
     * Create a new event trigger
     */
    async createTrigger(trigger) {
        const result = await this.request(`/api/workspaces/${this.workspaceId}/triggers`, {
            method: 'POST',
            body: JSON.stringify(trigger),
        });
        // Cache the trigger locally if successful
        if (result.success && result.data?._id) {
            this.triggers.set(result.data._id, result.data);
        }
        return result;
    }
    /**
     * Update an existing trigger
     */
    async updateTrigger(triggerId, updates) {
        const result = await this.request(`/api/workspaces/${this.workspaceId}/triggers/${triggerId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
        // Update cache if successful
        if (result.success && result.data?._id) {
            this.triggers.set(result.data._id, result.data);
        }
        return result;
    }
    /**
     * Delete a trigger
     */
    async deleteTrigger(triggerId) {
        const result = await this.request(`/api/workspaces/${this.workspaceId}/triggers/${triggerId}`, {
            method: 'DELETE',
        });
        // Remove from cache if successful
        if (result.success) {
            this.triggers.delete(triggerId);
        }
        return result;
    }
    /**
     * Activate a trigger
     */
    async activateTrigger(triggerId) {
        return this.updateTrigger(triggerId, { isActive: true });
    }
    /**
     * Deactivate a trigger
     */
    async deactivateTrigger(triggerId) {
        return this.updateTrigger(triggerId, { isActive: false });
    }
    // ============================================
    // EVENT HANDLING (CLIENT-SIDE)
    // ============================================
    /**
     * Register a local event listener for client-side triggers
     * This allows immediate client-side reactions to events
     */
    on(eventType, callback) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }
        this.listeners.get(eventType).add(callback);
        logger.debug(`Event listener registered: ${eventType}`);
    }
    /**
     * Remove an event listener
     */
    off(eventType, callback) {
        const listeners = this.listeners.get(eventType);
        if (listeners) {
            listeners.delete(callback);
        }
    }
    /**
     * Emit an event (client-side only)
     * This will trigger any registered local listeners
     */
    emit(eventType, data) {
        logger.debug(`Event emitted: ${eventType}`, data);
        const listeners = this.listeners.get(eventType);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                }
                catch (error) {
                    logger.error(`Error in event listener for ${eventType}:`, error);
                }
            });
        }
    }
    /**
     * Check if conditions are met for a trigger
     * Supports dynamic field evaluation including custom fields and nested paths
     */
    evaluateConditions(conditions, data) {
        if (!conditions || conditions.length === 0) {
            return true; // No conditions means always fire
        }
        return conditions.every(condition => {
            // Support dot notation for nested fields (e.g., 'customFields.industry')
            const fieldValue = condition.field.includes('.')
                ? this.getNestedValue(data, condition.field)
                : data[condition.field];
            const targetValue = condition.value;
            switch (condition.operator) {
                case 'equals':
                    return fieldValue === targetValue;
                case 'not_equals':
                    return fieldValue !== targetValue;
                case 'contains':
                    return String(fieldValue).includes(String(targetValue));
                case 'greater_than':
                    return Number(fieldValue) > Number(targetValue);
                case 'less_than':
                    return Number(fieldValue) < Number(targetValue);
                case 'in':
                    return Array.isArray(targetValue) && targetValue.includes(fieldValue);
                case 'not_in':
                    return Array.isArray(targetValue) && !targetValue.includes(fieldValue);
                default:
                    return false;
            }
        });
    }
    /**
     * Execute actions for a triggered event (client-side preview)
     * Note: Actual execution happens on the backend
     */
    async executeActions(trigger, data) {
        logger.info(`Executing actions for trigger: ${trigger.name}`);
        for (const action of trigger.actions) {
            try {
                await this.executeAction(action, data);
            }
            catch (error) {
                logger.error(`Failed to execute action:`, error);
            }
        }
    }
    /**
     * Execute a single action
     */
    async executeAction(action, data) {
        switch (action.type) {
            case 'send_email':
                await this.executeSendEmail(action, data);
                break;
            case 'webhook':
                await this.executeWebhook(action, data);
                break;
            case 'create_task':
                await this.executeCreateTask(action, data);
                break;
            case 'update_contact':
                await this.executeUpdateContact(action, data);
                break;
            default:
                logger.warn(`Unknown action type:`, action);
        }
    }
    /**
     * Execute send email action (via backend API)
     */
    async executeSendEmail(action, data) {
        logger.debug('Sending email:', action);
        const payload = {
            to: this.replaceVariables(action.to, data),
            subject: action.subject ? this.replaceVariables(action.subject, data) : undefined,
            body: action.body ? this.replaceVariables(action.body, data) : undefined,
            templateId: action.templateId,
            cc: action.cc,
            bcc: action.bcc,
            from: action.from,
            delayMinutes: action.delayMinutes,
        };
        await this.request(`/api/workspaces/${this.workspaceId}/emails/send`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }
    /**
     * Execute webhook action
     */
    async executeWebhook(action, data) {
        logger.debug('Calling webhook:', action.url);
        const body = action.body ? this.replaceVariables(action.body, data) : JSON.stringify(data);
        await fetch(action.url, {
            method: action.method,
            headers: {
                'Content-Type': 'application/json',
                ...action.headers,
            },
            body,
        });
    }
    /**
     * Execute create task action
     */
    async executeCreateTask(action, data) {
        logger.debug('Creating task:', action.title);
        const dueDate = action.dueDays
            ? new Date(Date.now() + action.dueDays * 24 * 60 * 60 * 1000).toISOString()
            : undefined;
        await this.request(`/api/workspaces/${this.workspaceId}/tasks`, {
            method: 'POST',
            body: JSON.stringify({
                title: this.replaceVariables(action.title, data),
                description: action.description ? this.replaceVariables(action.description, data) : undefined,
                priority: action.priority,
                dueDate,
                assignedTo: action.assignedTo,
                relatedContactId: typeof data.contactId === 'string' ? data.contactId : undefined,
            }),
        });
    }
    /**
     * Execute update contact action
     */
    async executeUpdateContact(action, data) {
        const contactId = data.contactId || data._id;
        if (!contactId) {
            logger.warn('Cannot update contact: no contactId in data');
            return;
        }
        logger.debug('Updating contact:', contactId);
        await this.request(`/api/workspaces/${this.workspaceId}/contacts/${contactId}`, {
            method: 'PUT',
            body: JSON.stringify(action.updates),
        });
    }
    /**
     * Replace variables in a string template
     * Supports syntax like {{contact.email}}, {{opportunity.value}}
     */
    replaceVariables(template, data) {
        return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
            const value = this.getNestedValue(data, path.trim());
            return value !== undefined ? String(value) : match;
        });
    }
    /**
     * Get nested value from object using dot notation
     * Supports dynamic field access including custom fields
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current !== null && current !== undefined && typeof current === 'object'
                ? current[key]
                : undefined;
        }, obj);
    }
    /**
     * Extract all available field paths from a data object
     * Useful for dynamic field discovery based on platform-specific attributes
     * @param obj - The data object to extract fields from
     * @param prefix - Internal use for nested paths
     * @param maxDepth - Maximum depth to traverse (default: 3)
     * @returns Array of field paths (e.g., ['email', 'contact.firstName', 'customFields.industry'])
     */
    extractAvailableFields(obj, prefix = '', maxDepth = 3) {
        if (maxDepth <= 0)
            return [];
        const fields = [];
        for (const key in obj) {
            if (!obj.hasOwnProperty(key))
                continue;
            const value = obj[key];
            const fieldPath = prefix ? `${prefix}.${key}` : key;
            fields.push(fieldPath);
            // Recursively traverse nested objects
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                const nestedFields = this.extractAvailableFields(value, fieldPath, maxDepth - 1);
                fields.push(...nestedFields);
            }
        }
        return fields;
    }
    /**
     * Get available fields from sample data
     * Helps with dynamic field detection for platform-specific attributes
     * @param sampleData - Sample data object to analyze
     * @returns Array of available field paths
     */
    getAvailableFields(sampleData) {
        return this.extractAvailableFields(sampleData);
    }
    // ============================================
    // HELPER METHODS FOR COMMON PATTERNS
    // ============================================
    /**
     * Create a simple email trigger
     * Helper method for common use case
     */
    async createEmailTrigger(config) {
        return this.createTrigger({
            name: config.name,
            eventType: config.eventType,
            conditions: config.conditions,
            actions: [
                {
                    type: 'send_email',
                    to: config.to,
                    subject: config.subject,
                    body: config.body,
                },
            ],
            isActive: true,
        });
    }
    /**
     * Create a task creation trigger
     */
    async createTaskTrigger(config) {
        return this.createTrigger({
            name: config.name,
            eventType: config.eventType,
            conditions: config.conditions,
            actions: [
                {
                    type: 'create_task',
                    title: config.taskTitle,
                    description: config.taskDescription,
                    priority: config.priority,
                    dueDays: config.dueDays,
                },
            ],
            isActive: true,
        });
    }
    /**
     * Create a webhook trigger
     */
    async createWebhookTrigger(config) {
        return this.createTrigger({
            name: config.name,
            eventType: config.eventType,
            conditions: config.conditions,
            actions: [
                {
                    type: 'webhook',
                    url: config.webhookUrl,
                    method: config.method || 'POST',
                },
            ],
            isActive: true,
        });
    }
}

/**
 * Clianta SDK - CRM API Client
 * @see SDK_VERSION in core/config.ts
 */
/**
 * CRM API Client for managing contacts and opportunities
 */
class CRMClient {
    constructor(apiEndpoint, workspaceId, authToken, apiKey) {
        this.apiEndpoint = apiEndpoint;
        this.workspaceId = workspaceId;
        this.authToken = authToken;
        this.apiKey = apiKey;
        this.triggers = new EventTriggersManager(apiEndpoint, workspaceId, authToken);
    }
    /**
     * Set authentication token for API requests (user JWT)
     */
    setAuthToken(token) {
        this.authToken = token;
        this.apiKey = undefined;
        this.triggers.setAuthToken(token);
    }
    /**
     * Set workspace API key for server-to-server requests.
     * Use this instead of setAuthToken when integrating from an external app.
     */
    setApiKey(key) {
        this.apiKey = key;
        this.authToken = undefined;
    }
    /**
     * Validate required parameter exists
     * @throws {Error} if value is null/undefined or empty string
     */
    validateRequired(param, value, methodName) {
        if (value === null || value === undefined || value === '') {
            throw new Error(`[CRMClient.${methodName}] ${param} is required`);
        }
    }
    /**
     * Make authenticated API request
     */
    async request(endpoint, options = {}) {
        const url = `${this.apiEndpoint}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        };
        if (this.apiKey) {
            headers['X-Api-Key'] = this.apiKey;
        }
        else if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }
        try {
            const response = await fetch(url, {
                ...options,
                headers,
            });
            const data = await response.json();
            if (!response.ok) {
                return {
                    success: false,
                    error: data.message || 'Request failed',
                    status: response.status,
                };
            }
            return {
                success: true,
                data: data.data || data,
                status: response.status,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Network error',
                status: 0,
            };
        }
    }
    // ============================================
    // INBOUND EVENTS API (API-key authenticated)
    // ============================================
    /**
     * Send an inbound event from an external app (e.g. user signup on client website).
     * Requires the client to be initialized with an API key via setApiKey() or the constructor.
     *
     * The contact is upserted in the CRM and matching workflow automations fire automatically.
     *
     * @example
     * const crm = new CRMClient('https://api.clianta.online', 'WORKSPACE_ID');
     * crm.setApiKey('mm_live_...');
     *
     * await crm.sendEvent({
     *   event: 'user.registered',
     *   contact: { email: 'alice@example.com', firstName: 'Alice' },
     *   data: { plan: 'free', signupSource: 'homepage' },
     * });
     */
    async sendEvent(payload) {
        const url = `${this.apiEndpoint}/api/public/events`;
        const headers = { 'Content-Type': 'application/json' };
        if (this.apiKey) {
            headers['X-Api-Key'] = this.apiKey;
        }
        else if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) {
                return {
                    success: false,
                    contactCreated: false,
                    event: payload.event,
                    error: data.error || 'Request failed',
                };
            }
            return {
                success: data.success,
                contactCreated: data.contactCreated,
                contactId: data.contactId,
                event: data.event,
            };
        }
        catch (error) {
            return {
                success: false,
                contactCreated: false,
                event: payload.event,
                error: error instanceof Error ? error.message : 'Network error',
            };
        }
    }
    // ============================================
    // CONTACTS API
    // ============================================
    /**
     * Get all contacts with pagination
     */
    async getContacts(params) {
        const queryParams = new URLSearchParams();
        if (params?.page)
            queryParams.set('page', params.page.toString());
        if (params?.limit)
            queryParams.set('limit', params.limit.toString());
        if (params?.search)
            queryParams.set('search', params.search);
        if (params?.status)
            queryParams.set('status', params.status);
        const query = queryParams.toString();
        const endpoint = `/api/workspaces/${this.workspaceId}/contacts${query ? `?${query}` : ''}`;
        return this.request(endpoint);
    }
    /**
     * Get a single contact by ID
     */
    async getContact(contactId) {
        this.validateRequired('contactId', contactId, 'getContact');
        return this.request(`/api/workspaces/${this.workspaceId}/contacts/${contactId}`);
    }
    /**
     * Create a new contact
     */
    async createContact(contact) {
        return this.request(`/api/workspaces/${this.workspaceId}/contacts`, {
            method: 'POST',
            body: JSON.stringify(contact),
        });
    }
    /**
     * Update an existing contact
     */
    async updateContact(contactId, updates) {
        this.validateRequired('contactId', contactId, 'updateContact');
        return this.request(`/api/workspaces/${this.workspaceId}/contacts/${contactId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }
    /**
     * Delete a contact
     */
    async deleteContact(contactId) {
        this.validateRequired('contactId', contactId, 'deleteContact');
        return this.request(`/api/workspaces/${this.workspaceId}/contacts/${contactId}`, {
            method: 'DELETE',
        });
    }
    // ============================================
    // OPPORTUNITIES API
    // ============================================
    /**
     * Get all opportunities with pagination
     */
    async getOpportunities(params) {
        const queryParams = new URLSearchParams();
        if (params?.page)
            queryParams.set('page', params.page.toString());
        if (params?.limit)
            queryParams.set('limit', params.limit.toString());
        if (params?.pipelineId)
            queryParams.set('pipelineId', params.pipelineId);
        if (params?.stageId)
            queryParams.set('stageId', params.stageId);
        const query = queryParams.toString();
        const endpoint = `/api/workspaces/${this.workspaceId}/opportunities${query ? `?${query}` : ''}`;
        return this.request(endpoint);
    }
    /**
     * Get a single opportunity by ID
     */
    async getOpportunity(opportunityId) {
        return this.request(`/api/workspaces/${this.workspaceId}/opportunities/${opportunityId}`);
    }
    /**
     * Create a new opportunity
     */
    async createOpportunity(opportunity) {
        return this.request(`/api/workspaces/${this.workspaceId}/opportunities`, {
            method: 'POST',
            body: JSON.stringify(opportunity),
        });
    }
    /**
     * Update an existing opportunity
     */
    async updateOpportunity(opportunityId, updates) {
        return this.request(`/api/workspaces/${this.workspaceId}/opportunities/${opportunityId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }
    /**
     * Delete an opportunity
     */
    async deleteOpportunity(opportunityId) {
        return this.request(`/api/workspaces/${this.workspaceId}/opportunities/${opportunityId}`, {
            method: 'DELETE',
        });
    }
    /**
     * Move opportunity to a different stage
     */
    async moveOpportunity(opportunityId, stageId) {
        return this.request(`/api/workspaces/${this.workspaceId}/opportunities/${opportunityId}/move`, {
            method: 'POST',
            body: JSON.stringify({ stageId }),
        });
    }
    // ============================================
    // COMPANIES API
    // ============================================
    /**
     * Get all companies with pagination
     */
    async getCompanies(params) {
        const queryParams = new URLSearchParams();
        if (params?.page)
            queryParams.set('page', params.page.toString());
        if (params?.limit)
            queryParams.set('limit', params.limit.toString());
        if (params?.search)
            queryParams.set('search', params.search);
        if (params?.status)
            queryParams.set('status', params.status);
        if (params?.industry)
            queryParams.set('industry', params.industry);
        const query = queryParams.toString();
        const endpoint = `/api/workspaces/${this.workspaceId}/companies${query ? `?${query}` : ''}`;
        return this.request(endpoint);
    }
    /**
     * Get a single company by ID
     */
    async getCompany(companyId) {
        return this.request(`/api/workspaces/${this.workspaceId}/companies/${companyId}`);
    }
    /**
     * Create a new company
     */
    async createCompany(company) {
        return this.request(`/api/workspaces/${this.workspaceId}/companies`, {
            method: 'POST',
            body: JSON.stringify(company),
        });
    }
    /**
     * Update an existing company
     */
    async updateCompany(companyId, updates) {
        return this.request(`/api/workspaces/${this.workspaceId}/companies/${companyId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }
    /**
     * Delete a company
     */
    async deleteCompany(companyId) {
        return this.request(`/api/workspaces/${this.workspaceId}/companies/${companyId}`, {
            method: 'DELETE',
        });
    }
    /**
     * Get contacts belonging to a company
     */
    async getCompanyContacts(companyId, params) {
        const queryParams = new URLSearchParams();
        if (params?.page)
            queryParams.set('page', params.page.toString());
        if (params?.limit)
            queryParams.set('limit', params.limit.toString());
        const query = queryParams.toString();
        const endpoint = `/api/workspaces/${this.workspaceId}/companies/${companyId}/contacts${query ? `?${query}` : ''}`;
        return this.request(endpoint);
    }
    /**
     * Get deals/opportunities belonging to a company
     */
    async getCompanyDeals(companyId, params) {
        const queryParams = new URLSearchParams();
        if (params?.page)
            queryParams.set('page', params.page.toString());
        if (params?.limit)
            queryParams.set('limit', params.limit.toString());
        const query = queryParams.toString();
        const endpoint = `/api/workspaces/${this.workspaceId}/companies/${companyId}/deals${query ? `?${query}` : ''}`;
        return this.request(endpoint);
    }
    // ============================================
    // PIPELINES API
    // ============================================
    /**
     * Get all pipelines
     */
    async getPipelines() {
        return this.request(`/api/workspaces/${this.workspaceId}/pipelines`);
    }
    /**
     * Get a single pipeline by ID
     */
    async getPipeline(pipelineId) {
        return this.request(`/api/workspaces/${this.workspaceId}/pipelines/${pipelineId}`);
    }
    /**
     * Create a new pipeline
     */
    async createPipeline(pipeline) {
        return this.request(`/api/workspaces/${this.workspaceId}/pipelines`, {
            method: 'POST',
            body: JSON.stringify(pipeline),
        });
    }
    /**
     * Update an existing pipeline
     */
    async updatePipeline(pipelineId, updates) {
        return this.request(`/api/workspaces/${this.workspaceId}/pipelines/${pipelineId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }
    /**
     * Delete a pipeline
     */
    async deletePipeline(pipelineId) {
        return this.request(`/api/workspaces/${this.workspaceId}/pipelines/${pipelineId}`, {
            method: 'DELETE',
        });
    }
    // ============================================
    // TASKS API
    // ============================================
    /**
     * Get all tasks with pagination
     */
    async getTasks(params) {
        const queryParams = new URLSearchParams();
        if (params?.page)
            queryParams.set('page', params.page.toString());
        if (params?.limit)
            queryParams.set('limit', params.limit.toString());
        if (params?.status)
            queryParams.set('status', params.status);
        if (params?.priority)
            queryParams.set('priority', params.priority);
        if (params?.contactId)
            queryParams.set('contactId', params.contactId);
        if (params?.companyId)
            queryParams.set('companyId', params.companyId);
        if (params?.opportunityId)
            queryParams.set('opportunityId', params.opportunityId);
        const query = queryParams.toString();
        const endpoint = `/api/workspaces/${this.workspaceId}/tasks${query ? `?${query}` : ''}`;
        return this.request(endpoint);
    }
    /**
     * Get a single task by ID
     */
    async getTask(taskId) {
        return this.request(`/api/workspaces/${this.workspaceId}/tasks/${taskId}`);
    }
    /**
     * Create a new task
     */
    async createTask(task) {
        return this.request(`/api/workspaces/${this.workspaceId}/tasks`, {
            method: 'POST',
            body: JSON.stringify(task),
        });
    }
    /**
     * Update an existing task
     */
    async updateTask(taskId, updates) {
        return this.request(`/api/workspaces/${this.workspaceId}/tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }
    /**
     * Mark a task as completed
     */
    async completeTask(taskId) {
        return this.request(`/api/workspaces/${this.workspaceId}/tasks/${taskId}/complete`, {
            method: 'PATCH',
        });
    }
    /**
     * Delete a task
     */
    async deleteTask(taskId) {
        return this.request(`/api/workspaces/${this.workspaceId}/tasks/${taskId}`, {
            method: 'DELETE',
        });
    }
    // ============================================
    // ACTIVITIES API
    // ============================================
    /**
     * Get activities for a contact
     */
    async getContactActivities(contactId, params) {
        const queryParams = new URLSearchParams();
        if (params?.page)
            queryParams.set('page', params.page.toString());
        if (params?.limit)
            queryParams.set('limit', params.limit.toString());
        if (params?.type)
            queryParams.set('type', params.type);
        const query = queryParams.toString();
        const endpoint = `/api/workspaces/${this.workspaceId}/contacts/${contactId}/activities${query ? `?${query}` : ''}`;
        return this.request(endpoint);
    }
    /**
     * Get activities for an opportunity/deal
     */
    async getOpportunityActivities(opportunityId, params) {
        const queryParams = new URLSearchParams();
        if (params?.page)
            queryParams.set('page', params.page.toString());
        if (params?.limit)
            queryParams.set('limit', params.limit.toString());
        if (params?.type)
            queryParams.set('type', params.type);
        const query = queryParams.toString();
        const endpoint = `/api/workspaces/${this.workspaceId}/opportunities/${opportunityId}/activities${query ? `?${query}` : ''}`;
        return this.request(endpoint);
    }
    /**
     * Create a new activity
     */
    async createActivity(activity) {
        // Determine the correct endpoint based on related entity
        let endpoint;
        if (activity.opportunityId) {
            endpoint = `/api/workspaces/${this.workspaceId}/opportunities/${activity.opportunityId}/activities`;
        }
        else if (activity.contactId) {
            endpoint = `/api/workspaces/${this.workspaceId}/contacts/${activity.contactId}/activities`;
        }
        else {
            endpoint = `/api/workspaces/${this.workspaceId}/activities`;
        }
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(activity),
        });
    }
    /**
     * Update an existing activity
     */
    async updateActivity(activityId, updates) {
        return this.request(`/api/workspaces/${this.workspaceId}/activities/${activityId}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
    }
    /**
     * Delete an activity
     */
    async deleteActivity(activityId) {
        return this.request(`/api/workspaces/${this.workspaceId}/activities/${activityId}`, {
            method: 'DELETE',
        });
    }
    /**
     * Log a call activity
     */
    async logCall(data) {
        return this.createActivity({
            type: 'call',
            title: `${data.direction === 'inbound' ? 'Inbound' : 'Outbound'} Call`,
            direction: data.direction,
            duration: data.duration,
            outcome: data.outcome,
            description: data.notes,
            contactId: data.contactId,
            opportunityId: data.opportunityId,
        });
    }
    /**
     * Log a meeting activity
     */
    async logMeeting(data) {
        return this.createActivity({
            type: 'meeting',
            title: data.title,
            duration: data.duration,
            outcome: data.outcome,
            description: data.notes,
            contactId: data.contactId,
            opportunityId: data.opportunityId,
        });
    }
    /**
     * Add a note to a contact or opportunity
     */
    async addNote(data) {
        return this.createActivity({
            type: 'note',
            title: 'Note',
            description: data.content,
            contactId: data.contactId,
            opportunityId: data.opportunityId,
        });
    }
    // ============================================
    // EMAIL TEMPLATES API
    // ============================================
    /**
     * Get all email templates
     */
    async getEmailTemplates(params) {
        const queryParams = new URLSearchParams();
        if (params?.page)
            queryParams.set('page', params.page.toString());
        if (params?.limit)
            queryParams.set('limit', params.limit.toString());
        const query = queryParams.toString();
        const endpoint = `/api/workspaces/${this.workspaceId}/email-templates${query ? `?${query}` : ''}`;
        return this.request(endpoint);
    }
    /**
     * Get a single email template by ID
     */
    async getEmailTemplate(templateId) {
        return this.request(`/api/workspaces/${this.workspaceId}/email-templates/${templateId}`);
    }
    /**
     * Create a new email template
     */
    async createEmailTemplate(template) {
        return this.request(`/api/workspaces/${this.workspaceId}/email-templates`, {
            method: 'POST',
            body: JSON.stringify(template),
        });
    }
    /**
     * Update an email template
     */
    async updateEmailTemplate(templateId, updates) {
        return this.request(`/api/workspaces/${this.workspaceId}/email-templates/${templateId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }
    /**
     * Delete an email template
     */
    async deleteEmailTemplate(templateId) {
        return this.request(`/api/workspaces/${this.workspaceId}/email-templates/${templateId}`, {
            method: 'DELETE',
        });
    }
    /**
     * Send an email using a template
     */
    async sendEmail(data) {
        return this.request(`/api/workspaces/${this.workspaceId}/emails/send`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }
    // ============================================
    // READ-BACK / DATA RETRIEVAL API
    // ============================================
    /**
     * Get a contact by email address.
     * Returns the first matching contact from a search query.
     */
    async getContactByEmail(email) {
        this.validateRequired('email', email, 'getContactByEmail');
        const queryParams = new URLSearchParams({ search: email, limit: '1' });
        return this.request(`/api/workspaces/${this.workspaceId}/contacts?${queryParams.toString()}`);
    }
    /**
     * Get activity timeline for a contact
     */
    async getContactActivity(contactId, params) {
        this.validateRequired('contactId', contactId, 'getContactActivity');
        const queryParams = new URLSearchParams();
        if (params?.page)
            queryParams.set('page', params.page.toString());
        if (params?.limit)
            queryParams.set('limit', params.limit.toString());
        if (params?.type)
            queryParams.set('type', params.type);
        if (params?.startDate)
            queryParams.set('startDate', params.startDate);
        if (params?.endDate)
            queryParams.set('endDate', params.endDate);
        const query = queryParams.toString();
        const endpoint = `/api/workspaces/${this.workspaceId}/contacts/${contactId}/activities${query ? `?${query}` : ''}`;
        return this.request(endpoint);
    }
    /**
     * Get engagement metrics for a contact (via their linked visitor data)
     */
    async getContactEngagement(contactId) {
        this.validateRequired('contactId', contactId, 'getContactEngagement');
        return this.request(`/api/workspaces/${this.workspaceId}/contacts/${contactId}/engagement`);
    }
    /**
     * Get a full timeline for a contact including events, activities, and opportunities
     */
    async getContactTimeline(contactId, params) {
        this.validateRequired('contactId', contactId, 'getContactTimeline');
        const queryParams = new URLSearchParams();
        if (params?.page)
            queryParams.set('page', params.page.toString());
        if (params?.limit)
            queryParams.set('limit', params.limit.toString());
        const query = queryParams.toString();
        const endpoint = `/api/workspaces/${this.workspaceId}/contacts/${contactId}/timeline${query ? `?${query}` : ''}`;
        return this.request(endpoint);
    }
    /**
     * Search contacts with advanced filters
     */
    async searchContacts(query, filters) {
        const queryParams = new URLSearchParams();
        queryParams.set('search', query);
        if (filters?.status)
            queryParams.set('status', filters.status);
        if (filters?.lifecycleStage)
            queryParams.set('lifecycleStage', filters.lifecycleStage);
        if (filters?.source)
            queryParams.set('source', filters.source);
        if (filters?.tags)
            queryParams.set('tags', filters.tags.join(','));
        if (filters?.page)
            queryParams.set('page', filters.page.toString());
        if (filters?.limit)
            queryParams.set('limit', filters.limit.toString());
        const qs = queryParams.toString();
        const endpoint = `/api/workspaces/${this.workspaceId}/contacts${qs ? `?${qs}` : ''}`;
        return this.request(endpoint);
    }
    // ============================================
    // WEBHOOK MANAGEMENT API
    // ============================================
    /**
     * List all webhook subscriptions
     */
    async listWebhooks(params) {
        const queryParams = new URLSearchParams();
        if (params?.page)
            queryParams.set('page', params.page.toString());
        if (params?.limit)
            queryParams.set('limit', params.limit.toString());
        const query = queryParams.toString();
        return this.request(`/api/workspaces/${this.workspaceId}/webhooks${query ? `?${query}` : ''}`);
    }
    /**
     * Create a new webhook subscription
     */
    async createWebhook(data) {
        return this.request(`/api/workspaces/${this.workspaceId}/webhooks`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }
    /**
     * Delete a webhook subscription
     */
    async deleteWebhook(webhookId) {
        this.validateRequired('webhookId', webhookId, 'deleteWebhook');
        return this.request(`/api/workspaces/${this.workspaceId}/webhooks/${webhookId}`, {
            method: 'DELETE',
        });
    }
    // ============================================
    // EVENT TRIGGERS API (delegated to triggers manager)
    // ============================================
    /**
     * Get all event triggers
     */
    async getEventTriggers() {
        return this.triggers.getTriggers();
    }
    /**
     * Create a new event trigger
     */
    async createEventTrigger(trigger) {
        return this.triggers.createTrigger(trigger);
    }
    /**
     * Update an event trigger
     */
    async updateEventTrigger(triggerId, updates) {
        return this.triggers.updateTrigger(triggerId, updates);
    }
    /**
     * Delete an event trigger
     */
    async deleteEventTrigger(triggerId) {
        return this.triggers.deleteTrigger(triggerId);
    }
}

/**
 * Clianta SDK - Main Tracker Class
 * @see SDK_VERSION in core/config.ts
 */
/**
 * Main Clianta Tracker Class
 */
class Tracker {
    constructor(workspaceId, userConfig = {}) {
        this.plugins = [];
        this.isInitialized = false;
        /** contactId after a successful identify() call */
        this.contactId = null;
        /** Pending identify retry on next flush */
        this.pendingIdentify = null;
        /** Registered event schemas for validation */
        this.eventSchemas = new Map();
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
    createVisitorId() {
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
    createSessionId() {
        return getOrCreateSessionId(this.config.sessionTimeout);
    }
    /**
     * Handle consent state changes
     */
    onConsentChange(state, previous) {
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
    initPlugins() {
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
            }
            catch (error) {
                logger.error(`Failed to load plugin: ${pluginName}`, error);
            }
        }
    }
    /**
     * Track a custom event
     */
    track(eventType, eventName, properties = {}) {
        if (!this.isInitialized) {
            logger.warn('SDK not initialized, event dropped');
            return;
        }
        const event = {
            workspaceId: this.workspaceId,
            visitorId: this.visitorId,
            sessionId: this.sessionId,
            eventType: eventType,
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
            event.contactId = this.contactId;
        }
        // Validate event against registered schema (debug mode only)
        this.validateEventSchema(eventType, properties);
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
    page(name, properties = {}) {
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
    async identify(email, traits = {}) {
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
        }
        else {
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
    async sendEvent(payload) {
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
    async getVisitorProfile() {
        if (!this.isInitialized) {
            logger.warn('SDK not initialized');
            return null;
        }
        const result = await this.transport.fetchData(`/api/public/track/visitor/${this.workspaceId}/${this.visitorId}/profile`);
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
    async getVisitorActivity(options) {
        if (!this.isInitialized) {
            logger.warn('SDK not initialized');
            return null;
        }
        const params = {};
        if (options?.page)
            params.page = options.page.toString();
        if (options?.limit)
            params.limit = options.limit.toString();
        if (options?.eventType)
            params.eventType = options.eventType;
        if (options?.startDate)
            params.startDate = options.startDate;
        if (options?.endDate)
            params.endDate = options.endDate;
        const result = await this.transport.fetchData(`/api/public/track/visitor/${this.workspaceId}/${this.visitorId}/activity`, params);
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
    async getVisitorTimeline() {
        if (!this.isInitialized) {
            logger.warn('SDK not initialized');
            return null;
        }
        const result = await this.transport.fetchData(`/api/public/track/visitor/${this.workspaceId}/${this.visitorId}/timeline`);
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
    async getVisitorEngagement() {
        if (!this.isInitialized) {
            logger.warn('SDK not initialized');
            return null;
        }
        const result = await this.transport.fetchData(`/api/public/track/visitor/${this.workspaceId}/${this.visitorId}/engagement`);
        if (result.success && result.data) {
            return result.data;
        }
        logger.warn('Failed to fetch visitor engagement:', result.error);
        return null;
    }
    /**
     * Retry pending identify call
     */
    async retryPendingIdentify() {
        if (!this.pendingIdentify)
            return;
        const { email, traits } = this.pendingIdentify;
        this.pendingIdentify = null;
        await this.identify(email, traits);
    }
    /**
     * Update consent state
     */
    consent(state) {
        this.consentManager.update(state);
    }
    /**
     * Get current consent state
     */
    getConsentState() {
        return this.consentManager.getState();
    }
    /**
     * Toggle debug mode
     */
    debug(enabled) {
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
    registerEventSchema(eventType, schema) {
        this.eventSchemas.set(eventType, schema);
        logger.debug('Event schema registered:', eventType);
    }
    /**
     * Validate event properties against a registered schema (debug mode only)
     */
    validateEventSchema(eventType, properties) {
        if (!this.config.debug)
            return;
        const schema = this.eventSchemas.get(eventType);
        if (!schema)
            return;
        for (const [key, expectedType] of Object.entries(schema)) {
            const value = properties[key];
            if (value === undefined) {
                logger.warn(`[Schema] Missing property "${key}" for event type "${eventType}"`);
                continue;
            }
            let valid = false;
            switch (expectedType) {
                case 'string':
                    valid = typeof value === 'string';
                    break;
                case 'number':
                    valid = typeof value === 'number';
                    break;
                case 'boolean':
                    valid = typeof value === 'boolean';
                    break;
                case 'object':
                    valid = typeof value === 'object' && !Array.isArray(value);
                    break;
                case 'array':
                    valid = Array.isArray(value);
                    break;
            }
            if (!valid) {
                logger.warn(`[Schema] Property "${key}" for event "${eventType}" expected ${expectedType}, got ${typeof value}`);
            }
        }
    }
    /**
     * Get visitor ID
     */
    getVisitorId() {
        return this.visitorId;
    }
    /**
     * Get session ID
     */
    getSessionId() {
        return this.sessionId;
    }
    /**
     * Get workspace ID
     */
    getWorkspaceId() {
        return this.workspaceId;
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Force flush event queue
     */
    async flush() {
        await this.retryPendingIdentify();
        await this.queue.flush();
    }
    /**
     * Reset visitor and session (for logout)
     */
    reset() {
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
    deleteData() {
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
            }
            catch {
                // Ignore errors
            }
        }
        // Clear localStorage items
        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.removeItem(STORAGE_KEYS.VISITOR_ID);
                localStorage.removeItem(STORAGE_KEYS.CONSENT);
                localStorage.removeItem(STORAGE_KEYS.EVENT_QUEUE);
            }
            catch {
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
    async destroy() {
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

/**
 * Clianta SDK
 * Professional CRM and tracking SDK for lead generation
 * @see SDK_VERSION in core/config.ts
 */
// Global instance cache
let globalInstance = null;
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
function clianta(workspaceId, config) {
    // Return existing instance if same workspace
    if (globalInstance && globalInstance.getWorkspaceId() === workspaceId) {
        return globalInstance;
    }
    // Destroy existing instance if workspace changed
    if (globalInstance) {
        globalInstance.destroy();
    }
    // Create new instance
    globalInstance = new Tracker(workspaceId, config);
    return globalInstance;
}
// Attach to window for <script> usage
if (typeof window !== 'undefined') {
    window.clianta = clianta;
    window.Clianta = {
        clianta,
        Tracker,
        CRMClient,
        ConsentManager,
        EventTriggersManager,
    };
}

exports.CRMClient = CRMClient;
exports.ConsentManager = ConsentManager;
exports.EventTriggersManager = EventTriggersManager;
exports.SDK_VERSION = SDK_VERSION;
exports.Tracker = Tracker;
exports.clianta = clianta;
exports.default = clianta;
//# sourceMappingURL=clianta.cjs.js.map
