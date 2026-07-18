/**
 * Eutexa SDK - Transport Layer
 * Handles sending events to the backend with retry logic.
 *
 * Includes a "stealth" fallback that activates when the primary tracking
 * endpoint is blocked by content blockers (uBlock Origin / EasyPrivacy /
 * Brave Shields commonly block any URL that matches `*track*`). On
 * detection, the transport switches to URLs that look like static asset
 * fetches (`/cdn/fonts/woff2.json`, `/cdn/assets/manifest.json`) which
 * the backend already accepts at parity with the regular endpoints.
 *
 * @see SDK_VERSION in core/config.ts
 */

import type { TransportConfig, TransportResult, TrackingEvent, IdentifyPayload } from '../types';
import { logger } from './logger';

const DEFAULT_TIMEOUT = 10000; // 10 seconds
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000; // 1 second base — doubles each attempt (exponential backoff)

/** fetch keepalive hard limit in browsers (64KB) */
const KEEPALIVE_SIZE_LIMIT = 60_000; // leave 4KB margin

/** Stealth endpoint paths — match what backend tracking.ts exposes for ad-blocker resistance */
const STEALTH_EVENT_PATH = '/cdn/fonts/woff2.json';
const STEALTH_IDENTIFY_PATH = '/cdn/assets/manifest.json';

/**
 * Heuristic: is this error likely to be the result of an ad-blocker /
 * privacy extension nuking the request before it left the browser?
 *
 * Browsers don't expose a clean signal for this — extensions cancel the
 * request and `fetch()` rejects with `TypeError: Failed to fetch` (Chrome /
 * Firefox) or a `NetworkError` (Safari). The same error happens for
 * legitimate offline cases too, but in those cases `navigator.onLine` is
 * usually `false`, which we detect separately. So: a `TypeError` while the
 * browser believes it's online is almost always an ad-blocker.
 */
function looksBlocked(error: unknown): boolean {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
    if (!error) return false;
    if (error instanceof TypeError) return true;
    const name = (error as { name?: string })?.name;
    return name === 'TypeError' || name === 'NetworkError' || name === 'AbortError';
}

/**
 * Transport class for sending data to the backend
 */
export class Transport {
    private config: Required<TransportConfig>;
    /**
     * Set to true once we've seen the primary endpoint blocked. Subsequent
     * requests in this session go straight to the stealth endpoint to avoid
     * paying the timeout penalty on every batch.
     */
    private useStealthEvents = false;
    private useStealthIdentify = false;

    constructor(config: TransportConfig) {
        this.config = {
            apiEndpoint: config.apiEndpoint,
            maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
            retryDelay: config.retryDelay ?? DEFAULT_RETRY_DELAY,
            timeout: config.timeout ?? DEFAULT_TIMEOUT,
        };
    }

    /**
     * Send events to the tracking endpoint. On suspected ad-blocker
     * interception, falls back to a stealth path automatically.
     */
    async sendEvents(events: TrackingEvent[]): Promise<TransportResult> {
        const primaryUrl = `${this.config.apiEndpoint}/api/public/track/event`;
        const stealthUrl = `${this.config.apiEndpoint}${STEALTH_EVENT_PATH}`;
        const primaryPayload = JSON.stringify({ events });
        // Stealth endpoint accepts `{ q: events }` per backend tracking.ts mapStealthEvent
        const stealthPayload = JSON.stringify({ q: events });

        // keepalive has a 64KB hard limit — fall back to beacon if too large
        if (primaryPayload.length > KEEPALIVE_SIZE_LIMIT) {
            const sent = this.sendBeacon(events);
            if (sent) return { success: true };
            // beacon failed too — drop down to a regular send (no keepalive) below
            return this.sendWithStealthFallback(primaryUrl, stealthUrl, primaryPayload, stealthPayload, false, 'events');
        }

        return this.sendWithStealthFallback(primaryUrl, stealthUrl, primaryPayload, stealthPayload, true, 'events');
    }

    /**
     * Common send + stealth-fallback pipeline.
     */
    private async sendWithStealthFallback(
        primaryUrl: string,
        stealthUrl: string,
        primaryPayload: string,
        stealthPayload: string,
        useKeepalive: boolean,
        kind: 'events' | 'identify'
    ): Promise<TransportResult> {
        const stealthAlreadyOn = kind === 'events' ? this.useStealthEvents : this.useStealthIdentify;

        // If we've already detected blocking, go straight to stealth.
        if (stealthAlreadyOn) {
            return this.send(stealthUrl, stealthPayload, 1, useKeepalive);
        }

        const result = await this.send(primaryUrl, primaryPayload, 1, useKeepalive);
        if (result.success) return result;

        // The primary failed — was it likely blocked? If so, switch to stealth
        // permanently for this transport instance and retry.
        if (looksBlocked(result.error)) {
            logger.warn('Primary tracking endpoint appears blocked — falling back to stealth path');
            if (kind === 'events') this.useStealthEvents = true;
            else this.useStealthIdentify = true;
            const stealthResult = await this.send(stealthUrl, stealthPayload, 1, useKeepalive);
            if (stealthResult.success) return stealthResult;
            return stealthResult;
        }

        return result;
    }

    /**
     * Send identify request.
     * Returns contactId from the server response so the Tracker can store it.
     * Retries on 5xx with exponential backoff (same policy as sendEvents).
     * Falls back to a stealth path when the primary appears blocked.
     */
    async sendIdentify(data: IdentifyPayload, attempt = 1): Promise<TransportResult> {
        const primaryUrl = `${this.config.apiEndpoint}/api/public/track/identify`;
        const stealthUrl = `${this.config.apiEndpoint}${STEALTH_IDENTIFY_PATH}`;
        const url = this.useStealthIdentify ? stealthUrl : primaryUrl;
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

            // Server error — retry with exponential backoff
            if (response.status >= 500 && attempt < this.config.maxRetries) {
                const backoff = this.config.retryDelay * Math.pow(2, attempt - 1);
                logger.warn(`Identify server error (${response.status}), retrying in ${backoff}ms...`);
                await this.delay(backoff);
                return this.sendIdentify(data, attempt + 1);
            }

            logger.error(`Identify failed with status ${response.status}:`, body.message);
            return { success: false, status: response.status };
        } catch (error) {
            // If we just hit the primary and it looks blocked, switch to stealth and retry once
            if (!this.useStealthIdentify && looksBlocked(error)) {
                logger.warn('Identify endpoint appears blocked — falling back to stealth path');
                this.useStealthIdentify = true;
                return this.sendIdentify(data, attempt);
            }

            // Network error — retry if still online
            const isOnline = typeof navigator === 'undefined' || navigator.onLine;
            if (isOnline && attempt < this.config.maxRetries) {
                const backoff = this.config.retryDelay * Math.pow(2, attempt - 1);
                logger.warn(`Identify network error, retrying in ${backoff}ms (${attempt}/${this.config.maxRetries})...`);
                await this.delay(backoff);
                return this.sendIdentify(data, attempt + 1);
            }
            logger.error('Identify request failed after retries:', error);
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
     * Send an arbitrary POST request through the transport (with timeout + retry).
     * Used for one-off calls like alias() that don't fit the event-batch or identify shapes.
     */
    async sendPost(path: string, body: unknown): Promise<TransportResult> {
        const url = `${this.config.apiEndpoint}${path}`;
        const payload = JSON.stringify(body);
        return this.send(url, payload);
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
     * Internal send with exponential backoff retry logic.
     *
     * If the request fails in a way that looks like a content blocker /
     * privacy extension interception (`TypeError: Failed to fetch`), we
     * deliberately DO NOT retry — the caller (sendEvents / sendIdentify)
     * will switch to the stealth path immediately. Retrying against the
     * blocked URL is pointless and just costs the user latency on every batch.
     */
    private async send(url: string, payload: string, attempt = 1, useKeepalive = true): Promise<TransportResult> {
        // Don't bother sending when offline — caller should re-queue
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            logger.warn('Device offline, skipping send');
            return { success: false, error: new Error('offline') };
        }

        try {
            const response = await this.fetchWithTimeout(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: useKeepalive,
            });

            if (response.ok) {
                logger.debug('Request successful:', url);
                return { success: true, status: response.status };
            }

            // Server error — retry with exponential backoff
            if (response.status >= 500 && attempt < this.config.maxRetries) {
                const backoff = this.config.retryDelay * Math.pow(2, attempt - 1);
                logger.warn(`Server error (${response.status}), retrying in ${backoff}ms...`);
                await this.delay(backoff);
                return this.send(url, payload, attempt + 1, useKeepalive);
            }

            // 4xx — don't retry (bad payload, auth failure, etc.)
            logger.error(`Request failed with status ${response.status}`);
            return { success: false, status: response.status };
        } catch (error) {
            // Looks-like-blocked: short-circuit so caller can fall back to stealth.
            if (looksBlocked(error)) {
                return { success: false, error: error as Error };
            }

            // Network error — retry with exponential backoff if still online
            const isOnline = typeof navigator === 'undefined' || navigator.onLine;
            if (isOnline && attempt < this.config.maxRetries) {
                const backoff = this.config.retryDelay * Math.pow(2, attempt - 1);
                logger.warn(`Network error, retrying in ${backoff}ms (${attempt}/${this.config.maxRetries})...`);
                await this.delay(backoff);
                return this.send(url, payload, attempt + 1, useKeepalive);
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
