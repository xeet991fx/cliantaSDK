/*!
 * Clianta SDK v1.1.1
 * (c) 2026 Clianta
 * Released under the MIT License.
 */
import { jsx } from 'react/jsx-runtime';
import { createContext, useRef, useEffect, useContext } from 'react';

/**
 * Clianta SDK - Configuration
 * @see SDK_VERSION in core/config.ts
 */
/** SDK Version */
const SDK_VERSION = '1.1.0';
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
    'popupForms',
];
/** Default configuration values */
const DEFAULT_CONFIG = {
    projectId: '',
    apiEndpoint: getDefaultApiEndpoint(),
    authToken: '',
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
     * Send identify request
     */
    async sendIdentify(data) {
        const url = `${this.config.apiEndpoint}/api/public/track/identify`;
        const payload = JSON.stringify(data);
        return this.send(url, payload);
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
    document.cookie = name + '=' + value + expires + '; path=/; SameSite=Lax';
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
/**
 * Event queue with batching, persistence, and auto-flush
 */
class EventQueue {
    constructor(transport, config = {}) {
        this.queue = [];
        this.flushTimer = null;
        this.isFlushing = false;
        this.transport = transport;
        this.config = {
            batchSize: config.batchSize ?? 10,
            flushInterval: config.flushInterval ?? 5000,
            maxQueueSize: config.maxQueueSize ?? MAX_QUEUE_SIZE,
            storageKey: config.storageKey ?? STORAGE_KEYS.EVENT_QUEUE,
        };
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
     * Flush the queue (send all events)
     */
    async flush() {
        if (this.isFlushing || this.queue.length === 0) {
            return;
        }
        this.isFlushing = true;
        try {
            // Take all events from queue
            const events = this.queue.splice(0, this.queue.length);
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
    }
    /**
     * Stop the flush timer
     */
    destroy() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
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
        window.addEventListener('beforeunload', () => {
            this.flushSync();
        });
        // Flush when page becomes hidden
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.flushSync();
            }
        });
        // Flush on page hide (iOS Safari)
        window.addEventListener('pagehide', () => {
            this.flushSync();
        });
    }
    /**
     * Persist queue to localStorage
     */
    persistQueue(events) {
        try {
            setLocalStorage(this.config.storageKey, JSON.stringify(events));
        }
        catch {
            // Ignore storage errors
        }
    }
    /**
     * Restore queue from localStorage
     */
    restoreQueue() {
        try {
            const stored = getLocalStorage(this.config.storageKey);
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
    }
    init(tracker) {
        super.init(tracker);
        // Track initial page view
        this.trackPageView();
        // Track SPA navigation (History API)
        if (typeof window !== 'undefined') {
            // Intercept pushState and replaceState
            const originalPushState = history.pushState;
            const originalReplaceState = history.replaceState;
            history.pushState = (...args) => {
                originalPushState.apply(history, args);
                this.trackPageView();
            };
            history.replaceState = (...args) => {
                originalReplaceState.apply(history, args);
                this.trackPageView();
            };
            // Handle back/forward navigation
            window.addEventListener('popstate', () => {
                this.trackPageView();
            });
        }
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
    }
    init(tracker) {
        super.init(tracker);
        this.pageLoadTime = Date.now();
        if (typeof window !== 'undefined') {
            this.boundHandler = this.handleScroll.bind(this);
            window.addEventListener('scroll', this.boundHandler, { passive: true });
        }
    }
    destroy() {
        if (this.boundHandler && typeof window !== 'undefined') {
            window.removeEventListener('scroll', this.boundHandler);
        }
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }
        super.destroy();
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
        const scrollPercent = Math.floor((scrollTop / (documentHeight - windowHeight)) * 100);
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
        super.destroy();
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
                    field.addEventListener(eventType, () => {
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
                    });
                });
            }
        });
        // Track form submission
        form.addEventListener('submit', () => {
            this.track('form_submit', 'Form Submitted', {
                formId,
                action: form.action,
                method: form.method,
            });
            // Auto-identify if email field found
            this.autoIdentify(form);
        });
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
        ['mousemove', 'keydown', 'touchstart', 'scroll'].forEach((event) => {
            document.addEventListener(event, this.boundMarkEngaged, { passive: true });
        });
        // Track time on page before unload
        window.addEventListener('beforeunload', this.boundTrackTimeOnPage);
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.trackTimeOnPage();
            }
            else {
                // Reset engagement timer when page becomes visible again
                this.engagementStartTime = Date.now();
            }
        });
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
        if (this.engagementTimeout) {
            clearTimeout(this.engagementTimeout);
        }
        super.destroy();
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
    }
    destroy() {
        if (this.boundHandler && typeof document !== 'undefined') {
            document.removeEventListener('mouseleave', this.boundHandler);
        }
        super.destroy();
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
    }
    init(tracker) {
        super.init(tracker);
        if (typeof window !== 'undefined') {
            // Track performance after page load
            window.addEventListener('load', () => {
                // Delay to ensure all metrics are available
                setTimeout(() => this.trackPerformance(), 100);
            });
        }
    }
    trackPerformance() {
        if (typeof performance === 'undefined')
            return;
        // Use Navigation Timing API
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
            ttfb, // Time to First Byte
            domInteractive,
        });
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
                // Report CLS after page is hidden
                window.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'hidden' && clsValue > 0) {
                        this.track('performance', 'Web Vital - CLS', {
                            metric: 'CLS',
                            value: Math.round(clsValue * 1000) / 1000,
                        });
                    }
                }, { once: true });
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
                    setTimeout(() => this.showForm(form), (form.trigger.value || 5) * 1000);
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
            el.addEventListener('click', () => this.showForm(form));
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
        // Build form HTML
        container.innerHTML = this.buildFormHTML(form);
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
    buildFormHTML(form) {
        const style = form.style || {};
        const primaryColor = style.primaryColor || '#10B981';
        const textColor = style.textColor || '#18181B';
        let fieldsHTML = form.fields.map(field => {
            const requiredMark = field.required ? '<span style="color: #EF4444;">*</span>' : '';
            if (field.type === 'textarea') {
                return `
                    <div style="margin-bottom: 12px;">
                        <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 4px; color: ${textColor};">
                            ${field.label} ${requiredMark}
                        </label>
                        <textarea
                            name="${field.name}"
                            placeholder="${field.placeholder || ''}"
                            ${field.required ? 'required' : ''}
                            style="width: 100%; padding: 8px 12px; border: 1px solid #E4E4E7; border-radius: 6px; font-size: 14px; resize: vertical; min-height: 80px;"
                        ></textarea>
                    </div>
                `;
            }
            else if (field.type === 'checkbox') {
                return `
                    <div style="margin-bottom: 12px;">
                        <label style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: ${textColor}; cursor: pointer;">
                            <input
                                type="checkbox"
                                name="${field.name}"
                                ${field.required ? 'required' : ''}
                                style="width: 16px; height: 16px;"
                            />
                            ${field.label} ${requiredMark}
                        </label>
                    </div>
                `;
            }
            else {
                return `
                    <div style="margin-bottom: 12px;">
                        <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 4px; color: ${textColor};">
                            ${field.label} ${requiredMark}
                        </label>
                        <input
                            type="${field.type}"
                            name="${field.name}"
                            placeholder="${field.placeholder || ''}"
                            ${field.required ? 'required' : ''}
                            style="width: 100%; padding: 8px 12px; border: 1px solid #E4E4E7; border-radius: 6px; font-size: 14px; box-sizing: border-box;"
                        />
                    </div>
                `;
            }
        }).join('');
        return `
            <button id="clianta-form-close" style="
                position: absolute;
                top: 12px;
                right: 12px;
                background: none;
                border: none;
                font-size: 20px;
                cursor: pointer;
                color: #71717A;
                padding: 4px;
            ">&times;</button>
            <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 8px; color: ${textColor};">
                ${form.headline || 'Stay in touch'}
            </h2>
            <p style="font-size: 14px; color: #71717A; margin-bottom: 16px;">
                ${form.subheadline || 'Get the latest updates'}
            </p>
            <form id="clianta-form-element">
                ${fieldsHTML}
                <button type="submit" style="
                    width: 100%;
                    padding: 10px 16px;
                    background: ${primaryColor};
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    margin-top: 8px;
                ">
                    ${form.submitButtonText || 'Subscribe'}
                </button>
            </form>
        `;
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
            submitBtn.innerHTML = 'Submitting...';
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
                // Show success message
                container.innerHTML = `
                    <div style="text-align: center; padding: 20px;">
                        <div style="width: 48px; height: 48px; background: #10B981; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                        <p style="font-size: 16px; font-weight: 500; color: #18181B;">
                            ${form.successMessage || 'Thank you!'}
                        </p>
                    </div>
                `;
                // Track identify
                if (data.email) {
                    this.tracker?.identify(data.email, data);
                }
                // Redirect if configured
                if (form.redirectUrl) {
                    setTimeout(() => {
                        window.location.href = form.redirectUrl;
                    }, 1500);
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
                submitBtn.innerHTML = form.submitButtonText || 'Subscribe';
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
                plugin.init(this);
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
            properties,
            device: getDeviceInfo(),
            utm: getUTMParams(),
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
    page(name, properties = {}) {
        const pageName = name || (typeof document !== 'undefined' ? document.title : 'Page View');
        this.track('page_view', pageName, {
            ...properties,
            path: typeof window !== 'undefined' ? window.location.pathname : '',
        });
    }
    /**
     * Identify a visitor
     */
    async identify(email, traits = {}) {
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
        }
        else {
            logger.error('Failed to identify visitor:', result.error);
        }
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
    destroy() {
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

/**
 * Clianta SDK - CRM API Client
 * @see SDK_VERSION in core/config.ts
 */
/**
 * CRM API Client for managing contacts and opportunities
 */
class CRMClient {
    constructor(apiEndpoint, workspaceId, authToken) {
        this.apiEndpoint = apiEndpoint;
        this.workspaceId = workspaceId;
        this.authToken = authToken;
    }
    /**
     * Set authentication token for API requests
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
        return this.request(`/api/workspaces/${this.workspaceId}/contacts/${contactId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }
    /**
     * Delete a contact
     */
    async deleteContact(contactId) {
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
    };
}

/**
 * Clianta SDK - React Integration
 *
 * Provides CliantaProvider component for easy React/Next.js integration
 * using the clianta.config.ts pattern.
 */
// Context for accessing tracker throughout the app
const CliantaContext = createContext(null);
/**
 * CliantaProvider - Wrap your app to enable tracking
 *
 * @example
 * // In clianta.config.ts:
 * import { CliantaConfig } from '@clianta/sdk';
 *
 * const config: CliantaConfig = {
 *   projectId: 'your-project-id',
 *   apiEndpoint: 'https://api.clianta.online',
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
function CliantaProvider({ config, children }) {
    const trackerRef = useRef(null);
    useEffect(() => {
        // Initialize tracker with config
        const projectId = config.projectId;
        if (!projectId) {
            console.error('[Clianta] Missing projectId in config. Please add projectId to your clianta.config.ts');
            return;
        }
        // Extract projectId (handled separately) and pass rest as options
        const { projectId: _, ...options } = config;
        trackerRef.current = clianta(projectId, options);
        // Cleanup: flush pending events on unmount
        return () => {
            trackerRef.current?.flush();
        };
    }, [config]);
    return (jsx(CliantaContext.Provider, { value: trackerRef.current, children: children }));
}
/**
 * useClianta - Hook to access tracker in any component
 *
 * @example
 * const tracker = useClianta();
 * tracker?.track('button_click', 'CTA Button');
 */
function useClianta() {
    return useContext(CliantaContext);
}
/**
 * useClinataTrack - Convenience hook for tracking events
 *
 * @example
 * const track = useCliantaTrack();
 * track('purchase', 'Order Completed', { orderId: '123' });
 */
function useCliantaTrack() {
    const tracker = useClianta();
    return (eventType, eventName, properties) => {
        tracker?.track(eventType, eventName, properties);
    };
}

export { CliantaProvider, useClianta, useCliantaTrack };
//# sourceMappingURL=react.esm.js.map
