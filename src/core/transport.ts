/**
 * MorrisB Tracking SDK - Transport Layer
 * Handles sending events to the backend with retry logic
 * @version 3.0.0
 */

import type { TransportConfig, TransportResult, TrackingEvent, IdentifyPayload } from '../types';
import { logger } from './logger';

const DEFAULT_TIMEOUT = 10000; // 10 seconds
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000; // 1 second

/**
 * Transport class for sending data to the backend
 */
export class Transport {
    private config: Required<TransportConfig>;

    constructor(config: TransportConfig) {
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
    async sendEvents(events: TrackingEvent[]): Promise<TransportResult> {
        const url = `${this.config.apiEndpoint}/api/public/track/event`;
        const payload = JSON.stringify({ events });

        return this.send(url, payload);
    }

    /**
     * Send identify request
     */
    async sendIdentify(data: IdentifyPayload): Promise<TransportResult> {
        const url = `${this.config.apiEndpoint}/api/public/track/identify`;
        const payload = JSON.stringify(data);

        return this.send(url, payload);
    }

    /**
     * Send events synchronously (for page unload)
     * Uses navigator.sendBeacon for reliability
     */
    sendBeacon(events: TrackingEvent[]): boolean {
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
            } else {
                logger.warn('sendBeacon returned false');
            }
            return success;
        } catch (error) {
            logger.error('sendBeacon error:', error);
            return false;
        }
    }

    /**
     * Internal send with retry logic
     */
    private async send(url: string, payload: string, attempt = 1): Promise<TransportResult> {
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
        } catch (error) {
            // Network error - retry if possible
            if (attempt < this.config.maxRetries) {
                logger.warn(`Network error, retrying (${attempt}/${this.config.maxRetries})...`);
                await this.delay(this.config.retryDelay * attempt);
                return this.send(url, payload, attempt + 1);
            }

            logger.error('Request failed after retries:', error);
            return { success: false, error: error as Error };
        }
    }

    /**
     * Fetch with timeout
     */
    private async fetchWithTimeout(
        url: string,
        options: RequestInit
    ): Promise<Response> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
            });
            return response;
        } finally {
            clearTimeout(timeout);
        }
    }

    /**
     * Delay helper
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
