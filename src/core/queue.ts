/**
 * Clianta SDK - Event Queue
 * Handles batching and flushing of events
 * @see SDK_VERSION in core/config.ts
 */

import type { QueueConfig, TrackingEvent } from '../types';
import { Transport } from './transport';
import { logger } from './logger';
import { getSessionStorage, setSessionStorage } from '../utils';
import { STORAGE_KEYS } from './config';

const MAX_QUEUE_SIZE = 1000;
/** Rate limit: max events per window */
const RATE_LIMIT_MAX_EVENTS = 100;
/** Rate limit window in ms (1 minute) */
const RATE_LIMIT_WINDOW_MS = 60000;

/**
 * Event queue with batching, persistence, rate limiting, and auto-flush
 */
export class EventQueue {
    private queue: TrackingEvent[] = [];
    private transport: Transport;
    private config: Required<QueueConfig>;
    private flushTimer: ReturnType<typeof setInterval> | null = null;
    private isFlushing = false;
    private isOnline = true;
    /** Rate limiting: timestamps of recent events */
    private eventTimestamps: number[] = [];
    private persistMode: 'session' | 'local' | 'none';
    /** Unload handler references for cleanup */
    private boundBeforeUnload: (() => void) | null = null;
    private boundVisibilityChange: (() => void) | null = null;
    private boundPageHide: (() => void) | null = null;
    private boundOnline: (() => void) | null = null;
    private boundOffline: (() => void) | null = null;
    /** Guards against double-flush on unload (beforeunload + pagehide + visibilitychange all fire) */
    private unloadFlushed = false;

    constructor(transport: Transport, config: Partial<QueueConfig> = {}) {
        this.transport = transport;
        this.config = {
            batchSize: config.batchSize ?? 10,
            flushInterval: config.flushInterval ?? 5000,
            maxQueueSize: config.maxQueueSize ?? MAX_QUEUE_SIZE,
            storageKey: config.storageKey ?? STORAGE_KEYS.EVENT_QUEUE,
            persistMode: config.persistMode ?? 'session',
        };
        this.persistMode = this.config.persistMode;
        this.isOnline = typeof navigator === 'undefined' || navigator.onLine;

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
    push(event: TrackingEvent): void {
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
    private checkRateLimit(): boolean {
        const now = Date.now();

        // Remove timestamps outside the window
        this.eventTimestamps = this.eventTimestamps.filter(
            ts => now - ts < RATE_LIMIT_WINDOW_MS
        );

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
    async flush(): Promise<void> {
        if (this.isFlushing || this.queue.length === 0 || !this.isOnline) {
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
                // Re-queue events on failure (at the front), capped at maxQueueSize
                logger.warn('Flush failed, re-queuing events');
                const availableSpace = this.config.maxQueueSize - this.queue.length;
                const eventsToRequeue = events.slice(0, Math.max(0, availableSpace));
                this.queue.unshift(...eventsToRequeue);
                this.persistQueue(this.queue);
            } else {
                logger.debug('Flush successful');
            }
        } catch (error) {
            logger.error('Flush error:', error);
        } finally {
            this.isFlushing = false;
        }
    }

    /**
     * Flush synchronously using sendBeacon (for page unload).
     * Guarded: no-ops after the first call per navigation to prevent
     * triple-flush from beforeunload + visibilitychange + pagehide.
     */
    flushSync(): void {
        if (this.unloadFlushed || this.queue.length === 0) return;
        this.unloadFlushed = true;

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
    get length(): number {
        return this.queue.length;
    }

    /**
     * Clear the queue
     */
    clear(): void {
        this.queue = [];
        this.persistQueue([]);
        // Also clear localStorage if used
        if (this.persistMode === 'local' && typeof localStorage !== 'undefined') {
            try { localStorage.removeItem(this.config.storageKey); } catch { /* ignore */ }
        }
    }

    /**
     * Stop the flush timer and cleanup handlers
     */
    destroy(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        if (typeof window !== 'undefined') {
            if (this.boundBeforeUnload) window.removeEventListener('beforeunload', this.boundBeforeUnload);
            if (this.boundVisibilityChange) window.removeEventListener('visibilitychange', this.boundVisibilityChange);
            if (this.boundPageHide) window.removeEventListener('pagehide', this.boundPageHide);
            if (this.boundOnline) window.removeEventListener('online', this.boundOnline);
            if (this.boundOffline) window.removeEventListener('offline', this.boundOffline);
        }
    }

    /**
     * Start auto-flush timer
     */
    private startFlushTimer(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }

        this.flushTimer = setInterval(() => {
            this.flush();
        }, this.config.flushInterval);
    }

    /**
     * Setup page unload handlers and online/offline listeners
     */
    private setupUnloadHandlers(): void {
        if (typeof window === 'undefined') return;

        // All three unload events share the same guarded flushSync()
        this.boundBeforeUnload = () => this.flushSync();
        window.addEventListener('beforeunload', this.boundBeforeUnload);

        this.boundVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                this.flushSync();
            } else {
                // Page became visible again (e.g. tab switch back) — reset guard
                this.unloadFlushed = false;
            }
        };
        window.addEventListener('visibilitychange', this.boundVisibilityChange);

        this.boundPageHide = () => this.flushSync();
        window.addEventListener('pagehide', this.boundPageHide);

        // Pause queue when offline, resume + flush when back online
        this.boundOnline = () => {
            logger.info('Connection restored — flushing queued events');
            this.isOnline = true;
            this.flush();
        };
        this.boundOffline = () => {
            logger.warn('Connection lost — pausing event queue');
            this.isOnline = false;
        };
        window.addEventListener('online', this.boundOnline);
        window.addEventListener('offline', this.boundOffline);
    }

    /**
     * Persist queue to storage based on persistMode
     */
    private persistQueue(events: TrackingEvent[]): void {
        if (this.persistMode === 'none') return;
        try {
            const serialized = JSON.stringify(events);
            if (this.persistMode === 'local' && typeof localStorage !== 'undefined') {
                try {
                    localStorage.setItem(this.config.storageKey, serialized);
                } catch {
                    // localStorage quota exceeded — fallback to sessionStorage
                    setSessionStorage(this.config.storageKey, serialized);
                }
            } else {
                setSessionStorage(this.config.storageKey, serialized);
            }
        } catch {
            // Ignore storage errors
        }
    }

    /**
     * Restore queue from storage
     */
    private restoreQueue(): void {
        try {
            let stored: string | null = null;

            // Check localStorage first (cross-session persistence)
            if (this.persistMode === 'local' && typeof localStorage !== 'undefined') {
                stored = localStorage.getItem(this.config.storageKey);
            }

            // Fall back to sessionStorage
            if (!stored) {
                stored = getSessionStorage(this.config.storageKey);
            }

            if (stored) {
                const events = JSON.parse(stored) as TrackingEvent[];
                if (Array.isArray(events) && events.length > 0) {
                    this.queue = events;
                    logger.debug(`Restored ${events.length} events from storage`);
                }
            }
        } catch {
            // Ignore parse errors
        }
    }
}
