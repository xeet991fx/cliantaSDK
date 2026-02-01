/**
 * Clianta SDK - Event Queue
 * Handles batching and flushing of events
 * @see SDK_VERSION in core/config.ts
 */

import type { QueueConfig, TrackingEvent } from '../types';
import { Transport } from './transport';
import { logger } from './logger';
import { getLocalStorage, setLocalStorage } from '../utils';
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
    /** Rate limiting: timestamps of recent events */
    private eventTimestamps: number[] = [];

    constructor(transport: Transport, config: Partial<QueueConfig> = {}) {
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
     * Flush synchronously using sendBeacon (for page unload)
     */
    flushSync(): void {
        if (this.queue.length === 0) return;

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
    }

    /**
     * Stop the flush timer
     */
    destroy(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
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
     * Setup page unload handlers
     */
    private setupUnloadHandlers(): void {
        if (typeof window === 'undefined') return;

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
    private persistQueue(events: TrackingEvent[]): void {
        try {
            setLocalStorage(this.config.storageKey, JSON.stringify(events));
        } catch {
            // Ignore storage errors
        }
    }

    /**
     * Restore queue from localStorage
     */
    private restoreQueue(): void {
        try {
            const stored = getLocalStorage(this.config.storageKey);
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
