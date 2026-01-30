/*!
 * MorrisB Tracking SDK v3.0.0
 * (c) 2026 MorrisB
 * Released under the MIT License.
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.MorrisB = {}));
})(this, (function (exports) { 'use strict';

    /**
     * MorrisB Tracking SDK - Configuration
     * @version 3.0.0
     */
    /** SDK Version */
    const SDK_VERSION = '3.0.0';
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
        apiEndpoint: getDefaultApiEndpoint(),
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
        },
        cookieDomain: '',
        useCookies: false,
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
     * MorrisB Tracking SDK - Debug Logger
     * @version 3.0.0
     */
    const LOG_PREFIX = '[MorrisB]';
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
     * MorrisB Tracking SDK - Transport Layer
     * Handles sending events to the backend with retry logic
     * @version 3.0.0
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
     * MorrisB Tracking SDK - Utility Functions
     * @version 3.0.0
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
     * MorrisB Tracking SDK - Event Queue
     * Handles batching and flushing of events
     * @version 3.0.0
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
     * MorrisB Tracking SDK - Plugin Base
     * @version 3.0.0
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
     * MorrisB Tracking SDK - Page View Plugin
     * @version 3.0.0
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
     * MorrisB Tracking SDK - Scroll Depth Plugin
     * @version 3.0.0
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
     * MorrisB Tracking SDK - Form Tracking Plugin
     * @version 3.0.0
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
     * MorrisB Tracking SDK - Click Tracking Plugin
     * @version 3.0.0
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
     * MorrisB Tracking SDK - Engagement Plugin
     * @version 3.0.0
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
     * MorrisB Tracking SDK - Downloads Plugin
     * @version 3.0.0
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
     * MorrisB Tracking SDK - Exit Intent Plugin
     * @version 3.0.0
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
     * MorrisB Tracking SDK - Error Tracking Plugin
     * @version 3.0.0
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
     * MorrisB Tracking SDK - Performance Plugin
     * @version 3.0.0
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
     * MorrisB Tracking SDK - Plugins Index
     * @version 3.0.0
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
            default:
                throw new Error(`Unknown plugin: ${name}`);
        }
    }

    /**
     * MorrisB Tracking SDK - Main Tracker Class
     * @version 3.0.0
     */
    /**
     * Main MorrisB Tracker Class
     */
    class Tracker {
        constructor(workspaceId, userConfig = {}) {
            this.plugins = [];
            this.isInitialized = false;
            if (!workspaceId) {
                throw new Error('[MorrisB] Workspace ID is required');
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
            logger.info('Consent updated:', state);
            // TODO: Implement consent management
            // - Store consent state
            // - Enable/disable tracking based on consent
            // - Notify plugins
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
            this.visitorId = getOrCreateVisitorId(this.config.useCookies);
            this.sessionId = getOrCreateSessionId(this.config.sessionTimeout);
            this.queue.clear();
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
     * MorrisB Tracking SDK
     * Professional website tracking for lead generation
     * @version 3.0.0
     */
    // Global instance cache
    let globalInstance = null;
    /**
     * Initialize or get the MorrisB tracker instance
     *
     * @example
     * // Simple initialization
     * const tracker = morrisb('your-workspace-id');
     *
     * @example
     * // With configuration
     * const tracker = morrisb('your-workspace-id', {
     *   debug: true,
     *   plugins: ['pageView', 'forms', 'scroll'],
     * });
     */
    function morrisb(workspaceId, config) {
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
        window.morrisb = morrisb;
        window.MorrisB = {
            morrisb,
            Tracker,
        };
    }

    exports.SDK_VERSION = SDK_VERSION;
    exports.Tracker = Tracker;
    exports.default = morrisb;
    exports.morrisb = morrisb;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=morrisb.umd.js.map
