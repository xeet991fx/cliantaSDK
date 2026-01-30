/**
 * Clianta SDK - Consent Manager
 * Manages consent state and event buffering for GDPR/CCPA compliance
 * @see SDK_VERSION in core/config.ts
 */

import type { ConsentState, ConsentConfig, TrackingEvent } from '../types';
import { saveConsent, loadConsent, clearConsent, hasStoredConsent } from './storage';
import { logger } from '../core/logger';

export type ConsentChangeCallback = (state: ConsentState, previous: ConsentState) => void;

export interface ConsentManagerConfig extends ConsentConfig {
    onConsentChange?: ConsentChangeCallback;
}

/**
 * Manages user consent state for tracking
 */
export class ConsentManager {
    private state: ConsentState;
    private config: ConsentManagerConfig;
    private eventBuffer: TrackingEvent[] = [];
    private callbacks: ConsentChangeCallback[] = [];
    private hasExplicitConsent = false;

    constructor(config: ConsentManagerConfig = {}) {
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
        } else {
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
    grant(categories: Partial<ConsentState>): void {
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
    revoke(categories: (keyof ConsentState)[]): void {
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
    update(state: ConsentState): void {
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
    reset(): void {
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
    getState(): ConsentState {
        return { ...this.state };
    }

    /**
     * Check if a specific consent category is granted
     */
    hasConsent(category: keyof ConsentState): boolean {
        return this.state[category] === true;
    }

    /**
     * Check if analytics consent is granted (most common check)
     */
    canTrack(): boolean {
        // If waiting for consent and no explicit consent given, cannot track
        if (this.config.waitForConsent && !this.hasExplicitConsent) {
            return false;
        }
        return this.state.analytics === true;
    }

    /**
     * Check if explicit consent has been given
     */
    hasExplicit(): boolean {
        return this.hasExplicitConsent;
    }

    /**
     * Check if there's stored consent
     */
    hasStored(): boolean {
        return hasStoredConsent();
    }

    /**
     * Buffer an event (for waitForConsent mode)
     */
    bufferEvent(event: TrackingEvent): void {
        this.eventBuffer.push(event);
        logger.debug('Event buffered (waiting for consent):', event.eventName);
    }

    /**
     * Get and clear buffered events
     */
    flushBuffer(): TrackingEvent[] {
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
    getBufferSize(): number {
        return this.eventBuffer.length;
    }

    /**
     * Register a consent change callback
     */
    onChange(callback: ConsentChangeCallback): () => void {
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
    private notifyChange(previous: ConsentState): void {
        for (const callback of this.callbacks) {
            try {
                callback(this.state, previous);
            } catch (error) {
                logger.error('Consent change callback error:', error);
            }
        }
    }
}
