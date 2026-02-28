/**
 * Clianta SDK - Transport Layer
 * Handles sending events to the backend with retry logic
 * @see SDK_VERSION in core/config.ts
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
     * Send identify request.
     * Returns contactId from the server response so the Tracker can store it.
     */
    async sendIdentify(data: IdentifyPayload): Promise<TransportResult> {
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
            } else {
                logger.error(`Identify failed with status ${response.status}:`, body.message);
            }
            return { success: false, status: response.status };
        } catch (error) {
            logger.error('Identify request failed:', error);
            return { success: false, error: error as Error };
        }
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
     * Fetch data from the tracking API (GET request)
     * Used for read-back APIs (visitor profile, activity, etc.)
     */
    async fetchData<T = unknown>(path: string, params?: Record<string, string>): Promise<{ success: boolean; data?: T; status?: number; error?: Error }> {
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
        } catch (error) {
            logger.error('Fetch request failed:', error);
            return { success: false, error: error as Error };
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
